import React from 'react';
import { User, UserRole, AccountStatus } from '../../../types/user-management';
import { CustomCheckbox } from '../../ui/CustomCheckbox';
import { Tooltip } from '../../ui/Tooltip';

interface UserTableProps {
  users: User[];
  loading: boolean;
  selectedUsers: User[];
  onUserSelect: (user: User) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  onViewSessions: (user: User) => void;
  onResetPassword: (user: User) => void;
  onToggleStatus: (user: User) => void;
}

export function UserTable({
  users,
  loading,
  selectedUsers,
  onUserSelect,
  onSelectAll,
  onClearSelection,
  onEdit,
  onDelete,
  onViewSessions,
  onResetPassword,
  onToggleStatus,
}: UserTableProps) {
  const isAllSelected = users.length > 0 && selectedUsers.length === users.length;
  const isPartialSelected = selectedUsers.length > 0 && selectedUsers.length < users.length;

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return 'rgb(var(--error-rgb))'; // Error red for admin
      case 'operator':
        return 'rgb(var(--warning-rgb))'; // Warning amber for operator
      case 'user':
        return 'rgb(var(--primary-rgb))'; // Primary indigo for user
      case 'viewer':
        return 'rgb(var(--secondary-rgb))'; // Secondary gray for viewer
      default:
        return 'rgb(var(--secondary-rgb))';
    }
  };

  const getStatusBadgeColor = (status: AccountStatus) => {
    switch (status) {
      case 'active':
        return 'rgb(var(--success-rgb))'; // Success green for active
      case 'inactive':
        return 'rgb(var(--secondary-rgb))'; // Secondary gray for inactive
      case 'locked':
        return 'rgb(var(--error-rgb))'; // Error red for locked
      default:
        return 'rgb(var(--secondary-rgb))';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="card" style={{ textAlign: 'center', paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-8)' }}>
        <div style={{ fontSize: '0.875rem', color: 'rgb(var(--secondary-rgb))' }}>
          Loading users...
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.4)' }}>
            <th style={{ 
              paddingTop: 'var(--space-3)', 
              paddingBottom: 'var(--space-3)', 
              paddingLeft: 'var(--space-4)', 
              paddingRight: 'var(--space-2)',
              textAlign: 'left',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'rgb(var(--foreground-rgb))',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              <CustomCheckbox
                checked={isAllSelected}
                indeterminate={isPartialSelected}
                onChange={isAllSelected ? () => onClearSelection() : () => onSelectAll()}
              />
            </th>
            <th style={{ 
              paddingTop: 'var(--space-3)', 
              paddingBottom: 'var(--space-3)', 
              paddingLeft: 'var(--space-2)', 
              paddingRight: 'var(--space-2)',
              textAlign: 'left',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'rgb(var(--foreground-rgb))',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              User
            </th>
            <th style={{ 
              paddingTop: 'var(--space-3)', 
              paddingBottom: 'var(--space-3)', 
              paddingLeft: 'var(--space-2)', 
              paddingRight: 'var(--space-2)',
              textAlign: 'left',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'rgb(var(--foreground-rgb))',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Role
            </th>
            <th style={{ 
              paddingTop: 'var(--space-3)', 
              paddingBottom: 'var(--space-3)', 
              paddingLeft: 'var(--space-2)', 
              paddingRight: 'var(--space-2)',
              textAlign: 'left',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'rgb(var(--foreground-rgb))',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Status
            </th>
            <th style={{ 
              paddingTop: 'var(--space-3)', 
              paddingBottom: 'var(--space-3)', 
              paddingLeft: 'var(--space-2)', 
              paddingRight: 'var(--space-2)',
              textAlign: 'left',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'rgb(var(--foreground-rgb))',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Last Login
            </th>
            <th style={{ 
              paddingTop: 'var(--space-3)', 
              paddingBottom: 'var(--space-3)', 
              paddingLeft: 'var(--space-2)', 
              paddingRight: 'var(--space-4)',
              textAlign: 'right',
              fontSize: '0.75rem',
              fontWeight: '600',
              color: 'rgb(var(--foreground-rgb))',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {users.length === 0 ? (
            <tr>
              <td 
                colSpan={6} 
                style={{ 
                  paddingTop: 'var(--space-8)', 
                  paddingBottom: 'var(--space-8)',
                  textAlign: 'center',
                  fontSize: '0.875rem',
                  color: 'rgb(var(--secondary-rgb))'
                }}
              >
                No users found
              </td>
            </tr>
          ) : (
            users.map((user) => {
              const isSelected = selectedUsers.some(u => u.id === user.id);
              return (
                <tr
                  key={user.id}
                  style={{
                    backgroundColor: isSelected ? 'rgba(var(--primary-rgb), 0.1)' : 'transparent',
                    borderTop: '1px solid rgba(var(--border-rgb), 0.5)',
                    transition: 'all 0.2s ease-in-out',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <td style={{ 
                    paddingTop: 'var(--space-3)', 
                    paddingBottom: 'var(--space-3)', 
                    paddingLeft: 'var(--space-4)', 
                    paddingRight: 'var(--space-2)' 
                  }}>
                    <CustomCheckbox
                      checked={isSelected}
                      onChange={() => onUserSelect(user)}
                    />
                  </td>
                  <td style={{ 
                    paddingTop: 'var(--space-3)', 
                    paddingBottom: 'var(--space-3)', 
                    paddingLeft: 'var(--space-2)', 
                    paddingRight: 'var(--space-2)' 
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                        {user.first_name && user.last_name 
                          ? `${user.first_name} ${user.last_name}` 
                          : user.username
                        }
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'rgb(var(--secondary-rgb))' }}>
                        {user.email}
                      </div>
                      {user.username !== user.email && (
                        <div style={{ fontSize: '0.75rem', color: 'rgb(var(--secondary-rgb))', fontFamily: 'monospace' }}>
                          @{user.username}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ 
                    paddingTop: 'var(--space-3)', 
                    paddingBottom: 'var(--space-3)', 
                    paddingLeft: 'var(--space-2)', 
                    paddingRight: 'var(--space-2)' 
                  }}>
                    <span style={{
                      display: 'inline-block',
                      paddingTop: 'var(--space-1)',
                      paddingBottom: 'var(--space-1)',
                      paddingLeft: 'var(--space-2)',
                      paddingRight: 'var(--space-2)',
                      fontSize: '0.75rem',
                      fontWeight: '500',
                      color: 'white',
                      backgroundColor: getRoleBadgeColor(user.role),
                      borderRadius: 'var(--space-1)',
                      textTransform: 'capitalize'
                    }}>
                      {user.role}
                    </span>
                  </td>
                  <td style={{ 
                    paddingTop: 'var(--space-3)', 
                    paddingBottom: 'var(--space-3)', 
                    paddingLeft: 'var(--space-2)', 
                    paddingRight: 'var(--space-2)' 
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                      <span style={{
                        display: 'inline-block',
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: getStatusBadgeColor(user.account_status)
                      }} />
                      <span style={{
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        color: getStatusBadgeColor(user.account_status),
                        textTransform: 'capitalize'
                      }}>
                        {user.account_status}
                      </span>
                    </div>
                  </td>
                  <td style={{ 
                    paddingTop: 'var(--space-3)', 
                    paddingBottom: 'var(--space-3)', 
                    paddingLeft: 'var(--space-2)', 
                    paddingRight: 'var(--space-2)' 
                  }}>
                    <div style={{ fontSize: '0.75rem', color: 'rgb(var(--secondary-rgb))' }}>
                      {formatDate(user.last_login)}
                    </div>
                  </td>
                  <td style={{ 
                    paddingTop: 'var(--space-3)', 
                    paddingBottom: 'var(--space-3)', 
                    paddingLeft: 'var(--space-2)', 
                    paddingRight: 'var(--space-4)' 
                  }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                      {/* Edit Button - Primary Action */}
                      <Tooltip content="Edit User">
                        <button
                          onClick={() => onEdit(user)}
                          style={{
                            padding: '8px',
                            backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                            border: '1px solid rgba(var(--primary-rgb), 0.3)',
                            borderRadius: '6px',
                            color: 'rgb(var(--primary-rgb))',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '32px',
                            minHeight: '32px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--primary-rgb), 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                      </Tooltip>

                      {/* Sessions Button - Info Action */}
                      <Tooltip content="View Active Sessions">
                        <button
                          onClick={() => onViewSessions(user)}
                          style={{
                            padding: '8px',
                            backgroundColor: 'rgba(var(--secondary-rgb), 0.1)',
                            border: '1px solid rgba(var(--secondary-rgb), 0.3)',
                            borderRadius: '6px',
                            color: 'rgb(var(--secondary-rgb))',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '32px',
                            minHeight: '32px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(var(--secondary-rgb), 0.2)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--secondary-rgb), 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(var(--secondary-rgb), 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="20" height="14" x="2" y="3" rx="2" ry="2" />
                            <line x1="8" y1="21" x2="16" y2="21" />
                            <line x1="12" y1="17" x2="12" y2="21" />
                          </svg>
                        </button>
                      </Tooltip>

                      {/* Reset Password Button - Security Action */}
                      <Tooltip content="Reset User Password">
                        <button
                          onClick={() => onResetPassword(user)}
                          style={{
                            padding: '8px',
                            backgroundColor: 'rgba(var(--error-rgb), 0.1)',
                            border: '1px solid rgba(var(--error-rgb), 0.3)',
                            borderRadius: '6px',
                            color: 'rgb(var(--error-rgb))',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '32px',
                            minHeight: '32px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.2)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--error-rgb), 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="m15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4" />
                            <path d="m21 2-9.6 9.6" />
                            <circle cx="7.5" cy="15.5" r="5.5" />
                          </svg>
                        </button>
                      </Tooltip>

                      {/* Toggle Status Button - Dynamic Color */}
                      <Tooltip content={user.account_status === 'active' ? 'Lock User Account' : 'Unlock User Account'}>
                        <button
                          onClick={() => onToggleStatus(user)}
                          style={{
                            padding: '8px',
                            backgroundColor: user.account_status === 'active' 
                              ? 'rgba(var(--warning-rgb), 0.1)' 
                              : 'rgba(var(--success-rgb), 0.1)',
                            border: user.account_status === 'active' 
                              ? '1px solid rgba(var(--warning-rgb), 0.3)' 
                              : '1px solid rgba(var(--success-rgb), 0.3)',
                            borderRadius: '6px',
                            color: user.account_status === 'active' 
                              ? 'rgb(var(--warning-rgb))' 
                              : 'rgb(var(--success-rgb))',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '32px',
                            minHeight: '32px'
                          }}
                          onMouseEnter={(e) => {
                            const isActive = user.account_status === 'active';
                            e.currentTarget.style.backgroundColor = isActive 
                              ? 'rgba(var(--warning-rgb), 0.2)' 
                              : 'rgba(var(--success-rgb), 0.2)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = isActive
                              ? '0 4px 12px rgba(var(--warning-rgb), 0.2)'
                              : '0 4px 12px rgba(var(--success-rgb), 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            const isActive = user.account_status === 'active';
                            e.currentTarget.style.backgroundColor = isActive 
                              ? 'rgba(var(--warning-rgb), 0.1)' 
                              : 'rgba(var(--success-rgb), 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                        {user.account_status === 'active' ? (
                          // Lock icon - to lock the account
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        ) : (
                          // Unlock icon - to unlock the account
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                          </svg>
                        )}
                      </button>
                      </Tooltip>

                      {/* Delete Button - Danger Action */}
                      <Tooltip content="Delete User">
                        <button
                          onClick={() => onDelete(user)}
                          style={{
                            padding: '8px',
                            backgroundColor: 'rgba(var(--error-rgb), 0.1)',
                            border: '1px solid rgba(var(--error-rgb), 0.3)',
                            borderRadius: '6px',
                            color: 'rgb(var(--error-rgb))',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            minWidth: '32px',
                            minHeight: '32px'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.2)';
                            e.currentTarget.style.transform = 'translateY(-1px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(var(--error-rgb), 0.2)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.1)';
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M3 6h18" />
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
} 