import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { verify } from '@node-rs/argon2';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UserRole } from '@prisma/client';

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    companyId: string;
    company: {
      id: string;
      code: string;
      name: string;
      currency: string;
    };
  };
}

export interface UserProfileResponse {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  companyId: string;
  isActive: boolean;
  company: {
    id: string;
    code: string;
    name: string;
    currency: string;
    isActive: boolean;
  };
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async validateAndLogin(loginDto: LoginDto): Promise<LoginResponse> {
    const normalizedCompanyCode = loginDto.companyCode.trim().toUpperCase();
    const normalizedEmail = loginDto.email.trim().toLowerCase();

    // 1. Resolve tenant company
    const company = await this.prisma.company.findUnique({
      where: { code: normalizedCompanyCode },
    });

    if (!company || !company.isActive) {
      // Use generic error message to prevent company enumeration
      throw new UnauthorizedException(
        'Invalid credentials: check company code, email, or password',
      );
    }

    // 2. Resolve user within company
    const user = await this.prisma.user.findUnique({
      where: {
        companyId_email: {
          companyId: company.id,
          email: normalizedEmail,
        },
      },
    });

    if (!user || !user.isActive || !user.passwordHash) {
      // Use identical generic error message to prevent user enumeration
      throw new UnauthorizedException(
        'Invalid credentials: check company code, email, or password',
      );
    }

    // 3. Verify Argon2id password hash
    let isPasswordValid = false;
    try {
      isPasswordValid = await verify(user.passwordHash, loginDto.password);
    } catch {
      isPasswordValid = false;
    }

    if (!isPasswordValid) {
      throw new UnauthorizedException(
        'Invalid credentials: check company code, email, or password',
      );
    }

    // 4. Generate JWT payload
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: '1h',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        companyId: user.companyId,
        company: {
          id: company.id,
          code: company.code,
          name: company.name,
          currency: company.currency,
        },
      },
    };
  }

  async getProfile(userId: string, companyId: string): Promise<UserProfileResponse> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        companyId,
      },
      include: {
        company: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User profile not found or inactive');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      companyId: user.companyId,
      isActive: user.isActive,
      company: {
        id: user.company.id,
        code: user.company.code,
        name: user.company.name,
        currency: user.company.currency,
        isActive: user.company.isActive,
      },
    };
  }
}
