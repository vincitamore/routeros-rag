// User Management Frontend Types
export interface User {
  id: number;
  username: string;
  email: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  phone?: string;
  department?: string;
  notes?: string;
  account_status: AccountStatus;
  password_reset_required: boolean;
  last_password_change?: string;
  failed_login_attempts: number;
  account_locked_until?: string;
  email_verified: boolean;
  two_factor_enabled: boolean;
  avatar_url?: string;
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
  last_login?: string;
}

export type UserRole = 'admin' | 'operator' | 'user' | 'viewer';

export type AccountStatus = 'active' | 'inactive' | 'locked';

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  first_name?: string;
  last_name?: string;
  phone?: string;
  department?: string;
  notes?: string;
  account_status?: AccountStatus;
  password_reset_required?: boolean;
  email_verified?: boolean;
  two_factor_enabled?: boolean;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  role?: UserRole;
  first_name?: string;
  last_name?: string;
  phone?: string;
  department?: string;
  notes?: string;
  account_status?: AccountStatus;
  password_reset_required?: boolean;
  email_verified?: boolean;
  two_factor_enabled?: boolean;
  preferences?: Record<string, any>;
}

export interface ResetPasswordRequest {
  new_password: string;
  require_password_change?: boolean;
}

export interface BulkUserOperation {
  user_ids: number[];
  operation: BulkOperationType;
  data?: Record<string, any>;
}

export type BulkOperationType = 'activate' | 'deactivate' | 'lock' | 'unlock' | 'change_role' | 'delete';

export interface UserSession {
  id: string;
  user_id: number;
  device_info?: string;
  location?: string;
  ip_address?: string;
  user_agent?: string;
  is_active: boolean;
  created_at: string;
  last_activity: string;
  expires_at: string;
}

export interface UserStats {
  total_users: number;
  active_users: number;
  inactive_users: number;
  locked_users: number;
  users_by_role: Record<UserRole, number>;
  recent_signups: number;
  password_reset_required: number;
  two_factor_enabled: number;
}

export interface AuditLogEntry {
  id: number;
  admin_user_id: number;
  admin_username: string;
  target_user_id?: number;
  target_username?: string;
  action: string;
  details?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface AuditStats {
  total_actions: number;
  actions_by_type: Record<string, number>;
  actions_by_admin: Record<string, number>;
  recent_actions: number;
}

// Frontend-specific interfaces

export interface UserFilters {
  search?: string;
  role?: UserRole | 'all';
  status?: AccountStatus | 'all';
  department?: string;
  sort_by?: 'username' | 'email' | 'created_at' | 'last_login';
  sort_order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface UserTableProps {
  users: User[];
  loading: boolean;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onViewSessions: (user: User) => void;
  onResetPassword: (user: User) => void;
  onToggleStatus: (user: User) => void;
}

export interface UserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateUserRequest | UpdateUserRequest) => void;
  user?: User; // undefined for create, User for edit
  loading?: boolean;
}

export interface SessionManagementProps {
  userId: number;
  username: string;
  isOpen: boolean;
  onClose: () => void;
}

export interface AuditLogProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number; // undefined for all logs, number for user-specific
}

export interface BulkActionsProps {
  selectedUsers: User[];
  onBulkAction: (operation: BulkUserOperation) => void;
  onClearSelection: () => void;
}

// API Response Types

export interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

export interface SessionsResponse {
  sessions: UserSession[];
  total: number;
}

export interface AuditLogsResponse {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Form Validation Types

export interface UserFormErrors {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  department?: string;
}

export interface FormState<T> {
  data: T;
  errors: Record<string, string>;
  loading: boolean;
  touched: Record<string, boolean>;
}

// Hook Types

export interface UseUserManagementReturn {
  users: User[];
  loading: boolean;
  error: string | null;
  filters: UserFilters;
  stats: UserStats | null;
  selectedUsers: User[];
  
  // Actions
  fetchUsers: () => Promise<void>;
  createUser: (data: CreateUserRequest) => Promise<void>;
  updateUser: (id: number, data: UpdateUserRequest) => Promise<void>;
  deleteUser: (id: number) => Promise<void>;
  resetPassword: (id: number, data: ResetPasswordRequest) => Promise<void>;
  bulkOperation: (operation: BulkUserOperation) => Promise<void>;
  
  // Filters and selection
  setFilters: (filters: Partial<UserFilters>) => void;
  toggleUserSelection: (user: User) => void;
  clearSelection: () => void;
  selectAll: () => void;
}

export interface UseSessionManagementReturn {
  sessions: UserSession[];
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchSessions: (userId?: number) => Promise<void>;
  terminateSession: (sessionId: string) => Promise<void>;
  terminateAllSessions: (userId?: number) => Promise<void>;
}

export interface UseAuditLogsReturn {
  logs: AuditLogEntry[];
  loading: boolean;
  error: string | null;
  stats: AuditStats | null;
  filters: {
    action?: string;
    admin_user_id?: number;
    target_user_id?: number;
    start_date?: string;
    end_date?: string;
  };
  
  // Actions
  fetchLogs: () => Promise<void>;
  fetchStats: () => Promise<void>;
  setFilters: (filters: any) => void;
} 