'use client';

import React, { useState, useMemo } from 'react';
import styles from './ipsec-profiles-table.module.css';

// Icon Components
const ShieldIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const PlusIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const PencilIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const RefreshIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const ChevronUpIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
  </svg>
);

const ChevronDownIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

interface IPsecProfile {
  id: string;
  device_id: string;
  name: string;
  dh_group?: string;
  enc_algorithm?: string;
  hash_algorithm?: string;
  lifetime?: string;
  nat_traversal?: boolean;
  dpd_interval?: string;
  dpd_maximum_failures?: number;
  comment?: string;
  disabled?: boolean;
  ros_id?: string;
  created_at: string;
  updated_at: string;
}

interface IPsecProfilesTableProps {
  deviceId: string;
  profiles: IPsecProfile[];
  onRefresh: () => void;
  isLoading: boolean;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'rgba(17, 24, 39, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(var(--border-rgb), 0.3)',
        borderRadius: 'var(--space-3)',
        padding: 'var(--space-6)',
        maxWidth: '400px',
        width: '90%'
      }}>
        <h3 style={{ margin: '0 0 var(--space-3) 0', color: 'var(--text-primary)' }}>{title}</h3>
        <p style={{ margin: '0 0 var(--space-6) 0', color: 'var(--text-secondary)' }}>{message}</p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'transparent',
              border: '1px solid rgba(var(--border-rgb), 0.3)',
              borderRadius: 'var(--space-2)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: 'rgba(var(--error-rgb), 0.2)',
              border: '1px solid rgba(var(--error-rgb), 0.3)',
              borderRadius: 'var(--space-2)',
              color: 'var(--error)',
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

const ITEMS_PER_PAGE = 25;

