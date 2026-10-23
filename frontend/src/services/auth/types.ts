export type UserRole =
  | 'ADMIN'
  | 'ACCOUNTANT'
  | 'WAREHOUSE_MANAGER'
  | 'CLERK'
  | 'VIEWER'
  | 'SUPER_ADMIN';

export interface Company {
  id: string;
  code: string;
  name: string;
  currency: string;
  fiscalYearStart?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  companyId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LoginCredentials {
  companyCode: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface AuthContextType {
  user: User | null;
  company: Company | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}
