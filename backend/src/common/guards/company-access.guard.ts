import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Request } from 'express';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      companyId?: string;
    }
  }
}

@Injectable()
export class CompanyAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('User context is missing or unauthenticated');
    }

    const rawCompanyId = request.params.companyId;
    const routeCompanyId = Array.isArray(rawCompanyId) ? rawCompanyId[0] : rawCompanyId;

    // If endpoint has a specific :companyId route parameter, verify tenant matching
    if (routeCompanyId) {
      if (user.role === UserRole.SUPER_ADMIN) {
        request.companyId = routeCompanyId;
        return true;
      }

      if (user.companyId !== routeCompanyId) {
        throw new ForbiddenException(
          'Cross-company access denied: you cannot access data belonging to another tenant',
        );
      }
    }

    // Set verified companyId on request context
    request.companyId = user.companyId;
    return true;
  }
}