export function IPsecProfilesTable({ deviceId, profiles, onRefresh, isLoading }: IPsecProfilesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof IPsecProfile>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProfile, setEditingProfile] = useState<IPsecProfile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; profile: IPsecProfile | null }>({
    show: false,
    profile: null
  });

  // Filter and sort profiles
  const filteredAndSortedProfiles = useMemo(() => {
    let filtered = profiles.filter(profile => {
      if (!searchTerm) return true;
      
      const searchLower = searchTerm.toLowerCase();
      return (
        profile.name?.toLowerCase().includes(searchLower) ||
        profile.enc_algorithm?.toLowerCase().includes(searchLower) ||
        profile.hash_algorithm?.toLowerCase().includes(searchLower) ||
        profile.dh_group?.toLowerCase().includes(searchLower) ||
        profile.lifetime?.toLowerCase().includes(searchLower) ||
        profile.dpd_interval?.toLowerCase().includes(searchLower) ||
        profile.comment?.toLowerCase().includes(searchLower)
      );
    });

    filtered.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];
      
      if (aVal === undefined || aVal === null) return 1;
      if (bVal === undefined || bVal === null) return -1;
      
      let comparison = 0;
      if (aVal < bVal) comparison = -1;
      if (aVal > bVal) comparison = 1;
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [profiles, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedProfiles.length / ITEMS_PER_PAGE);
  const paginatedProfiles = filteredAndSortedProfiles.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (column: keyof IPsecProfile) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const handleEdit = (profile: IPsecProfile) => {
    setEditingProfile(profile);
    setShowAddModal(true);
  };

  const handleDelete = (profile: IPsecProfile) => {
    setDeleteConfirm({ show: true, profile });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.profile) return;

    try {
      const response = await fetch(`/api/config/devices/${deviceId}/ipsec/profiles/${deleteConfirm.profile.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete profile');
      }

      onRefresh();
    } catch (error) {
      console.error('Error deleting profile:', error);
      alert(`Failed to delete profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeleteConfirm({ show: false, profile: null });
    }
  };

  const handleToggleEnabled = async (profile: IPsecProfile) => {
    try {
      const response = await fetch(`/api/config/devices/${deviceId}/ipsec/profiles/${profile.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          disabled: !profile.disabled
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to toggle profile');
      }

      onRefresh();
    } catch (error) {
      console.error('Error toggling profile:', error);
      alert(`Failed to toggle profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleModalSave = () => {
    setShowAddModal(false);
    setEditingProfile(null);
    onRefresh();
  };

  const getEncryptionColor = (algorithm?: string): string => {
    switch (algorithm?.toLowerCase()) {
      case 'aes-256':
        return 'var(--success)';
      case 'aes-128':
        return 'var(--primary)';
      case '3des':
        return 'var(--warning)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getHashColor = (algorithm?: string): string => {
    switch (algorithm?.toLowerCase()) {
      case 'sha256':
        return 'var(--success)';
      case 'sha1':
        return 'var(--warning)';
      case 'md5':
        return 'var(--error)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const formatLifetime = (lifetime?: string): string => {
    if (!lifetime) return '-';
    
    // Convert RouterOS time format to readable format
    const timeMap: { [key: string]: string } = {
      's': 'sec',
      'm': 'min',
      'h': 'hr',
      'd': 'day',
      'w': 'week'
    };
    
    return lifetime.replace(/([0-9]+)([smhdw])/g, (match, num, unit) => {
      return `${num} ${timeMap[unit]}${parseInt(num) > 1 ? 's' : ''}`;
    });
  };

  return (
    <div className={`card ${styles.card}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ShieldIcon style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
              IPsec Profiles
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Manage IPsec security profiles and encryption settings
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(var(--success-rgb), 0.2)',
              border: '1px solid rgba(var(--success-rgb), 0.3)',
              borderRadius: 'var(--space-2)',
              color: 'var(--success)',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--success-rgb), 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--success-rgb), 0.2)';
            }}
          >
            <PlusIcon style={{ width: '16px', height: '16px' }} />
            Add Profile
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search profiles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: '1',
              minWidth: '200px',
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--space-2)',
              color: 'var(--text-primary)',
              fontSize: '0.875rem',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              transition: 'all 0.2s ease'
            }}
          />
          <button
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
              border: '1px solid rgba(var(--primary-rgb), 0.3)',
              borderRadius: 'var(--space-2)',
              color: 'var(--primary)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '0.875rem',
              fontWeight: '500',
              opacity: isLoading ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshIcon style={{ width: '16px', height: '16px' }} />
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Table Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {isLoading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className={styles.spinner}></div>
          </div>
        ) : filteredAndSortedProfiles.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
            <ShieldIcon style={{ width: '48px', height: '48px', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
              {searchTerm ? 'No profiles found' : 'No IPsec profiles configured'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
              {searchTerm 
                ? `No profiles match "${searchTerm}". Try adjusting your search.`
                : 'Get started by adding your first IPsec security profile.'
              }
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.4)' }}>
                {([
                  { key: 'name', label: 'Name', sortable: true },
                  { key: 'enc_algorithm', label: 'Encryption', sortable: true },
                  { key: 'hash_algorithm', label: 'Hash', sortable: true },
                  { key: 'dh_group', label: 'DH Group', sortable: true },
                  { key: 'lifetime', label: 'Lifetime', sortable: true },
                  { key: 'nat_traversal', label: 'NAT-T', sortable: true },
                  { key: 'dpd_interval', label: 'DPD Interval', sortable: true },
                  { key: 'comment', label: 'Comment', sortable: true },
                  { key: 'actions', label: 'Actions', sortable: false }
                ] as const).map(({ key, label, sortable }) => (
                  <th
                    key={key}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      textAlign: 'left',
                      fontSize: '0.875rem',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      cursor: sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      position: 'relative'
                    }}
                    onClick={() => sortable && handleSort(key)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      {label}
                      {sortable && sortBy === key && (
                        sortOrder === 'asc' 
                          ? <ChevronUpIcon style={{ width: '14px', height: '14px' }} />
                          : <ChevronDownIcon style={{ width: '14px', height: '14px' }} />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedProfiles.map((profile) => (
                <tr 
                  key={profile.id}
                  style={{ 
                    borderBottom: '1px solid rgba(var(--border-rgb), 0.3)',
                    opacity: profile.disabled ? 0.6 : 1,
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)' }}>
                      {profile.name}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500',
                      color: getEncryptionColor(profile.enc_algorithm),
                      fontFamily: 'monospace'
                    }}>
                      {profile.enc_algorithm?.toUpperCase() || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500',
                      color: getHashColor(profile.hash_algorithm),
                      fontFamily: 'monospace'
                    }}>
                      {profile.hash_algorithm?.toUpperCase() || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {profile.dh_group || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {formatLifetime(profile.lifetime)}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      color: profile.nat_traversal ? 'var(--success)' : 'var(--text-secondary)'
                    }}>
                      {profile.nat_traversal ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {profile.dpd_interval || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {profile.comment || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <button
                        onClick={() => handleEdit(profile)}
                        style={{
                          padding: 'var(--space-1)',
                          backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                          border: '1px solid rgba(var(--primary-rgb), 0.3)',
                          borderRadius: 'var(--space-1)',
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease'
                        }}
                        title="Edit profile"
                      >
                        <PencilIcon style={{ width: '14px', height: '14px' }} />
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(profile)}
                        style={{
                          padding: 'var(--space-1) var(--space-2)',
                          backgroundColor: profile.disabled 
                            ? 'rgba(var(--success-rgb), 0.2)' 
                            : 'rgba(var(--warning-rgb), 0.2)',
                          border: profile.disabled 
                            ? '1px solid rgba(var(--success-rgb), 0.3)' 
                            : '1px solid rgba(var(--warning-rgb), 0.3)',
                          borderRadius: 'var(--space-1)',
                          color: profile.disabled ? 'var(--success)' : 'var(--warning)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          transition: 'all 0.2s ease'
                        }}
                        title={profile.disabled ? 'Enable profile' : 'Disable profile'}
                      >
                        {profile.disabled ? 'Enable' : 'Disable'}
                      </button>
                      <button
                        onClick={() => handleDelete(profile)}
                        style={{
                          padding: 'var(--space-1)',
                          backgroundColor: 'rgba(var(--error-rgb), 0.2)',
                          border: '1px solid rgba(var(--error-rgb), 0.3)',
                          borderRadius: 'var(--space-1)',
                          color: 'var(--error)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s ease'
                        }}
                        title="Delete profile"
                      >
                        <TrashIcon style={{ width: '14px', height: '14px' }} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ 
            padding: 'var(--space-4)', 
            borderTop: '1px solid rgba(var(--border-rgb), 0.3)',
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            backgroundColor: 'rgba(var(--border-rgb), 0.2)'
          }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedProfiles.length)} of {filteredAndSortedProfiles.length} profiles
            </span>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  borderRadius: 'var(--space-1)',
                  color: 'var(--text-primary)',
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  opacity: currentPage === 1 ? 0.5 : 1
                }}
              >
                Previous
              </button>
              <span style={{ 
                padding: 'var(--space-2) var(--space-3)', 
                fontSize: '0.875rem', 
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center'
              }}>
                {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  borderRadius: 'var(--space-1)',
                  color: 'var(--text-primary)',
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  fontSize: '0.875rem',
                  opacity: currentPage === totalPages ? 0.5 : 1
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAddModal && (
        <IPsecProfileModal
          deviceId={deviceId}
          profile={editingProfile || undefined}
          onClose={() => {
            setShowAddModal(false);
            setEditingProfile(null);
          }}
          onSave={handleModalSave}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Delete IPsec Profile"
        message={`Are you sure you want to delete the profile "${deleteConfirm.profile?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ show: false, profile: null })}
      />
    </div>
  );
}

interface IPsecProfileModalProps {
  deviceId: string;
  profile?: IPsecProfile;
  onClose: () => void;
  onSave: () => void;
}

function IPsecProfileModal({ deviceId, profile, onClose, onSave }: IPsecProfileModalProps) {
  const [formData, setFormData] = useState({
    name: profile?.name || '',
    dh_group: profile?.dh_group || 'modp2048',
    enc_algorithm: profile?.enc_algorithm || 'aes-256',
    hash_algorithm: profile?.hash_algorithm || 'sha256',
    lifetime: profile?.lifetime || '1d',
    nat_traversal: profile?.nat_traversal ?? true,
    dpd_interval: profile?.dpd_interval || '8s',
    dpd_maximum_failures: profile?.dpd_maximum_failures || 4,
    comment: profile?.comment || '',
    disabled: profile?.disabled ?? false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Profile name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const url = profile
        ? `/api/config/devices/${deviceId}/ipsec/profiles/${profile.id}`
        : `/api/config/devices/${deviceId}/ipsec/profiles`;
      
      const method = profile ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save profile');
      }

      onSave();
    } catch (error) {
      console.error('Error saving profile:', error);
      alert(`Failed to save profile: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        padding: 'var(--space-4)'
      }}
      onClick={onClose}
    >
      <div 
        className="card"
        style={{
          width: '100%',
          maxWidth: '600px',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 0
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div style={{
          padding: 'var(--space-6)',
          borderBottom: '1px solid rgba(var(--border-rgb), 0.3)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h3 style={{
            fontSize: 'var(--text-xl)',
            fontWeight: '600',
            color: 'var(--text-primary)',
            margin: 0
          }}>
            {profile ? 'Edit IPsec Profile' : 'Add IPsec Profile'}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-2xl)',
              cursor: 'pointer',
              padding: 'var(--space-1)',
              borderRadius: 'var(--radius-sm)',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.15)';
              e.currentTarget.style.color = 'var(--error)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            ×
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} style={{ padding: 'var(--space-6)' }}>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
            gap: 'var(--space-4)',
            marginBottom: 'var(--space-6)'
          }}>
            <div className="form-group">
              <label className="form-label">Profile Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter profile name"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Encryption Algorithm</label>
              <select
                value={formData.enc_algorithm}
                onChange={(e) => setFormData(prev => ({ ...prev, enc_algorithm: e.target.value }))}
                className="form-select"
              >
                <option value="aes-256">AES-256</option>
                <option value="aes-192">AES-192</option>
                <option value="aes-128">AES-128</option>
                <option value="3des">3DES</option>
                <option value="des">DES</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Hash Algorithm</label>
              <select
                value={formData.hash_algorithm}
                onChange={(e) => setFormData(prev => ({ ...prev, hash_algorithm: e.target.value }))}
                className="form-select"
              >
                <option value="sha256">SHA-256</option>
                <option value="sha1">SHA-1</option>
                <option value="md5">MD5</option>
                <option value="sha512">SHA-512</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">DH Group</label>
              <select
                value={formData.dh_group}
                onChange={(e) => setFormData(prev => ({ ...prev, dh_group: e.target.value }))}
                className="form-select"
              >
                <option value="modp2048">MODP-2048 (Group 14)</option>
                <option value="modp1536">MODP-1536 (Group 5)</option>
                <option value="modp1024">MODP-1024 (Group 2)</option>
                <option value="modp4096">MODP-4096 (Group 16)</option>
                <option value="ecp256">ECP-256 (Group 19)</option>
                <option value="ecp384">ECP-384 (Group 20)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Lifetime</label>
              <input
                type="text"
                value={formData.lifetime}
                onChange={(e) => setFormData(prev => ({ ...prev, lifetime: e.target.value }))}
                placeholder="1d, 8h, 3600s"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">DPD Interval</label>
              <input
                type="text"
                value={formData.dpd_interval}
                onChange={(e) => setFormData(prev => ({ ...prev, dpd_interval: e.target.value }))}
                placeholder="8s, 30s, 1m"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">DPD Max Failures</label>
              <input
                type="number"
                value={formData.dpd_maximum_failures}
                onChange={(e) => setFormData(prev => ({ ...prev, dpd_maximum_failures: parseInt(e.target.value) }))}
                min="1"
                max="20"
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-6)' }}>
            <label className="form-label">Comment</label>
            <input
              type="text"
              value={formData.comment}
              onChange={(e) => setFormData(prev => ({ ...prev, comment: e.target.value }))}
              placeholder="Optional description"
              className="form-input"
            />
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-6)' }}>
            <div className="form-check">
              <input
                type="checkbox"
                checked={formData.nat_traversal}
                onChange={(e) => setFormData(prev => ({ ...prev, nat_traversal: e.target.checked }))}
                className="form-check-input"
                id="nat-traversal"
              />
              <label htmlFor="nat-traversal" className="form-check-label">
                Enable NAT Traversal
              </label>
            </div>

            <div className="form-check">
              <input
                type="checkbox"
                checked={formData.disabled}
                onChange={(e) => setFormData(prev => ({ ...prev, disabled: e.target.checked }))}
                className="form-check-input"
                id="disabled"
              />
              <label htmlFor="disabled" className="form-check-label">
                Disabled
              </label>
            </div>
          </div>

          {/* Modal Footer */}
          <div style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--space-3)',
            borderTop: '1px solid rgba(var(--border-rgb), 0.3)',
            paddingTop: 'var(--space-4)',
            marginTop: 'var(--space-6)'
          }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary"
            >
              {isSubmitting ? 'Saving...' : 'Save Profile'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 