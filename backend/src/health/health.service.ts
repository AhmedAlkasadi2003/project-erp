import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthStatusResponse {
  status: 'ok' | 'degraded';
  timestamp: string;
  uptime: number;
  environment: string;
  version: string;
  services: {
    database: {
      status: 'up' | 'down';
    };
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
  ) {}

  async checkHealth(): Promise<HealthStatusResponse> {
    const isDbHealthy = await this.prismaService.isHealthy();
    const env = this.configService.get<string>('NODE_ENV', 'development');

    return {
      status: isDbHealthy ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: env,
      version: '0.1.0',
      services: {
        database: {
          status: isDbHealthy ? 'up' : 'down',
        },
      },
    };
  }
}
