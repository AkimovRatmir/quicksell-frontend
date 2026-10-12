import { apiClient } from './client';
import type {
  AdminOverview,
  AdminSellersResponse,
  AdminUserDetail,
  AdminUsersResponse,
  Plan,
} from '../types/api';

/** Все вызовы требуют JWT админа (role='admin'); бэкенд проверяет AdminGuard'ом. */
export const adminApi = {
  overview: () => apiClient.get<AdminOverview>('/admin/overview').then((r) => r.data),

  users: (params: { search?: string; plan?: Plan; page?: number; limit?: number }) =>
    apiClient.get<AdminUsersResponse>('/admin/users', { params }).then((r) => r.data),

  user: (id: string) =>
    apiClient.get<AdminUserDetail>(`/admin/users/${id}`).then((r) => r.data),

  setPlan: (id: string, plan: Plan) =>
    apiClient.patch(`/admin/users/${id}/plan`, { plan }).then((r) => r.data),

  sellers: (params: { status?: string; page?: number; limit?: number }) =>
    apiClient.get<AdminSellersResponse>('/admin/sellers', { params }).then((r) => r.data),
};
