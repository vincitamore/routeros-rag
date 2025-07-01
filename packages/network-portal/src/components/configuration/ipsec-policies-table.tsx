'use client';

import React, { useState, useMemo } from 'react';
import { CustomSelect } from '../ui/CustomSelect';
import { Tooltip } from '../ui/Tooltip';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import styles from './ipsec-policies-table.module.css';

// SVG Icons matching our design system
interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

const ShieldIcon = ({ className, style }: IconProps) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.618 5.984A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
  </svg>
);

const PlusIcon = ({ className, style }: IconProps) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
);

const PencilIcon = ({ className, style }: IconProps) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const TrashIcon = ({ className, style }: IconProps) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
);

const RefreshIcon = ({ className, style }: IconProps) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);

const EyeIcon = ({ className, style }: IconProps) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const EyeOffIcon = ({ className, style }: IconProps) => (
  <svg className={className} style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
  </svg>
);

interface IPsecPolicy {
  id: string;
  device_id: string;
  src_address?: string;
  dst_address?: string;
  protocol?: string;
  action?: string;
  tunnel?: boolean;
  peer_name?: string;
  proposal_name?: string;
  comment?: string;
  disabled?: boolean;
  ros_id?: string;
  ph2_state?: string; // Phase 2 state: 'established', 'no-phase2', 'connecting', etc.
  created_at: string;
  updated_at: string;
}

interface IPsecPoliciesTableProps {
  deviceId: string;
  policies: IPsecPolicy[];
  onRefresh: () => void;
  isLoading: boolean;
}

const ITEMS_PER_PAGE = 25;

