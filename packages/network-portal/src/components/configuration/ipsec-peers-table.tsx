'use client';

import React, { useState, useMemo } from 'react';
import styles from './ipsec-peers-table.module.css';

// Icon Components
const UsersIcon = ({ style }: { style?: React.CSSProperties }) => (
  <svg style={style} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
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

interface IPsecPeer {
  id: string;
  device_id: string;
  name: string;
  address?: string;
  local_address?: string;
  exchange_mode?: string;
  profile_name?: string;
  passive?: boolean;
  comment?: string;
  disabled?: boolean;
  ros_id?: string;
  created_at: string;
  updated_at: string;
}

interface IPsecPeersTableProps {
  deviceId: string;
  peers: IPsecPeer[];
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

export function IPsecPeersTable({ deviceId, peers, onRefresh, isLoading }: IPsecPeersTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<keyof IPsecPeer>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPeer, setEditingPeer] = useState<IPsecPeer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; peer: IPsecPeer | null }>({
    show: false,
    peer: null
  });

  // Filter and sort peers
  const filteredAndSortedPeers = useMemo(() => {
    let filtered = peers.filter(peer => {
      if (!searchTerm) return true;
      
      const searchLower = searchTerm.toLowerCase();
      return (
        peer.name?.toLowerCase().includes(searchLower) ||
        peer.address?.toLowerCase().includes(searchLower) ||
        peer.local_address?.toLowerCase().includes(searchLower) ||
        peer.exchange_mode?.toLowerCase().includes(searchLower) ||
        peer.profile_name?.toLowerCase().includes(searchLower) ||
        peer.comment?.toLowerCase().includes(searchLower)
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
  }, [peers, searchTerm, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedPeers.length / ITEMS_PER_PAGE);
  const paginatedPeers = filteredAndSortedPeers.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handleSort = (column: keyof IPsecPeer) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const handleEdit = (peer: IPsecPeer) => {
    setEditingPeer(peer);
    setShowAddModal(true);
  };

  const handleDelete = (peer: IPsecPeer) => {
    setDeleteConfirm({ show: true, peer });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm.peer) return;

    try {
      const response = await fetch(`/api/config/devices/${deviceId}/ipsec/peers/${deleteConfirm.peer.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete peer');
      }

      onRefresh();
    } catch (error) {
      console.error('Error deleting peer:', error);
      alert(`Failed to delete peer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setDeleteConfirm({ show: false, peer: null });
    }
  };

  const handleToggleEnabled = async (peer: IPsecPeer) => {
    try {
      const response = await fetch(`/api/config/devices/${deviceId}/ipsec/peers/${peer.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          disabled: !peer.disabled
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to toggle peer');
      }

      onRefresh();
    } catch (error) {
      console.error('Error toggling peer:', error);
      alert(`Failed to toggle peer: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleModalSave = () => {
    setShowAddModal(false);
    setEditingPeer(null);
    onRefresh();
  };

  const getExchangeModeColor = (mode?: string): string => {
    switch (mode?.toLowerCase()) {
      case 'main':
        return 'var(--primary)';
      case 'aggressive':
        return 'var(--warning)';
      case 'ike2':
        return 'var(--success)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const formatExchangeMode = (mode?: string): string => {
    if (!mode) return 'Unknown';
    
    switch (mode.toLowerCase()) {
      case 'main':
        return 'Main Mode';
      case 'aggressive':
        return 'Aggressive';
      case 'ike2':
        return 'IKEv2';
      default:
        return mode.charAt(0).toUpperCase() + mode.slice(1);
    }
  };

  return (
    <div className={`card ${styles.card}`} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: 'var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <UsersIcon style={{ width: '20px', height: '20px', color: 'var(--primary)' }} />
              IPsec Peers
            </h2>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Manage IPsec peer connections and remote endpoints
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
            Add Peer
          </button>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search peers..."
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
        ) : filteredAndSortedPeers.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-8)' }}>
            <UsersIcon style={{ width: '48px', height: '48px', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }} />
            <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', margin: '0 0 var(--space-2) 0' }}>
              {searchTerm ? 'No peers found' : 'No IPsec peers configured'}
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
              {searchTerm 
                ? `No peers match "${searchTerm}". Try adjusting your search.`
                : 'Get started by adding your first IPsec peer connection.'
              }
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.4)' }}>
                {([
                  { key: 'name', label: 'Name', sortable: true },
                  { key: 'address', label: 'Remote Address', sortable: true },
                  { key: 'local_address', label: 'Local Address', sortable: true },
                  { key: 'exchange_mode', label: 'Exchange Mode', sortable: true },
                  { key: 'profile_name', label: 'Profile', sortable: true },
                  { key: 'passive', label: 'Passive', sortable: true },
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
              {paginatedPeers.map((peer) => (
                <tr 
                  key={peer.id}
                  style={{ 
                    borderBottom: '1px solid rgba(var(--border-rgb), 0.3)',
                    opacity: peer.disabled ? 0.6 : 1,
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
                      {peer.name}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                      {peer.address || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {peer.local_address || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      fontWeight: '500',
                      color: getExchangeModeColor(peer.exchange_mode)
                    }}>
                      {formatExchangeMode(peer.exchange_mode)}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                      {peer.profile_name || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ 
                      fontSize: '0.875rem', 
                      color: peer.passive ? 'var(--warning)' : 'var(--text-secondary)'
                    }}>
                      {peer.passive ? 'Yes' : 'No'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {peer.comment || '-'}
                    </span>
                  </td>
                  <td style={{ padding: 'var(--space-3) var(--space-4)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      <button
                        onClick={() => handleEdit(peer)}
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
                        title="Edit peer"
                      >
                        <PencilIcon style={{ width: '14px', height: '14px' }} />
                      </button>
                      <button
                        onClick={() => handleToggleEnabled(peer)}
                        style={{
                          padding: 'var(--space-1) var(--space-2)',
                          backgroundColor: peer.disabled 
                            ? 'rgba(var(--success-rgb), 0.2)' 
                            : 'rgba(var(--warning-rgb), 0.2)',
                          border: peer.disabled 
                            ? '1px solid rgba(var(--success-rgb), 0.3)' 
                            : '1px solid rgba(var(--warning-rgb), 0.3)',
                          borderRadius: 'var(--space-1)',
                          color: peer.disabled ? 'var(--success)' : 'var(--warning)',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          transition: 'all 0.2s ease'
                        }}
                        title={peer.disabled ? 'Enable peer' : 'Disable peer'}
                      >
                        {peer.disabled ? 'Enable' : 'Disable'}
                      </button>
                      <button
                        onClick={() => handleDelete(peer)}
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
                        title="Delete peer"
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
              Showing {((currentPage - 1) * ITEMS_PER_PAGE) + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredAndSortedPeers.length)} of {filteredAndSortedPeers.length} peers
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
         <IPsecPeerModal
           deviceId={deviceId}
           peer={editingPeer || undefined}
           onClose={() => {
             setShowAddModal(false);
             setEditingPeer(null);
           }}
           onSave={handleModalSave}
         />
       )}

      <ConfirmDialog
        isOpen={deleteConfirm.show}
        title="Delete IPsec Peer"
        message={`Are you sure you want to delete the peer "${deleteConfirm.peer?.name}"? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteConfirm({ show: false, peer: null })}
      />
    </div>
  );
}

interface IPsecPeerModalProps {
  deviceId: string;
  peer?: IPsecPeer;
  onClose: () => void;
  onSave: () => void;
}

function IPsecPeerModal({ deviceId, peer, onClose, onSave }: IPsecPeerModalProps) {
  const [formData, setFormData] = useState({
    name: peer?.name || '',
    address: peer?.address || '',
    local_address: peer?.local_address || '',
    exchange_mode: peer?.exchange_mode || 'ikev2',
    passive: peer?.passive ?? false,
    profile_name: peer?.profile_name || '',
    comment: peer?.comment || '',
    disabled: peer?.disabled ?? false,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      alert('Peer name is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const url = peer
        ? `/api/config/devices/${deviceId}/ipsec/peers/${peer.id}`
        : `/api/config/devices/${deviceId}/ipsec/peers`;
      
      const method = peer ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save peer');
      }

      onSave();
    } catch (error) {
      console.error('Error saving peer:', error);
      alert(`Failed to save peer: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            {peer ? 'Edit IPsec Peer' : 'Add IPsec Peer'}
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
              <label className="form-label">Peer Name *</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter peer name"
                className="form-input"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Remote Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Remote peer IP address"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Local Address</label>
              <input
                type="text"
                value={formData.local_address}
                onChange={(e) => setFormData(prev => ({ ...prev, local_address: e.target.value }))}
                placeholder="Local IP address (optional)"
                className="form-input"
              />
            </div>

            <div className="form-group">
              <label className="form-label">Exchange Mode</label>
              <select
                value={formData.exchange_mode}
                onChange={(e) => setFormData(prev => ({ ...prev, exchange_mode: e.target.value }))}
                className="form-select"
              >
                <option value="ikev2">IKEv2</option>
                <option value="ikev1">IKEv1</option>
                <option value="aggressive">Aggressive</option>
                <option value="main">Main</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Profile Name</label>
              <input
                type="text"
                value={formData.profile_name}
                onChange={(e) => setFormData(prev => ({ ...prev, profile_name: e.target.value }))}
                placeholder="IPsec profile name"
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
                checked={formData.passive}
                onChange={(e) => setFormData(prev => ({ ...prev, passive: e.target.checked }))}
                className="form-check-input"
                id="passive"
              />
              <label htmlFor="passive" className="form-check-label">
                Passive Mode
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
              {isSubmitting ? 'Saving...' : 'Save Peer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 