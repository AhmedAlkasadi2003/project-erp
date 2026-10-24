import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@ApiTags('Companies')
@ApiBearerAuth('JWT-auth')
@Controller('companies')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('current')
  @ApiOperation({ summary: 'Retrieve current tenant company details' })
  @ApiResponse({ status: 200, description: 'Current company details' })
  async getCurrentCompany(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.getCompanyById(user.companyId);
  }

  @Get(':companyId')
  @ApiOperation({ summary: 'Retrieve company details by ID' })
  @ApiResponse({ status: 200, description: 'Company details' })
  async getCompanyById(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companiesService.getCompanyById(companyId);
  }

  @Get(':companyId/warehouses')
  @ApiOperation({ summary: 'List all warehouses belonging to the company' })
  @ApiResponse({ status: 200, description: 'List of company warehouses' })
  async getCompanyWarehouses(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companiesService.getCompanyWarehouses(companyId);
  }

  @Get(':companyId/items')
  @ApiOperation({ summary: 'List all stock inventory items belonging to the company' })
  @ApiResponse({ status: 200, description: 'List of inventory items' })
  async getCompanyItems(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companiesService.getCompanyItems(companyId);
  }

  @Get(':companyId/suppliers')
  @ApiOperation({ summary: 'List all active suppliers belonging to the company' })
  @ApiResponse({ status: 200, description: 'List of suppliers' })
  async getCompanySuppliers(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companiesService.getCompanySuppliers(companyId);
  }
}