export function IPsecPoliciesTable({ deviceId, policies, onRefresh, isLoading }: IPsecPoliciesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof IPsecPolicy>('ph2_state');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<IPsecPolicy | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; policy: IPsecPolicy | null }>({
    show: false,
    policy: null
  });

  // Filter and sort policies
  const filteredAndSortedPolicies = useMemo(() => {
    let filtered = policies.filter(policy => {
      if (!searchTerm) return true;
      
      const searchLower = searchTerm.toLowerCase();
      return (
        policy.src_address?.toLowerCase().includes(searchLower) ||
        policy.dst_address?.toLowerCase().includes(searchLower) ||
        policy.protocol?.toLowerCase().includes(searchLower) ||
        policy.action?.toLowerCase().includes(searchLower) ||
        policy.peer_name?.toLowerCase().includes(searchLower) ||
        policy.comment?.toLowerCase().includes(searchLower) ||
        policy.ph2_state?.toLowerCase().includes(searchLower)
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
  }, [policies, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedPolicies.length / ITEMS_PER_PAGE);
  const paginatedPolicies = filteredAndSortedPolicies.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (column: keyof IPsecPolicy) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const handleDelete = async (policy: IPsecPolicy) => {
    try {
      const response = await fetch(`/api/config/devices/${deviceId}/ipsec/policies/${policy.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete policy');
      }

      onRefresh();
      setDeleteConfirm({ show: false, policy: null });
    } catch (error) {
      console.error('Error deleting policy:', error);
      alert(`Failed to delete policy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleToggleEnabled = async (policy: IPsecPolicy) => {
    try {
      const response = await fetch(`/api/config/devices/${deviceId}/ipsec/policies/${policy.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          disabled: !policy.disabled
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to toggle policy');
      }

      onRefresh();
    } catch (error) {
      console.error('Error toggling policy:', error);
      alert(`Failed to toggle policy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getActionColor = (action?: string): string => {
    switch (action?.toLowerCase()) {
      case 'encrypt':
        return 'var(--success)';
      case 'decrypt':
        return 'var(--primary)';
      case 'discard':
        return 'var(--error)';
      default:
        return 'var(--text-primary)';
    }
  };

  const getPH2StateColor = (state?: string): string => {
    switch (state?.toLowerCase()) {
      case 'established':
        return 'var(--success)';
      case 'connecting':
      case 'installing':
        return 'var(--warning)';
      case 'no-phase2':
      case 'failed':
      case 'expired':
        return 'var(--error)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const formatPH2State = (state?: string): string => {
    if (!state) return 'Unknown';
    
    switch (state.toLowerCase()) {
      case 'established':
        return 'Established';
      case 'no-phase2':
        return 'No Phase 2';
      case 'connecting':
        return 'Connecting';
      case 'installing':
        return 'Installing';
      case 'failed':
        return 'Failed';
      case 'expired':
        return 'Expired';
      default:
        return state.charAt(0).toUpperCase() + state.slice(1);
    }
  };

  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return 'Invalid Date';
    }
  };

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <ShieldIcon style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
              IPsec Policies
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Manage IPsec security policies and traffic selectors
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
            Add Policy
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search policies..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--space-2)',
              color: 'rgb(var(--foreground-rgb))',
              fontSize: '0.875rem',
              backdropFilter: 'blur(12px)',
              outline: 'none',
              transition: 'all 0.2s ease-in-out'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
              e.target.style.backgroundColor = 'rgba(var(--border-rgb), 0.4)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(var(--border-rgb), 0.5)';
              e.target.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
            }}
          />

          <button
            onClick={onRefresh}
            disabled={isLoading}
            style={{
              padding: 'var(--space-2)',
              backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
              border: '1px solid rgba(var(--primary-rgb), 0.3)',
              borderRadius: 'var(--space-2)',
              color: 'var(--primary)',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={(e) => {
              if (!isLoading) {
                e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.3)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
            }}
          >
            <RefreshIcon 
              style={{ 
                width: '16px',
                height: '16px',
                transform: isLoading ? 'rotate(360deg)' : 'rotate(0deg)',
                transition: 'transform 0.5s ease-in-out'
              }}
            />
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {isLoading ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '200px',
            color: 'var(--text-secondary)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <div className={styles.spinner}></div>
              Loading policies...
            </div>
          </div>
        ) : paginatedPolicies.length === 0 ? (
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '200px',
            color: 'var(--text-secondary)',
            flexDirection: 'column',
            gap: 'var(--space-2)'
          }}>
            <ShieldIcon style={{ width: '48px', height: '48px', opacity: 0.5 }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '500', marginBottom: 'var(--space-1)' }}>
                No IPsec policies found
              </div>
              <div style={{ fontSize: '0.875rem' }}>
                {searchTerm ? 'No policies match your search criteria' : 'Create your first IPsec policy to get started'}
              </div>
            </div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.4)' }}>
                {([
                  { key: 'src_address', label: 'Source Address', sortable: true },
                  { key: 'dst_address', label: 'Destination Address', sortable: true },
                  { key: 'protocol', label: 'Protocol', sortable: true },
                  { key: 'action', label: 'Action', sortable: true },
                  { key: 'peer_name', label: 'Peer', sortable: true },
                  { key: 'tunnel', label: 'Tunnel', sortable: true },
                  { key: 'ph2_state', label: 'PH2 State', sortable: true },
                  { key: 'comment', label: 'Comment', sortable: true },
                  { key: 'actions', label: 'Actions', sortable: false }
                ] as const).map(({ key, label, sortable }) => (
                  <th
                    key={key}
                    onClick={() => sortable && handleSort(key as keyof IPsecPolicy)}
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      textAlign: 'left',
                      fontWeight: '600',
                      fontSize: '0.875rem',
                      color: 'var(--text-primary)',
                      cursor: sortable ? 'pointer' : 'default',
                      borderBottom: '1px solid rgba(var(--border-rgb), 0.3)',
                      transition: 'background-color 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      if (sortable) {
                        e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                      {label}
                      {sortBy === key && sortable && (
                        <svg 
                          width="12" 
                          height="12" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth={2} 
                          viewBox="0 0 24 24"
                          style={{ 
                            transform: sortOrder === 'asc' ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease-in-out'
                          }}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedPolicies.map((policy) => (
                <tr
                  key={policy.id}
                  style={{
                    borderBottom: '1px solid rgba(var(--border-rgb), 0.2)',
                    transition: 'background-color 0.2s ease-in-out',
                    opacity: policy.disabled ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {policy.src_address || 'Any'}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                      {policy.dst_address || 'Any'}
                    </div>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500',
                      textTransform: 'uppercase',
                      color: 'var(--text-primary)'
                    }}>
                      {policy.protocol || 'All'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500',
                      color: getActionColor(policy.action),
                      textTransform: 'capitalize'
                    }}>
                      {policy.action || 'None'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {policy.peer_name || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      color: policy.tunnel ? 'var(--success)' : 'var(--text-secondary)'
                    }}>
                      {policy.tunnel ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500',
                      color: getPH2StateColor(policy.ph2_state),
                      padding: 'var(--space-1) var(--space-2)',
                      backgroundColor: `${getPH2StateColor(policy.ph2_state)}15`,
                      borderRadius: 'var(--space-1)',
                      border: `1px solid ${getPH2StateColor(policy.ph2_state)}30`
                    }}>
                      {formatPH2State(policy.ph2_state)}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {policy.comment || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                      <Tooltip content={policy.disabled ? 'Enable policy' : 'Disable policy'}>
                        <button
                          onClick={() => handleToggleEnabled(policy)}
                          style={{
                            padding: 'var(--space-1)',
                            backgroundColor: policy.disabled 
                              ? 'rgba(var(--warning-rgb), 0.2)' 
                              : 'rgba(var(--success-rgb), 0.2)',
                            border: `1px solid ${policy.disabled 
                              ? 'rgba(var(--warning-rgb), 0.3)' 
                              : 'rgba(var(--success-rgb), 0.3)'}`,
                            borderRadius: 'var(--space-1)',
                            color: policy.disabled ? 'var(--warning)' : 'var(--success)',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          {policy.disabled ? (
                            <EyeOffIcon style={{ width: '16px', height: '16px' }} />
                          ) : (
                            <EyeIcon style={{ width: '16px', height: '16px' }} />
                          )}
                        </button>
                      </Tooltip>
                      <Tooltip content="Edit policy">
                        <button
                          onClick={() => setEditingPolicy(policy)}
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
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          <PencilIcon style={{ width: '16px', height: '16px' }} />
                        </button>
                      </Tooltip>
                      <Tooltip content="Delete policy">
                        <button
                          onClick={() => setDeleteConfirm({ show: true, policy })}
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
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          <TrashIcon style={{ width: '16px', height: '16px' }} />
                        </button>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ 
          padding: 'var(--space-3) var(--space-4)', 
          borderTop: '1px solid rgba(var(--border-rgb), 0.3)',
          backgroundColor: 'rgba(var(--border-rgb), 0.1)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1}-{Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedPolicies.length)} of {filteredAndSortedPolicies.length} policies
          </span>
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              style={{
                padding: 'var(--space-1) var(--space-2)',
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
              padding: 'var(--space-1) var(--space-2)', 
              fontSize: '0.875rem', 
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center'
            }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              style={{
                padding: 'var(--space-1) var(--space-2)',
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

      {/* Modals */}
      {showAddModal && (
        <IPsecPolicyModal
          deviceId={deviceId}
          onClose={() => setShowAddModal(false)}
          onSave={() => {
            setShowAddModal(false);
            onRefresh();
          }}
        />
      )}

      {editingPolicy && (
        <IPsecPolicyModal
          deviceId={deviceId}
          policy={editingPolicy}
          onClose={() => setEditingPolicy(null)}
          onSave={() => {
            setEditingPolicy(null);
            onRefresh();
          }}
        />
      )}

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Delete IPsec Policy"
        message={`Are you sure you want to delete this IPsec policy? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        onConfirm={() => deleteConfirm.policy && handleDelete(deleteConfirm.policy)}
        onCancel={() => setDeleteConfirm({ show: false, policy: null })}
      />
    </div>
  );
}

// Modal Component
interface IPsecPolicyModalProps {
  deviceId: string;
  policy?: IPsecPolicy;
  onClose: () => void;
  onSave: () => void;
}

function IPsecPolicyModal({ deviceId, policy, onClose, onSave }: IPsecPolicyModalProps) {
  const [formData, setFormData] = useState({
    src_address: policy?.src_address || '',
    dst_address: policy?.dst_address || '',
    protocol: policy?.protocol || 'all',
    action: policy?.action || 'encrypt',
    tunnel: policy?.tunnel ?? true,
    peer_name: policy?.peer_name || '',
    proposal_name: policy?.proposal_name || 'default',
    comment: policy?.comment || '',
    disabled: policy?.disabled ?? false
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const protocolOptions = [
    { value: 'all', label: 'All Protocols' },
    { value: 'tcp', label: 'TCP' },
    { value: 'udp', label: 'UDP' },
    { value: 'icmp', label: 'ICMP' },
    { value: 'esp', label: 'ESP' },
    { value: 'ah', label: 'AH' }
  ];

  const actionOptions = [
    { value: 'encrypt', label: 'Encrypt' },
    { value: 'decrypt', label: 'Decrypt' },
    { value: 'discard', label: 'Discard' }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const url = policy 
        ? `/api/config/devices/${deviceId}/ipsec/policies/${policy.id}`
        : `/api/config/devices/${deviceId}/ipsec/policies`;
      
      const method = policy ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save policy');
      }

      onSave();
    } catch (error) {
      console.error('Error saving policy:', error);
      alert(`Failed to save policy: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }} onClick={onClose}>
      <div style={{
        backgroundColor: 'rgba(var(--background-rgb), 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(var(--border-rgb), 0.8)',
        borderRadius: '12px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 20px 40px 0 rgba(0, 0, 0, 0.4)'
      }} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ 
          fontSize: '1.25rem', 
          fontWeight: '600', 
          marginBottom: '24px',
          color: 'var(--text-primary)',
          textAlign: 'center'
        }}>
          {policy ? 'Edit IPsec Policy' : 'Add IPsec Policy'}
        </h2>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              color: 'var(--text-primary)'
            }}>
              Source Address
            </label>
            <input
              type="text"
              value={formData.src_address}
              onChange={(e) => setFormData({ ...formData, src_address: e.target.value })}
              placeholder="e.g., 192.168.1.0/24 or leave empty for any"
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'rgba(var(--border-rgb), 0.4)',
                border: '1px solid rgba(var(--border-rgb), 0.6)',
                borderRadius: '8px',
                color: 'rgb(var(--foreground-rgb))',
                fontSize: '14px',
                backdropFilter: 'blur(8px)',
                outline: 'none',
                transition: 'all 0.2s ease-in-out'
              }}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              color: 'var(--text-primary)'
            }}>
              Destination Address
            </label>
            <input
              type="text"
              value={formData.dst_address}
              onChange={(e) => setFormData({ ...formData, dst_address: e.target.value })}
              placeholder="e.g., 10.0.0.0/24 or leave empty for any"
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'rgba(var(--border-rgb), 0.4)',
                border: '1px solid rgba(var(--border-rgb), 0.6)',
                borderRadius: '8px',
                color: 'rgb(var(--foreground-rgb))',
                fontSize: '14px',
                backdropFilter: 'blur(8px)',
                outline: 'none',
                transition: 'all 0.2s ease-in-out'
              }}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              color: 'var(--text-primary)'
            }}>
              Protocol
            </label>
            <CustomSelect
              options={protocolOptions}
              value={formData.protocol}
              onChange={(value) => setFormData({ ...formData, protocol: value })}
              placeholder="Select protocol..."
              portal={true}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              color: 'var(--text-primary)'
            }}>
              Action
            </label>
            <CustomSelect
              options={actionOptions}
              value={formData.action}
              onChange={(value) => setFormData({ ...formData, action: value })}
              placeholder="Select action..."
              portal={true}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              color: 'var(--text-primary)'
            }}>
              Peer Name
            </label>
            <input
              type="text"
              value={formData.peer_name}
              onChange={(e) => setFormData({ ...formData, peer_name: e.target.value })}
              placeholder="IPsec peer name"
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'rgba(var(--border-rgb), 0.4)',
                border: '1px solid rgba(var(--border-rgb), 0.6)',
                borderRadius: '8px',
                color: 'rgb(var(--foreground-rgb))',
                fontSize: '14px',
                backdropFilter: 'blur(8px)',
                outline: 'none',
                transition: 'all 0.2s ease-in-out'
              }}
            />
          </div>

          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '0.875rem', 
              fontWeight: '500',
              color: 'var(--text-primary)'
            }}>
              Comment
            </label>
            <input
              type="text"
              value={formData.comment}
              onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
              placeholder="Optional description"
              style={{
                width: '100%',
                padding: '12px 16px',
                backgroundColor: 'rgba(var(--border-rgb), 0.4)',
                border: '1px solid rgba(var(--border-rgb), 0.6)',
                borderRadius: '8px',
                color: 'rgb(var(--foreground-rgb))',
                fontSize: '14px',
                backdropFilter: 'blur(8px)',
                outline: 'none',
                transition: 'all 0.2s ease-in-out'
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.tunnel}
                onChange={(e) => setFormData({ ...formData, tunnel: e.target.checked })}
                style={{ accentColor: 'var(--primary)' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Tunnel Mode</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.disabled}
                onChange={(e) => setFormData({ ...formData, disabled: e.target.checked })}
                style={{ accentColor: 'var(--warning)' }}
              />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>Disabled</span>
            </label>
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px 24px',
                backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                border: '1px solid rgba(var(--border-rgb), 0.5)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                flex: 1,
                padding: '12px 24px',
                backgroundColor: 'var(--success)',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                opacity: isSubmitting ? 0.7 : 1,
                transition: 'all 0.2s ease-in-out'
              }}
            >
              {isSubmitting ? 'Saving...' : (policy ? 'Update Policy' : 'Create Policy')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 