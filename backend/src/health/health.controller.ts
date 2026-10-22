import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { HealthService, HealthStatusResponse } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async getHealth(): Promise<HealthStatusResponse> {
    return this.healthService.checkHealth();
  }
}
