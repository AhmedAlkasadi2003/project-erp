import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthService, HealthStatusResponse } from './health.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'System connection and database health check' })
  @ApiResponse({ status: 200, description: 'Health check status response' })
  async getHealth(): Promise<HealthStatusResponse> {
    return this.healthService.checkHealth();
  }
}
