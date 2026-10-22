import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthController', () => {
  let healthController: HealthController;

  const mockPrismaService = {
    isHealthy: jest.fn().mockResolvedValue(true),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('test'),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        HealthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    healthController = moduleRef.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(healthController).toBeDefined();
  });

  it('should return health status with status ok when database is healthy', async () => {
    const response = await healthController.getHealth();

    expect(response).toBeDefined();
    expect(response.status).toBe('ok');
    expect(response.services.database.status).toBe('up');
    expect(response.environment).toBe('test');
    expect(typeof response.uptime).toBe('number');
  });

  it('should return degraded status when database is down', async () => {
    mockPrismaService.isHealthy.mockResolvedValueOnce(false);

    const response = await healthController.getHealth();

    expect(response).toBeDefined();
    expect(response.status).toBe('degraded');
    expect(response.services.database.status).toBe('down');
  });
});
