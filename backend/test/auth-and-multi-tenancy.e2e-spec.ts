import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import helmet from 'helmet';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/http-exception.filter';

describe('Auth & Multi-Tenancy Security (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let company1Id: string;
  let company2Id: string;
  let company1Token: string;
  let company2Token: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      'postgresql://erp_user:erp_password_local_dev@localhost:5434/inventory_erp_dev?schema=public';
    process.env.JWT_SECRET =
      process.env.JWT_SECRET || 'super_secret_erp_jwt_key_for_development_min_32_chars!';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    app.use(helmet());
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();
    prisma = app.get<PrismaService>(PrismaService);

    // Fetch seeded companies
    const c1 = await prisma.company.findUnique({ where: { code: 'COMP-01' } });
    const c2 = await prisma.company.findUnique({ where: { code: 'COMP-02' } });

    if (!c1 || !c2) {
      throw new Error('Database must be seeded before running e2e test (run pnpm db:seed)');
    }

    company1Id = c1.id;
    company2Id = c2.id;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Database Credential Security', () => {
    it('guarantees passwords are never stored as plaintext in the database', async () => {
      const user = await prisma.user.findFirst({
        where: { email: 'admin@acme-erp.local' },
      });

      expect(user).toBeDefined();
      expect(user?.passwordHash).toBeDefined();
      // Must not be plaintext
      expect(user?.passwordHash).not.toBe('Admin123!@#');
      // Must be a valid Argon2id hash
      expect(user?.passwordHash.startsWith('$argon2id$')).toBe(true);
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('successfully logs in with valid credentials and issues JWT token', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          companyCode: 'COMP-01',
          email: 'admin@acme-erp.local',
          password: 'Admin123!@#',
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(typeof res.body.accessToken).toBe('string');
      expect(res.body).toHaveProperty('user');
      expect(res.body.user.email).toBe('admin@acme-erp.local');
      expect(res.body.user.company.code).toBe('COMP-01');

      company1Token = res.body.accessToken;
    });

    it('successfully logs in as Company 2 admin', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          companyCode: 'COMP-02',
          email: 'admin@beta-corp.local',
          password: 'BetaAdmin123!@#',
        })
        .expect(200);

      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.company.code).toBe('COMP-02');

      company2Token = res.body.accessToken;
    });

    it('rejects invalid password with generic 401 error message', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          companyCode: 'COMP-01',
          email: 'admin@acme-erp.local',
          password: 'WrongPassword999!',
        })
        .expect(401);

      expect(res.body.message).toContain('Invalid credentials');
    });

    it('rejects non-existent company with generic 401 error message', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          companyCode: 'UNKNOWN_CORP',
          email: 'admin@acme-erp.local',
          password: 'Admin123!@#',
        })
        .expect(401);

      expect(res.body.message).toContain('Invalid credentials');
    });

    it('rejects invalid payload format (missing email) with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          companyCode: 'COMP-01',
          password: 'Admin123!@#',
        })
        .expect(400);

      expect(res.body).toHaveProperty('statusCode', 400);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('Protected Endpoints & Token Validation', () => {
    it('returns current user profile when valid JWT is supplied', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body).toHaveProperty('email', 'admin@acme-erp.local');
      expect(res.body.company).toHaveProperty('code', 'COMP-01');
    });

    it('rejects request when Authorization header is missing', async () => {
      await request(app.getHttpServer()).get('/api/v1/auth/me').expect(401);
    });

    it('rejects request with malformed or invalid JWT token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload')
        .expect(401);
    });
  });

  describe('Multi-Tenant Cross-Company Isolation (CRITICAL)', () => {
    it('allows Company 1 user to read their own company records', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/companies/${company1Id}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(200);

      expect(res.body.id).toBe(company1Id);
      expect(res.body.code).toBe('COMP-01');
    });

    it('prevents Company 1 user from reading Company 2 records (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/companies/${company2Id}`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(403);

      expect(res.body.message).toContain('Cross-company access denied');
    });

    it('prevents Company 1 user from querying Company 2 warehouses (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/companies/${company2Id}/warehouses`)
        .set('Authorization', `Bearer ${company1Token}`)
        .expect(403);

      expect(res.body.message).toContain('Cross-company access denied');
    });

    it('allows Company 2 user to access Company 2 warehouses', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/companies/${company2Id}/warehouses`)
        .set('Authorization', `Bearer ${company2Token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.some((w: { code: string }) => w.code === 'WH-BETA')).toBe(true);
    });

    it('prevents Company 2 user from accessing Company 1 records (403 Forbidden)', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/companies/${company1Id}/warehouses`)
        .set('Authorization', `Bearer ${company2Token}`)
        .expect(403);

      expect(res.body.message).toContain('Cross-company access denied');
    });
  });

  describe('Security Headers & Observability', () => {
    it('sets security headers via Helmet middleware', async () => {
      const res = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

      expect(res.headers).toHaveProperty('x-content-type-options', 'nosniff');
      expect(res.headers).toHaveProperty('x-dns-prefetch-control', 'off');
    });

    it('injects and echoes X-Correlation-ID header', async () => {
      const customCorrelationId = 'custom-audit-id-12345';
      const res = await request(app.getHttpServer())
        .get('/api/v1/health')
        .set('x-correlation-id', customCorrelationId)
        .expect(200);

      expect(res.headers).toHaveProperty('x-correlation-id', customCorrelationId);
    });
  });
});
