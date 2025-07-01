'use client';

import React, { useState } from 'react';
import { AppLayout } from '../../../components/layout/app-layout';
import { UserTable } from '../../../components/admin/user-management/user-table';
import { UserFiltersComponent } from '../../../components/admin/user-management/user-filters';
import { AddUserModal } from '../../../components/admin/user-management/add-user-modal';
import { EditUserModal } from '../../../components/admin/user-management/edit-user-modal';
import { SessionManagementModal } from '../../../components/admin/user-management/session-management-modal';
import { PasswordResetModal } from '../../../components/admin/user-management/password-reset-modal';
import { useUserManagement } from '../../../hooks/use-user-management';
import { User, CreateUserRequest, UpdateUserRequest } from '../../../types/user-management';

export default function UserManagementPage() {
  const {
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
    setFilters,
    toggleUserSelection,
    clearSelection,
    selectAll,
  } = useUserManagement();

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [showEditUserModal, setShowEditUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState<User | null>(null);

  const handleAddUser = () => {
    setShowAddUserModal(true);
  };

  const handleCreateUser = async (userData: CreateUserRequest) => {
    setIsCreatingUser(true);
    try {
      await createUser(userData);
      setShowAddUserModal(false);
    } catch (error) {
      console.error('Failed to create user:', error);
      throw error; // Re-throw to let the modal handle the error
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser(user);
    setShowEditUserModal(true);
  };

  const handleUpdateUser = async (id: number, userData: UpdateUserRequest) => {
    setIsUpdatingUser(true);
    try {
      await updateUser(id, userData);
      setShowEditUserModal(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Failed to update user:', error);
      throw error; // Re-throw to let the modal handle the error
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleDeleteUser = (user: User) => {
    setDeletingUser(user);
    setShowDeleteConfirm(true);
  };

  const handleViewSessions = (user: User) => {
    setSessionUser(user);
    setShowSessionModal(true);
  };

  const handleResetPassword = (user: User) => {
    setPasswordResetUser(user);
    setShowPasswordResetModal(true);
  };

  const handlePasswordResetSuccess = () => {
    // Refresh user data to get updated fields
    // The hook will automatically refetch users
    fetchUsers();
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = user.account_status === 'active' ? 'inactive' : 'active';
      await updateUser(user.id, { account_status: newStatus });
    } catch (error) {
      console.error('Failed to toggle user status:', error);
    }
  };

  const confirmDelete = async () => {
    if (deletingUser) {
      try {
        await deleteUser(deletingUser.id);
        setShowDeleteConfirm(false);
        setDeletingUser(null);
      } catch (error) {
        console.error('Failed to delete user:', error);
      }
    }
  };

  return (
    <AppLayout>
      <div style={{ 
        paddingLeft: 'var(--space-6)', 
        paddingRight: 'var(--space-6)', 
        paddingBottom: 'var(--space-6)', 
        paddingTop: 'var(--space-4)' 
      }}>
        {/* Page Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'flex-start',
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
          gap: 'var(--space-4)'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '1.875rem', 
              fontWeight: '700', 
              color: 'var(--text-primary)', 
              marginBottom: 'var(--space-2)',
              margin: 0
            }}>
              User Management
            </h1>
            <p style={{ 
              fontSize: '0.9rem', 
              color: 'var(--text-secondary)',
              margin: 0
            }}>
              Manage user accounts, roles, and permissions for the RouterOS Network Portal.
            </p>
          </div>

          <button
            onClick={handleAddUser}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              paddingTop: 'var(--space-3)',
              paddingBottom: 'var(--space-3)',
              paddingLeft: 'var(--space-4)',
              paddingRight: 'var(--space-4)',
              backgroundColor: 'rgb(var(--primary-rgb))',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--space-2)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              whiteSpace: 'nowrap'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.9)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgb(var(--primary-rgb))';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <line x1="19" y1="8" x2="19" y2="14" />
              <line x1="22" y1="11" x2="16" y2="11" />
            </svg>
            Add User
          </button>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)' 
          }}>
            <div className="card" style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-4)', paddingLeft: 'var(--space-4)', paddingRight: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: '500', 
                    color: 'var(--text-secondary)',
                    margin: 0,
                    marginBottom: 'var(--space-1)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Total Users
                  </p>
                  <p style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: '700', 
                    margin: 0,
                    color: 'rgb(var(--primary-rgb))' 
                  }}>
                    {stats?.total_users || 0}
                  </p>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--space-2)',
                  backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                  flexShrink: 0
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgb(var(--primary-rgb))' }}>
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="card" style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-4)', paddingLeft: 'var(--space-4)', paddingRight: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: '500', 
                    color: 'var(--text-secondary)',
                    margin: 0,
                    marginBottom: 'var(--space-1)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Active Users
                  </p>
                  <p style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: '700', 
                    margin: 0,
                    color: 'rgb(var(--success-rgb))' 
                  }}>
                    {stats?.active_users || 0}
                  </p>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--space-2)',
                  backgroundColor: 'rgba(var(--success-rgb), 0.1)',
                  flexShrink: 0
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgb(var(--success-rgb))' }}>
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="card" style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-4)', paddingLeft: 'var(--space-4)', paddingRight: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: '500', 
                    color: 'var(--text-secondary)',
                    margin: 0,
                    marginBottom: 'var(--space-1)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Admin Users
                  </p>
                  <p style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: '700', 
                    margin: 0,
                    color: 'rgb(var(--error-rgb))' 
                  }}>
                    {stats?.users_by_role?.admin || 0}
                  </p>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--space-2)',
                  backgroundColor: 'rgba(var(--error-rgb), 0.1)',
                  flexShrink: 0
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgb(var(--error-rgb))' }}>
                    <path d="M12 15l2 5 3-13-10 8z" />
                  </svg>
                </div>
              </div>
            </div>

            <div className="card" style={{ paddingTop: 'var(--space-4)', paddingBottom: 'var(--space-4)', paddingLeft: 'var(--space-4)', paddingRight: 'var(--space-4)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ 
                    fontSize: '0.75rem', 
                    fontWeight: '500', 
                    color: 'var(--text-secondary)',
                    margin: 0,
                    marginBottom: 'var(--space-1)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em'
                  }}>
                    Recent Signups
                  </p>
                  <p style={{ 
                    fontSize: '1.5rem', 
                    fontWeight: '700', 
                    margin: 0,
                    color: 'rgb(var(--warning-rgb))' 
                  }}>
                    {stats?.recent_signups || 0}
                  </p>
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '32px',
                  height: '32px',
                  borderRadius: 'var(--space-2)',
                  backgroundColor: 'rgba(var(--warning-rgb), 0.1)',
                  flexShrink: 0
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgb(var(--warning-rgb))' }}>
                    <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedUsers.length > 0 && (
          <div style={{
            marginBottom: 'var(--space-4)',
            paddingTop: 'var(--space-3)',
            paddingBottom: 'var(--space-3)',
            paddingLeft: 'var(--space-4)',
            paddingRight: 'var(--space-4)',
            backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
            border: '1px solid rgba(var(--primary-rgb), 0.3)',
            borderRadius: 'var(--space-2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 'var(--space-3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--primary-rgb))' }}>
                {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
              </span>
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={clearSelection}
                style={{
                  paddingTop: 'var(--space-2)',
                  paddingBottom: 'var(--space-2)',
                  paddingLeft: 'var(--space-3)',
                  paddingRight: 'var(--space-3)',
                  backgroundColor: 'rgba(var(--secondary-rgb), 0.2)',
                  border: '1px solid rgba(var(--secondary-rgb), 0.3)',
                  borderRadius: 'var(--space-1)',
                  color: 'rgb(var(--secondary-rgb))',
                  fontSize: '0.75rem',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--secondary-rgb), 0.3)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--secondary-rgb), 0.2)';
                }}
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div style={{
            marginBottom: 'var(--space-4)',
            paddingTop: 'var(--space-3)',
            paddingBottom: 'var(--space-3)',
            paddingLeft: 'var(--space-4)',
            paddingRight: 'var(--space-4)',
            backgroundColor: 'rgba(var(--error-rgb), 0.1)',
            border: '1px solid rgba(var(--error-rgb), 0.3)',
            borderRadius: 'var(--space-2)',
            color: 'rgb(var(--error-rgb))',
            fontSize: '0.875rem'
          }}>
            {error}
          </div>
        )}

        {/* Filters */}
        <UserFiltersComponent
          filters={filters}
          onFiltersChange={setFilters}
          totalUsers={users.length}
          selectedCount={selectedUsers.length}
        />

        {/* User Table */}
        <UserTable
          users={users}
          loading={loading}
          selectedUsers={selectedUsers}
          onUserSelect={toggleUserSelection}
          onSelectAll={selectAll}
          onClearSelection={clearSelection}
          onEdit={handleEditUser}
          onDelete={handleDeleteUser}
          onViewSessions={handleViewSessions}
          onResetPassword={handleResetPassword}
          onToggleStatus={handleToggleStatus}
        />

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && deletingUser && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-4)'
          }}>
            <div style={{
              maxWidth: '400px',
              width: '100%',
              padding: 'var(--space-6)',
              backgroundColor: 'rgba(var(--background-rgb), 0.95)',
              border: '1px solid rgba(var(--border-rgb), 0.8)',
              borderRadius: 'var(--space-3)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              boxShadow: '0 20px 40px 0 rgba(0, 0, 0, 0.4)'
            }}>
              <div style={{ textAlign: 'center', marginBottom: 'var(--space-4)' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(var(--error-rgb), 0.1)',
                  margin: '0 auto var(--space-3)'
                }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'rgb(var(--error-rgb))' }}>
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                  Delete User
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                  Are you sure you want to delete <strong>{deletingUser.username}</strong>? This action cannot be undone.
                </p>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingUser(null);
                  }}
                  style={{
                    flex: 1,
                    paddingTop: 'var(--space-3)',
                    paddingBottom: 'var(--space-3)',
                    paddingLeft: 'var(--space-4)',
                    paddingRight: 'var(--space-4)',
                    backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                    border: '1px solid rgba(var(--border-rgb), 0.5)',
                    borderRadius: 'var(--space-2)',
                    color: 'var(--text-primary)',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  style={{
                    flex: 1,
                    paddingTop: 'var(--space-3)',
                    paddingBottom: 'var(--space-3)',
                    paddingLeft: 'var(--space-4)',
                    paddingRight: 'var(--space-4)',
                    backgroundColor: 'rgb(var(--error-rgb))',
                    border: 'none',
                    borderRadius: 'var(--space-2)',
                    color: 'white',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.9)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgb(var(--error-rgb))';
                  }}
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add User Modal */}
        <AddUserModal
          isOpen={showAddUserModal}
          onClose={() => setShowAddUserModal(false)}
          onSubmit={handleCreateUser}
          loading={isCreatingUser}
        />

        {/* Edit User Modal */}
        <EditUserModal
          isOpen={showEditUserModal}
          user={editingUser}
          onClose={() => {
            setShowEditUserModal(false);
            setEditingUser(null);
          }}
          onSubmit={handleUpdateUser}
          loading={isUpdatingUser}
        />

        {/* Session Management Modal */}
        {sessionUser && (
          <SessionManagementModal
            user={sessionUser}
            isOpen={showSessionModal}
            onClose={() => {
              setShowSessionModal(false);
              setSessionUser(null);
            }}
          />
        )}

        {/* Password Reset Modal */}
        {passwordResetUser && (
          <PasswordResetModal
            user={passwordResetUser}
            isOpen={showPasswordResetModal}
            onClose={() => {
              setShowPasswordResetModal(false);
              setPasswordResetUser(null);
            }}
            onSuccess={handlePasswordResetSuccess}
          />
        )}
      </div>
    </AppLayout>
  );
} 