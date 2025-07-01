'use client';

import React, { useState, useEffect } from 'react';
import { ConfigurationModal } from './configuration-modal';
import { CustomSelect, SelectOption } from '../ui/CustomSelect';

interface IPAddress {
  '.id': string;
  address: string;
  network: string;
  interface: string;
  invalid?: string;
  dynamic?: string;
  disabled?: string;
}

interface IPAddressTableProps {
  deviceId: string;
  ipAddresses: IPAddress[];
  onRefresh: () => void;
  isLoading?: boolean;
}

export function IPAddressTable({ deviceId, ipAddresses, onRefresh, isLoading = false }: IPAddressTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete'>('add');
  const [editingItem, setEditingItem] = useState<IPAddress | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [interfaces, setInterfaces] = useState<SelectOption[]>([]);
  const [loadingInterfaces, setLoadingInterfaces] = useState(false);

  // Fetch available interfaces
  const fetchInterfaces = async () => {
    setLoadingInterfaces(true);
    try {
      const response = await fetch(`/api/devices/${deviceId}/interfaces`);
      if (response.ok) {
        const data = await response.json();
        const interfaceOptions: SelectOption[] = data.interfaces.map((iface: any) => ({
          value: iface.name,
          label: `${iface.name} (${iface.type})`,
          disabled: iface.disabled === 'true'
        }));
        setInterfaces(interfaceOptions);
      }
    } catch (error) {
      console.error('Error fetching interfaces:', error);
    } finally {
      setLoadingInterfaces(false);
    }
  };

  // Fetch interfaces when component mounts
  useEffect(() => {
    fetchInterfaces();
  }, [deviceId]);

  const openModal = (type: 'add' | 'edit' | 'delete', item?: IPAddress) => {
    setModalType(type);
    setEditingItem(item || null);
    setShowModal(true);
    
    if (type === 'add') {
      setFormData({ address: '', interface: '', comment: '' });
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
        response = await fetch(`/api/config/devices/${deviceId}/ip-addresses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else if (modalType === 'edit' && editingItem) {
        response = await fetch(`/api/config/devices/${deviceId}/ip-addresses/${editingItem['.id']}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (response && response.ok) {
        closeModal();
        onRefresh();
      } else {
        throw new Error(`Failed to ${modalType} IP address`);
      }
    } catch (error) {
      console.error(`Error ${modalType}ing IP address:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/config/devices/${deviceId}/ip-addresses/${editingItem['.id']}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        closeModal();
        onRefresh();
      } else {
        throw new Error('Failed to delete IP address');
      }
    } catch (error) {
      console.error('Error deleting IP address:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredData = ipAddresses.filter(ip => 
    !searchTerm || 
    ip.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ip.interface?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getModalTitle = () => {
    switch (modalType) {
      case 'add': return 'Add IP Address';
      case 'edit': return 'Edit IP Address';
      case 'delete': return 'Delete IP Address';
      default: return '';
    }
  };

  return (
    <>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, color: 'rgb(var(--foreground-rgb))' }}>IP Addresses</h2>
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
            Add IP Address
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <input 
            type="text"
            placeholder="Search IP addresses..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '300px',
              padding: 'var(--space-2) var(--space-3)',
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--space-2)',
              color: 'rgb(var(--foreground-rgb))',
              fontSize: '0.875rem',
              backdropFilter: 'blur(12px)'
            }}
          />
        </div>
        
        {filteredData.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)' }}>
            <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24" style={{ margin: '0 auto var(--space-4)', color: 'rgba(var(--secondary-rgb), 0.6)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 14.25h13.5m-13.5 0a3 3 0 01-3-3V6.75a3 3 0 013-3h13.5a3 3 0 013 3v4.5a3 3 0 01-3 3m-13.5 0h13.5m-13.5 0v5.25A2.25 2.25 0 007.5 21.75h9a2.25 2.25 0 002.25-2.25v-5.25" />
            </svg>
            <p style={{ color: 'rgba(var(--secondary-rgb), 0.8)', fontSize: '1rem', margin: 0 }}>
              {searchTerm ? 'No IP addresses match your search' : 'No IP addresses configured'}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.4)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Address
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Network
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Interface
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Status
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((ip) => (
                  <tr 
                    key={ip['.id']}
                    style={{
                      transition: 'all 0.2s ease-in-out',
                      cursor: 'pointer'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'rgb(var(--foreground-rgb))' }}>
                      {ip.address}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'rgba(var(--secondary-rgb), 0.9)' }}>
                      {ip.network}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', fontSize: '0.875rem', color: 'rgba(var(--secondary-rgb), 0.9)' }}>
                      {ip.interface}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
                      <span 
                        style={{
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: 'var(--space-1)',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: ip.disabled === 'true' ? 'rgba(var(--error-rgb), 0.2)' : ip.dynamic === 'true' ? 'rgba(var(--warning-rgb), 0.2)' : 'rgba(var(--success-rgb), 0.2)',
                          color: ip.disabled === 'true' ? 'rgb(var(--error-rgb))' : ip.dynamic === 'true' ? 'rgb(var(--warning-rgb))' : 'rgb(var(--success-rgb))',
                          border: `1px solid ${ip.disabled === 'true' ? 'rgba(var(--error-rgb), 0.5)' : ip.dynamic === 'true' ? 'rgba(var(--warning-rgb), 0.5)' : 'rgba(var(--success-rgb), 0.5)'}`
                        }}
                      >
                        {ip.disabled === 'true' ? 'Disabled' : ip.dynamic === 'true' ? 'Dynamic' : 'Static'}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => openModal('edit', ip)}
                          style={{
                            backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                            border: '1px solid rgba(var(--primary-rgb), 0.5)',
                            color: 'rgb(var(--primary-rgb))',
                            padding: 'var(--space-1) var(--space-2)',
                            borderRadius: 'var(--space-1)',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          Edit
                        </button>
                        <button 
                          onClick={() => openModal('delete', ip)}
                          style={{
                            backgroundColor: 'rgba(var(--error-rgb), 0.2)',
                            border: '1px solid rgba(var(--error-rgb), 0.5)',
                            color: 'rgb(var(--error-rgb))',
                            padding: 'var(--space-1) var(--space-2)',
                            borderRadius: 'var(--space-1)',
                            fontSize: '0.75rem',
                            fontWeight: '500',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          Remove
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
        onSubmit={handleSubmit}
        onDelete={handleDelete}
        title={getModalTitle()}
        type={modalType}
        isLoading={isSubmitting}
      >
        {modalType !== 'delete' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))', marginBottom: 'var(--space-2)' }}>
                IP Address/CIDR
              </label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="192.168.1.1/24"
                required
                style={{
                  width: '100%',
                  padding: 'var(--space-2) var(--space-3)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  borderRadius: 'var(--space-2)',
                  color: 'rgb(var(--foreground-rgb))',
                  fontSize: '0.875rem',
                  fontFamily: 'var(--font-mono)'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))', marginBottom: 'var(--space-2)' }}>
                Interface
              </label>
              <CustomSelect
                options={interfaces}
                value={formData.interface || ''}
                onChange={(value) => setFormData({ ...formData, interface: value })}
                placeholder={loadingInterfaces ? 'Loading interfaces...' : 'Select an interface'}
                disabled={loadingInterfaces}
                portal={true}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  borderRadius: 'var(--space-2)',
                  color: 'rgb(var(--foreground-rgb))',
                  fontSize: '0.875rem'
                }}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))', marginBottom: 'var(--space-2)' }}>
                Comment (optional)
              </label>
              <input
                type="text"
                value={formData.comment || ''}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                placeholder="Description of this IP address"
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