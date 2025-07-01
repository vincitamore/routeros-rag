import React from 'react';
import { UserFilters, UserRole, AccountStatus } from '../../../types/user-management';
import { CustomSelect } from '../../ui/CustomSelect';

interface UserFiltersProps {
  filters: UserFilters;
  onFiltersChange: (filters: Partial<UserFilters>) => void;
  totalUsers: number;
  selectedCount: number;
}

export function UserFiltersComponent({ 
  filters, 
  onFiltersChange, 
  totalUsers, 
  selectedCount 
}: UserFiltersProps) {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ search: e.target.value, page: 1 });
  };

  const handleRoleChange = (value: string) => {
    onFiltersChange({ 
      role: value === 'all' ? undefined : value as UserRole,
      page: 1 
    });
  };

  const handleStatusChange = (value: string) => {
    onFiltersChange({ 
      status: value === 'all' ? undefined : value as AccountStatus,
      page: 1 
    });
  };

  const handleSortChange = (value: string) => {
    const [sort_by, sort_order] = value.split(':') as ['username' | 'email' | 'created_at' | 'last_login_at', 'asc' | 'desc'];
    onFiltersChange({ sort_by, sort_order, page: 1 });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      role: undefined,
      status: undefined,
      sort_by: 'username',
      sort_order: 'asc',
      page: 1
    });
  };

  const hasActiveFilters = filters.search || filters.role || filters.status;

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      {/* Search Bar */}
      <div style={{ marginBottom: 'var(--space-4)' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <input
            type="text"
            placeholder="Search users by name, email, or username..."
            value={filters.search || ''}
            onChange={handleSearchChange}
            style={{
              width: '100%',
              paddingTop: 'var(--space-3)',
              paddingBottom: 'var(--space-3)',
              paddingLeft: 'var(--space-10)',
              paddingRight: 'var(--space-4)',
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--space-2)',
              color: 'rgb(var(--foreground-rgb))',
              fontSize: '0.875rem',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              outline: 'none',
              transition: 'all 0.2s ease-in-out'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
              e.target.style.boxShadow = '0 0 0 3px rgba(var(--primary-rgb), 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(var(--border-rgb), 0.5)';
              e.target.style.boxShadow = 'none';
            }}
          />
          <div style={{
            position: 'absolute',
            left: 'var(--space-3)',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'rgb(var(--secondary-rgb))'
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
        </div>
      </div>

      {/* Filter Controls */}
      <div style={{ 
        display: 'flex', 
        gap: 'var(--space-4)', 
        alignItems: 'center',
        flexWrap: 'wrap'
      }}>
        {/* Role Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: '140px' }}>
          <label style={{ 
            fontSize: '0.75rem', 
            fontWeight: '500', 
            color: 'rgb(var(--foreground-rgb))',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Role
          </label>
          <CustomSelect
            value={filters.role || 'all'}
            onChange={handleRoleChange}
            options={[
              { value: 'all', label: 'All Roles' },
              { value: 'admin', label: 'Admin' },
              { value: 'operator', label: 'Operator' },
              { value: 'user', label: 'User' },
              { value: 'viewer', label: 'Viewer' }
            ]}
            portal={true}
          />
        </div>

        {/* Status Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: '140px' }}>
          <label style={{ 
            fontSize: '0.75rem', 
            fontWeight: '500', 
            color: 'rgb(var(--foreground-rgb))',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Status
          </label>
          <CustomSelect
            value={filters.status || 'all'}
            onChange={handleStatusChange}
            options={[
              { value: 'all', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'locked', label: 'Locked' }
            ]}
            portal={true}
          />
        </div>

        {/* Sort Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)', minWidth: '180px' }}>
          <label style={{ 
            fontSize: '0.75rem', 
            fontWeight: '500', 
            color: 'rgb(var(--foreground-rgb))',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Sort By
          </label>
          <CustomSelect
            value={`${filters.sort_by || 'username'}:${filters.sort_order || 'asc'}`}
            onChange={handleSortChange}
            options={[
              { value: 'username:asc', label: 'Username (A-Z)' },
              { value: 'username:desc', label: 'Username (Z-A)' },
              { value: 'email:asc', label: 'Email (A-Z)' },
              { value: 'email:desc', label: 'Email (Z-A)' },
              { value: 'created_at:desc', label: 'Newest First' },
              { value: 'created_at:asc', label: 'Oldest First' },
              { value: 'last_login_at:desc', label: 'Last Login (Recent)' },
              { value: 'last_login_at:asc', label: 'Last Login (Oldest)' }
            ]}
            portal={true}
          />
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
            <div style={{ height: '1.25rem' }}></div> {/* Spacer to align with other controls */}
            <button
              onClick={clearFilters}
              style={{
                paddingTop: 'var(--space-2)',
                paddingBottom: 'var(--space-2)',
                paddingLeft: 'var(--space-3)',
                paddingRight: 'var(--space-3)',
                backgroundColor: 'rgba(var(--secondary-rgb), 0.2)',
                border: '1px solid rgba(var(--secondary-rgb), 0.3)',
                borderRadius: 'var(--space-2)',
                color: 'rgb(var(--secondary-rgb))',
                fontSize: '0.875rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(var(--secondary-rgb), 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(var(--secondary-rgb), 0.2)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Results Summary */}
      <div style={{ 
        marginTop: 'var(--space-4)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        fontSize: '0.875rem',
        color: 'rgb(var(--secondary-rgb))'
      }}>
        <div>
          Showing {totalUsers} user{totalUsers !== 1 ? 's' : ''}
          {hasActiveFilters && ' (filtered)'}
        </div>
        {selectedCount > 0 && (
          <div style={{ 
            paddingTop: 'var(--space-1)',
            paddingBottom: 'var(--space-1)',
            paddingLeft: 'var(--space-2)',
            paddingRight: 'var(--space-2)',
            backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
            border: '1px solid rgba(var(--primary-rgb), 0.3)',
            borderRadius: 'var(--space-1)',
            color: 'rgb(var(--primary-rgb))',
            fontSize: '0.75rem',
            fontWeight: '500'
          }}>
            {selectedCount} selected
          </div>
        )}
      </div>
    </div>
  );
} 