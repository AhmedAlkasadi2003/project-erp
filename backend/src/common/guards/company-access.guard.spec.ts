import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CompanyAccessGuard } from './company-access.guard';

describe('CompanyAccessGuard', () => {
  let guard: CompanyAccessGuard;

  beforeEach(() => {
    guard = new CompanyAccessGuard();
  });

  const createMockContext = (user: unknown, params: Record<string, string> = {}) => {
    const request = {
      user,
      params,
      companyId: undefined as string | undefined,
    };

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  it('allows access when route companyId matches user companyId', () => {
    const user = {
      id: 'u-1',
      companyId: 'company-uuid-1',
      role: UserRole.CLERK,
    };
    const context = createMockContext(user, { companyId: 'company-uuid-1' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('allows access when no route companyId is specified and sets companyId from user', () => {
    const user = {
      id: 'u-1',
      companyId: 'company-uuid-1',
      role: UserRole.CLERK,
    };
    const context = createMockContext(user, {});

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when user attempts to access a different companyId', () => {
    const user = {
      id: 'u-1',
      companyId: 'company-uuid-1',
      role: UserRole.ADMIN,
    };
    const context = createMockContext(user, { companyId: 'company-uuid-2' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('allows SUPER_ADMIN to access any companyId parameter', () => {
    const superAdmin = {
      id: 'sa-1',
      companyId: 'company-uuid-1',
      role: UserRole.SUPER_ADMIN,
    };
    const context = createMockContext(superAdmin, { companyId: 'company-uuid-2' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when user context is missing', () => {
    const context = createMockContext(null, {});

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
