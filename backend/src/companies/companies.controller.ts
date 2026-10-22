import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CompanyAccessGuard } from '../common/guards/company-access.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/interfaces/authenticated-user.interface';

@Controller('companies')
@UseGuards(JwtAuthGuard, CompanyAccessGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get('current')
  async getCurrentCompany(@CurrentUser() user: AuthenticatedUser) {
    return this.companiesService.getCompanyById(user.companyId);
  }

  @Get(':companyId')
  async getCompanyById(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companiesService.getCompanyById(companyId);
  }

  @Get(':companyId/warehouses')
  async getCompanyWarehouses(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companiesService.getCompanyWarehouses(companyId);
  }

  @Get(':companyId/items')
  async getCompanyItems(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.companiesService.getCompanyItems(companyId);
  }
}
