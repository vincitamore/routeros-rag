'use client';

import React, { useState, useEffect } from 'react';
import { ConfigurationModal } from './configuration-modal';
import { CustomSelect, SelectOption } from '../ui/CustomSelect';

interface Route {
  '.id': string;
  'dst-address': string;
  gateway: string;
  distance: number;
  scope: number;
  'target-scope': number;
  comment?: string;
}

interface RoutingTableProps {
  deviceId: string;
  routes: Route[];
  onRefresh: () => void;
  isLoading?: boolean;
}

export function RoutingTable({ deviceId, routes, onRefresh, isLoading = false }: RoutingTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete'>('add');
  const [editingItem, setEditingItem] = useState<Route | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [interfaces, setInterfaces] = useState<SelectOption[]>([]);
  const [loadingInterfaces, setLoadingInterfaces] = useState(false);
  const [gatewayType, setGatewayType] = useState<'ip' | 'interface'>('ip');

  // Fetch available interfaces
  const fetchInterfaces = async () => {
    setLoadingInterfaces(true);
    try {
      const response = await fetch(`/api/devices/${deviceId}/interfaces`);
      if (response.ok) {
        const data = await response.json();
        const interfaceOptions: SelectOption[] = [
          { value: '', label: 'Direct gateway (IP address)', disabled: false },
          ...data.interfaces.map((iface: any) => ({
            value: iface.name,
            label: `${iface.name} (${iface.type})`,
            disabled: iface.disabled === 'true'
          }))
        ];
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

  const openModal = (type: 'add' | 'edit' | 'delete', item?: Route) => {
    setModalType(type);
    setEditingItem(item || null);
    setShowModal(true);
    
    if (type === 'add') {
      setFormData({ 'dst-address': '', gateway: '', distance: 1, comment: '' });
      setGatewayType('ip');
    } else if (type === 'edit' && item) {
      setFormData({ ...item });
      // Detect if gateway is an IP address or interface name
      const isIpAddress = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/.test(item.gateway);
      setGatewayType(isIpAddress ? 'ip' : 'interface');
    } else {
      setFormData({});
      setGatewayType('ip');
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
        response = await fetch(`/api/config/devices/${deviceId}/routes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else if (modalType === 'edit' && editingItem) {
        response = await fetch(`/api/config/devices/${deviceId}/routes/${editingItem['.id']}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (response && response.ok) {
        closeModal();
        onRefresh();
      } else {
        throw new Error(`Failed to ${modalType} route`);
      }
    } catch (error) {
      console.error(`Error ${modalType}ing route:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/config/devices/${deviceId}/routes/${editingItem['.id']}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        closeModal();
        onRefresh();
      } else {
        throw new Error('Failed to delete route');
      }
    } catch (error) {
      console.error('Error deleting route:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredData = routes.filter(route => 
    !searchTerm || 
    route['dst-address']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    route.gateway?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getModalTitle = () => {
    switch (modalType) {
      case 'add': return 'Add Route';
      case 'edit': return 'Edit Route';
      case 'delete': return 'Delete Route';
      default: return '';
    }
  };

  return (
    <>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, color: 'rgb(var(--foreground-rgb))' }}>Routing Table</h2>
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
            Add Route
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <input 
            type="text"
            placeholder="Search routing table..."
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159-.69-.159-1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
            </svg>
            <p style={{ color: 'rgba(var(--secondary-rgb), 0.8)', fontSize: '1rem', margin: 0 }}>
              {searchTerm ? 'No routes match your search' : 'No routes configured'}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.4)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Destination
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Gateway
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Distance
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Comment
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((route) => (
                  <tr 
                    key={route['.id']}
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
                      {route['dst-address']}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'rgba(var(--secondary-rgb), 0.9)' }}>
                      {route.gateway}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', fontSize: '0.875rem', color: 'rgba(var(--secondary-rgb), 0.9)' }}>
                      {route.distance}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', fontSize: '0.875rem', color: 'rgba(var(--secondary-rgb), 0.9)' }}>
                      {route.comment || '-'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => openModal('edit', route)}
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
                          onClick={() => openModal('delete', route)}
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
                Destination Network
              </label>
              <input
                type="text"
                value={formData['dst-address'] || ''}
                onChange={(e) => setFormData({ ...formData, 'dst-address': e.target.value })}
                placeholder="0.0.0.0/0"
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
                Gateway Type
              </label>
              <CustomSelect
                options={[
                  { value: 'ip', label: 'IP Address' },
                  { value: 'interface', label: 'Interface' }
                ]}
                value={gatewayType}
                onChange={(value) => {
                  setGatewayType(value as 'ip' | 'interface');
                  setFormData({ ...formData, gateway: '' });
                }}
                portal={true}
                style={{
                  width: '100%',
                  backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                  border: '1px solid rgba(var(--border-rgb), 0.5)',
                  borderRadius: 'var(--space-2)',
                  color: 'rgb(var(--foreground-rgb))',
                  fontSize: '0.875rem',
                  marginBottom: 'var(--space-3)'
                }}
              />
              
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))', marginBottom: 'var(--space-2)' }}>
                Gateway {gatewayType === 'ip' ? 'IP Address' : 'Interface'}
              </label>
              
              {gatewayType === 'ip' ? (
                <input
                  type="text"
                  value={formData.gateway || ''}
                  onChange={(e) => setFormData({ ...formData, gateway: e.target.value })}
                  placeholder="192.168.1.1"
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
              ) : (
                <CustomSelect
                  options={interfaces.filter(iface => iface.value !== '')}
                  value={formData.gateway || ''}
                  onChange={(value) => setFormData({ ...formData, gateway: value })}
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
              )}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))', marginBottom: 'var(--space-2)' }}>
                Distance
              </label>
              <input
                type="number"
                value={formData.distance || 1}
                onChange={(e) => setFormData({ ...formData, distance: parseInt(e.target.value) || 1 })}
                min="1"
                max="255"
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
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))', marginBottom: 'var(--space-2)' }}>
                Comment (optional)
              </label>
              <input
                type="text"
                value={formData.comment || ''}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                placeholder="Description of this route"
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