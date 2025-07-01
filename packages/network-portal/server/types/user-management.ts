export interface User {
  id: string;
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  department?: string;
  notes?: string;
  role: 'admin' | 'operator' | 'user' | 'viewer';
  account_status: 'active' | 'inactive' | 'locked';
  password_reset_required: boolean;
  last_password_change?: string;
  failed_login_attempts: number;
  account_locked_until?: string;
  email_verified: boolean;
  two_factor_enabled: boolean;
  avatar_url?: string;
  preferences?: string;
  created_at: string;
  updated_at: string;
  last_login?: string;
  is_active: boolean;
}

export interface CreateUserRequest {
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  department?: string;
  notes?: string;
  role: 'admin' | 'operator' | 'user' | 'viewer';
  password: string;
  password_reset_required?: boolean;
}

export interface UpdateUserRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  department?: string;
  notes?: string;
  role?: 'admin' | 'operator' | 'user' | 'viewer';
  account_status?: 'active' | 'inactive' | 'locked';
  password_reset_required?: boolean;
}

export interface UserFilters {
  search?: string;
  role?: string;
  account_status?: string;
  department?: string;
  created_after?: string;
  created_before?: string;
  last_login_after?: string;
  last_login_before?: string;
}

export interface UserSession {
  id: string;
  user_id: string;
  device_info?: string;
  location?: string;
  ip_address?: string;
  user_agent?: string;
  is_active: boolean;
  created_at: string;
  expires_at: string;
}

export interface AuditLog {
  id: number;
  admin_user_id: string;
  admin_username: string;
  target_user_id?: string;
  target_username?: string;
  action: string;
  details?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  locked_users: number;
  users_by_role: Record<string, number>;
  recent_signups: number;
  password_reset_required: number;
  two_factor_enabled: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
} 