import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { hash } from '@node-rs/argon2';
import { UserRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let authService: AuthService;

  const mockPrisma = {
    company: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const mockJwtService = {
    signAsync: jest.fn().mockResolvedValue('mock_jwt_token_xyz'),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    authService = moduleRef.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(authService).toBeDefined();
  });

  describe('validateAndLogin', () => {
    it('successfully logs in with valid company, user, and password', async () => {
      const passwordPlain = 'ValidSecret123!';
      const passwordHash = await hash(passwordPlain);

      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-uuid-1',
        code: 'COMP-01',
        name: 'Acme Test Corp',
        currency: 'USD',
        isActive: true,
      });

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        companyId: 'comp-uuid-1',
        email: 'user@acme.local',
        name: 'Test User',
        passwordHash,
        role: UserRole.CLERK,
        isActive: true,
      });

      const result = await authService.validateAndLogin({
        companyCode: 'COMP-01',
        email: 'user@acme.local',
        password: passwordPlain,
      });

      expect(result).toBeDefined();
      expect(result.accessToken).toBe('mock_jwt_token_xyz');
      expect(result.user.email).toBe('user@acme.local');
      expect(result.user.company.code).toBe('COMP-01');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: 'user-uuid-1',
        email: 'user@acme.local',
        companyId: 'comp-uuid-1',
        role: UserRole.CLERK,
      });
    });

    it('rejects when company does not exist', async () => {
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(
        authService.validateAndLogin({
          companyCode: 'NON_EXISTENT',
          email: 'user@acme.local',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when company is inactive', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-uuid-inactive',
        code: 'INACTIVE',
        isActive: false,
      });

      await expect(
        authService.validateAndLogin({
          companyCode: 'INACTIVE',
          email: 'user@acme.local',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when user does not exist within the company', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-uuid-1',
        code: 'COMP-01',
        isActive: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        authService.validateAndLogin({
          companyCode: 'COMP-01',
          email: 'notfound@acme.local',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects when user is inactive / disabled', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-uuid-1',
        code: 'COMP-01',
        isActive: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-disabled',
        companyId: 'comp-uuid-1',
        email: 'disabled@acme.local',
        isActive: false,
        passwordHash: 'hash',
      });

      await expect(
        authService.validateAndLogin({
          companyCode: 'COMP-01',
          email: 'disabled@acme.local',
          password: 'Password123!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects with invalid password', async () => {
      const correctHash = await hash('CorrectPassword123!');

      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'comp-uuid-1',
        code: 'COMP-01',
        isActive: true,
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-uuid-1',
        companyId: 'comp-uuid-1',
        email: 'user@acme.local',
        passwordHash: correctHash,
        isActive: true,
      });

      await expect(
        authService.validateAndLogin({
          companyCode: 'COMP-01',
          email: 'user@acme.local',
          password: 'WrongPassword!',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('getProfile', () => {
    it('returns user and company profile when active', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'user@acme.local',
        name: 'Jane Doe',
        role: UserRole.ACCOUNTANT,
        companyId: 'comp-1',
        isActive: true,
        company: {
          id: 'comp-1',
          code: 'COMP-01',
          name: 'Acme Corp',
          currency: 'USD',
          isActive: true,
        },
      });

      const profile = await authService.getProfile('user-1', 'comp-1');

      expect(profile).toBeDefined();
      expect(profile.email).toBe('user@acme.local');
      expect(profile.role).toBe(UserRole.ACCOUNTANT);
      expect(profile.company.code).toBe('COMP-01');
    });

    it('throws UnauthorizedException when user profile not found', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(authService.getProfile('user-unknown', 'comp-1')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
