'use client';

import React, { useState } from 'react';
import { ConfigurationModal } from './configuration-modal';

interface AddressListEntry {
  '.id': string;
  list: string;
  address: string;
  comment?: string;
  disabled?: string;
  dynamic?: string;
}

interface AddressListsTableProps {
  deviceId: string;
  addressLists: AddressListEntry[];
  onRefresh: () => void;
  isLoading?: boolean;
}

export function AddressListsTable({ deviceId, addressLists, onRefresh, isLoading = false }: AddressListsTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedList, setSelectedList] = useState<string>('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete'>('add');
  const [editingItem, setEditingItem] = useState<AddressListEntry | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get unique list names for filtering
  const uniqueLists = [...new Set(addressLists.map(entry => entry.list))].sort();

  const openModal = (type: 'add' | 'edit' | 'delete', item?: AddressListEntry) => {
    setModalType(type);
    setEditingItem(item || null);
    setShowModal(true);
    
    if (type === 'add') {
      setFormData({ 
        list: selectedList || 'default',
        address: '',
        comment: '' 
      });
    } else if (type === 'edit' && item) {
      setFormData({ ...item });
    } else {
      setFormData({});
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingItem(null);
    setFormData({});
    setIsSubmitting(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      let response;
      
      if (modalType === 'add') {
        response = await fetch(`/api/config/devices/${deviceId}/address-lists`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else if (modalType === 'edit' && editingItem) {
        response = await fetch(`/api/config/devices/${deviceId}/address-lists/${editingItem['.id']}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (response && response.ok) {
        closeModal();
        onRefresh();
      } else {
        throw new Error(`Failed to ${modalType} address list entry`);
      }
    } catch (error) {
      console.error(`Error ${modalType}ing address list entry:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/config/devices/${deviceId}/address-lists/${editingItem['.id']}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        closeModal();
        onRefresh();
      } else {
        throw new Error('Failed to delete address list entry');
      }
    } catch (error) {
      console.error('Error deleting address list entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredData = addressLists.filter(entry => {
    const matchesSearch = !searchTerm || 
      entry.list?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.comment?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesList = !selectedList || entry.list === selectedList;
    
    return matchesSearch && matchesList;
  });

  const getModalTitle = () => {
    switch (modalType) {
      case 'add': return 'Add Address List Entry';
      case 'edit': return 'Edit Address List Entry';
      case 'delete': return 'Delete Address List Entry';
      default: return '';
    }
  };

  const getListStats = () => {
    const stats = uniqueLists.map(listName => ({
      name: listName,
      count: addressLists.filter(entry => entry.list === listName).length
    }));
    return stats;
  };

  return (
    <>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, color: 'rgb(var(--foreground-rgb))' }}>Address Lists</h2>
          <button 
            className="btn"
            onClick={() => openModal('add')}
            disabled={isLoading}
            style={{
              backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
              border: '1px solid rgba(var(--primary-rgb), 0.5)',
              color: 'rgb(var(--primary-rgb))',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--space-2)',
              fontSize: '0.875rem',
              fontWeight: '500',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease-in-out',
              opacity: isLoading ? 0.6 : 1
            }}
          >
            Add Entry
          </button>
        </div>

        {/* Stats Summary */}
        {uniqueLists.length > 0 && (
          <div style={{ 
            display: 'flex', 
            gap: 'var(--space-2)', 
            marginBottom: 'var(--space-4)', 
            flexWrap: 'wrap' 
          }}>
            {getListStats().map(stat => (
              <div
                key={stat.name}
                style={{
                  backgroundColor: selectedList === stat.name ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(var(--border-rgb), 0.3)',
                  border: `1px solid ${selectedList === stat.name ? 'rgba(var(--primary-rgb), 0.5)' : 'rgba(var(--border-rgb), 0.5)'}`,
                  borderRadius: 'var(--space-2)',
                  padding: 'var(--space-2) var(--space-3)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  backdropFilter: 'blur(12px)'
                }}
                onClick={() => setSelectedList(selectedList === stat.name ? '' : stat.name)}
              >
                <div style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: selectedList === stat.name ? 'rgb(var(--primary-rgb))' : 'rgb(var(--foreground-rgb))' 
                }}>
                  {stat.name}
                </div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--text-secondary)' 
                }}>
                  {stat.count} entries
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search and Filter Controls */}
        <div style={{ display: 'flex', gap: 'var(--space-4)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          <input 
            type="text"
            placeholder="Search address lists..."
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
              backdropFilter: 'blur(12px)'
            }}
          />
          {selectedList && (
            <button
              onClick={() => setSelectedList('')}
              style={{
                backgroundColor: 'rgba(var(--text-secondary-rgb), 0.2)',
                border: '1px solid rgba(var(--text-secondary-rgb), 0.5)',
                color: 'var(--text-secondary)',
                padding: 'var(--space-2) var(--space-3)',
                borderRadius: 'var(--space-2)',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out'
              }}
            >
              Clear Filter
            </button>
          )}
        </div>
        
        {filteredData.length === 0 ? (
          <div style={{
            backgroundColor: 'rgba(var(--border-rgb), 0.3)',
            border: '1px solid rgba(var(--border-rgb), 0.5)',
            borderRadius: 'var(--space-3)',
            padding: 'var(--space-6)',
            textAlign: 'center',
            backdropFilter: 'blur(12px)'
          }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {isLoading ? 'Loading address lists...' : 
               selectedList ? `No entries found in list "${selectedList}"` : 'No address list entries found'}
            </p>
          </div>
        ) : (
          <div style={{
            backgroundColor: 'rgba(var(--border-rgb), 0.3)',
            border: '1px solid rgba(var(--border-rgb), 0.5)',
            borderRadius: 'var(--space-3)',
            overflow: 'hidden',
            backdropFilter: 'blur(12px)'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.5)' }}>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>List Name</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Address</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Comment</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((entry, index) => (
                  <tr key={entry['.id']} style={{ 
                    borderTop: index > 0 ? '1px solid rgba(var(--border-rgb), 0.3)' : 'none',
                    opacity: entry.disabled === 'true' ? 0.6 : 1
                  }}>
                    <td style={{ padding: 'var(--space-3)', color: 'rgb(var(--foreground-rgb))', fontSize: '0.875rem' }}>
                      <span style={{
                        backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                        border: '1px solid rgba(var(--primary-rgb), 0.5)',
                        color: 'rgb(var(--primary-rgb))',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {entry.list}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'rgb(var(--foreground-rgb))', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                      {entry.address}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                      {entry.comment || '-'}
                    </td>
                    <td style={{ padding: 'var(--space-3)', fontSize: '0.75rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: entry.disabled === 'true' ? 'var(--error)' : 
                                          entry.dynamic === 'true' ? 'var(--warning)' : 'var(--success)'
                        }} />
                        <span style={{ 
                          color: entry.disabled === 'true' ? 'var(--error)' : 
                                 entry.dynamic === 'true' ? 'var(--warning)' : 'var(--success)'
                        }}>
                          {entry.disabled === 'true' ? 'Disabled' : 
                           entry.dynamic === 'true' ? 'Dynamic' : 'Active'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                        <button
                          onClick={() => openModal('edit', entry)}
                          disabled={entry.dynamic === 'true'}
                          style={{
                            backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                            border: '1px solid rgba(var(--primary-rgb), 0.5)',
                            color: 'rgb(var(--primary-rgb))',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: entry.dynamic === 'true' ? 'not-allowed' : 'pointer',
                            opacity: entry.dynamic === 'true' ? 0.5 : 1,
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openModal('delete', entry)}
                          disabled={entry.dynamic === 'true'}
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            color: 'rgb(239, 68, 68)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: entry.dynamic === 'true' ? 'not-allowed' : 'pointer',
                            opacity: entry.dynamic === 'true' ? 0.5 : 1,
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      <ConfigurationModal
        isOpen={showModal}
        onClose={closeModal}
        title={getModalTitle()}
        onSubmit={modalType === 'delete' ? handleDelete : handleSubmit}
        isSubmitting={isSubmitting}
        submitLabel={modalType === 'delete' ? 'Delete' : (modalType === 'edit' ? 'Update' : 'Add')}
        submitStyle={modalType === 'delete' ? 'danger' : 'primary'}
      >
        {modalType === 'delete' ? (
          <div>
            <p>Are you sure you want to delete this address list entry?</p>
            <div style={{
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--space-2)',
              padding: 'var(--space-3)',
              marginTop: 'var(--space-3)',
              fontFamily: 'monospace',
              fontSize: '0.875rem'
            }}>
              <strong>List:</strong> {editingItem?.list}<br />
              <strong>Address:</strong> {editingItem?.address}<br />
              {editingItem?.comment && <><strong>Comment:</strong> {editingItem.comment}</>}
            </div>
            <p style={{ marginTop: 'var(--space-3)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              This action cannot be undone.
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                List Name *
              </label>
              <input
                type="text"
                value={formData.list || ''}
                onChange={(e) => setFormData({ ...formData, list: e.target.value })}
                placeholder="Enter list name (e.g., internal, external, blocked)"
                required
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  borderRadius: 'var(--space-2)',
                  color: 'rgb(var(--foreground-rgb))',
                  fontSize: '0.875rem'
                }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                Common list names: internal, external, blocked, allowed, vpn-clients
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                Address *
              </label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="192.168.1.0/24 or 10.0.0.1 or example.com"
                required
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  borderRadius: 'var(--space-2)',
                  color: 'rgb(var(--foreground-rgb))',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace'
                }}
              />
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                Supports IP addresses, CIDR blocks, and domain names
              </div>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                Comment
              </label>
              <input
                type="text"
                value={formData.comment || ''}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                placeholder="Optional description for this entry"
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  borderRadius: 'var(--space-2)',
                  color: 'rgb(var(--foreground-rgb))',
                  fontSize: '0.875rem'
                }}
              />
            </div>
          </div>
        )}
      </ConfigurationModal>
    </>
  );
} 