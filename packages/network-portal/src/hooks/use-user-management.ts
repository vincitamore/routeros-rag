import { useState, useCallback, useEffect } from 'react';
import {
  User,
  CreateUserRequest,
  UpdateUserRequest,
  ResetPasswordRequest,
  BulkUserOperation,
  UserFilters,
  UserStats,
  UsersResponse,
  UseUserManagementReturn,
} from '../types/user-management';

const API_BASE = '/api/admin';

export function useUserManagement(): UseUserManagementReturn {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 10,
    sort_by: 'username',
    sort_order: 'asc',
  });

  // API call helper
  const apiCall = useCallback(async (url: string, options: RequestInit = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }, []);

  // Fetch users with current filters
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });

      const response: UsersResponse = await apiCall(
        `${API_BASE}/users?${params.toString()}`
      );
      
      setUsers(response.users);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [filters, apiCall]);

  // Fetch user statistics
  const fetchStats = useCallback(async () => {
    try {
      const response: UserStats = await apiCall(`${API_BASE}/users/stats`);
      setStats(response);
    } catch (err) {
      console.error('Failed to fetch user stats:', err);
    }
  }, [apiCall]);

  // Create new user
  const createUser = useCallback(async (data: CreateUserRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      await apiCall(`${API_BASE}/users`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      // Refresh data
      await fetchUsers();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, fetchStats, apiCall]);

  // Update existing user
  const updateUser = useCallback(async (id: number, data: UpdateUserRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      await apiCall(`${API_BASE}/users/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
      
      // Update local state optimistically
      setUsers(prevUsers => 
        prevUsers.map(user => 
          user.id === id ? { ...user, ...data } : user
        )
      );
      
      // Refresh stats
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
      // Refresh on error to restore correct state
      await fetchUsers();
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, fetchStats, apiCall]);

  // Delete user
  const deleteUser = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    
    try {
      await apiCall(`${API_BASE}/users/${id}`, {
        method: 'DELETE',
      });
      
      // Update local state optimistically
      setUsers(prevUsers => prevUsers.filter(user => user.id !== id));
      setSelectedUsers(prevSelected => prevSelected.filter(user => user.id !== id));
      
      // Refresh stats
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      // Refresh on error to restore correct state
      await fetchUsers();
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, fetchStats, apiCall]);

  // Reset user password
  const resetPassword = useCallback(async (id: number, data: ResetPasswordRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      await apiCall(`${API_BASE}/users/${id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      
      // Refresh user data to get updated fields
      await fetchUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, apiCall]);

  // Bulk operations
  const bulkOperation = useCallback(async (operation: BulkUserOperation) => {
    setLoading(true);
    setError(null);
    
    try {
      await apiCall(`${API_BASE}/users/bulk`, {
        method: 'PUT',
        body: JSON.stringify(operation),
      });
      
      // Clear selection and refresh data
      setSelectedUsers([]);
      await fetchUsers();
      await fetchStats();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform bulk operation');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchUsers, fetchStats, apiCall]);

  // Filter management
  const updateFilters = useCallback((newFilters: Partial<UserFilters>) => {
    setFilters(prev => ({
      ...prev,
      ...newFilters,
      // Reset to first page when filters change (except when changing page)
      page: newFilters.page !== undefined ? newFilters.page : 1,
    }));
  }, []);

  // Selection management
  const toggleUserSelection = useCallback((user: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.id === user.id);
      if (isSelected) {
        return prev.filter(u => u.id !== user.id);
      } else {
        return [...prev, user];
      }
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedUsers([]);
  }, []);

  const selectAll = useCallback(() => {
    setSelectedUsers([...users]);
  }, [users]);

  // Load data on mount and when filters change
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Load stats on mount
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    users,
    loading,
    error,
    filters,
    stats,
    selectedUsers,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    bulkOperation,
    setFilters: updateFilters,
    toggleUserSelection,
    clearSelection,
    selectAll,
  };
} 