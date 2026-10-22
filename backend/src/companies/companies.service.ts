import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCompanyById(companyId: string) {
    const company = await this.prisma.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        code: true,
        name: true,
        currency: true,
        fiscalYearStart: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!company) {
      throw new NotFoundException(`Company with ID '${companyId}' was not found`);
    }

    return company;
  }

  async getCompanyWarehouses(companyId: string) {
    return this.prisma.warehouse.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
  }

  async getCompanyItems(companyId: string) {
    return this.prisma.item.findMany({
      where: { companyId },
      include: {
        assetAccount: { select: { code: true, name: true } },
        cogsAccount: { select: { code: true, name: true } },
      },
      orderBy: { sku: 'asc' },
    });
  }

  async getCompanySuppliers(companyId: string) {
    return this.prisma.supplier.findMany({
      where: { companyId },
      orderBy: { code: 'asc' },
    });
  }
}
