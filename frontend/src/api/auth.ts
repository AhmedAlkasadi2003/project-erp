import { apiClient } from './client';
import { AuthResponse, LoginCredentials, User, Company } from '../types';

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  return apiClient<AuthResponse>('auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

export async function getMe(): Promise<User> {
  return apiClient<User>('auth/me');
}

export async function getCurrentCompany(): Promise<Company> {
  return apiClient<Company>('companies/current');
}
