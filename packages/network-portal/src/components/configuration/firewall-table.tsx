'use client';

import React, { useState } from 'react';
import { ConfigurationModal } from './configuration-modal';
import { CustomSelect, SelectOption } from '../ui/CustomSelect';
import { ROUTEROS_PROTOCOLS, FIREWALL_CHAINS, FIREWALL_ACTIONS } from '../../constants/routeros-options';

interface FirewallRule {
  '.id': string;
  chain: string;
  action: string;
  protocol?: string;
  'src-address'?: string;
  'dst-address'?: string;
  'dst-port'?: string;
  comment?: string;
  disabled?: string;
}

interface FirewallTableProps {
  deviceId: string;
  firewallRules: FirewallRule[];
  onRefresh: () => void;
  isLoading?: boolean;
}

export function FirewallTable({ deviceId, firewallRules, onRefresh, isLoading = false }: FirewallTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete'>('add');
  const [editingItem, setEditingItem] = useState<FirewallRule | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Use predefined options from constants
  const chainOptions: SelectOption[] = FIREWALL_CHAINS;
  const actionOptions: SelectOption[] = FIREWALL_ACTIONS;
  const protocolOptions: SelectOption[] = ROUTEROS_PROTOCOLS;

  const openModal = (type: 'add' | 'edit' | 'delete', item?: FirewallRule) => {
    setModalType(type);
    setEditingItem(item || null);
    setShowModal(true);
    
    if (type === 'add') {
      setFormData({ 
        chain: 'input', 
        action: 'accept', 
        protocol: '', 
        'src-address': '', 
        'dst-address': '', 
        'dst-port': '', 
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
        response = await fetch(`/api/config/devices/${deviceId}/firewall`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else if (modalType === 'edit' && editingItem) {
        response = await fetch(`/api/config/devices/${deviceId}/firewall/${editingItem['.id']}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (response && response.ok) {
        closeModal();
        onRefresh();
      } else {
        throw new Error(`Failed to ${modalType} firewall rule`);
      }
    } catch (error) {
      console.error(`Error ${modalType}ing firewall rule:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/config/devices/${deviceId}/firewall/${editingItem['.id']}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        closeModal();
        onRefresh();
      } else {
        throw new Error('Failed to delete firewall rule');
      }
    } catch (error) {
      console.error('Error deleting firewall rule:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredData = firewallRules.filter(rule => 
    !searchTerm || 
    rule.chain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule['src-address']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule['dst-address']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.protocol?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getModalTitle = () => {
    switch (modalType) {
      case 'add': return 'Add Firewall Rule';
      case 'edit': return 'Edit Firewall Rule';
      case 'delete': return 'Delete Firewall Rule';
      default: return '';
    }
  };

  const getActionColor = (action: string): string => {
    switch (action.toLowerCase()) {
      case 'accept': return 'var(--success)';
      case 'drop': 
      case 'reject': return 'var(--error)';
      case 'log': return 'var(--warning)';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, color: 'rgb(var(--foreground-rgb))' }}>Firewall Rules</h2>
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
            Add Rule
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <input 
            type="text"
            placeholder="Search firewall rules..."
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
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            <p style={{ color: 'rgba(var(--secondary-rgb), 0.8)', fontSize: '1rem', margin: 0 }}>
              {searchTerm ? 'No firewall rules match your search' : 'No firewall rules configured'}
            </p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.4)' }}>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Chain
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Action
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Protocol
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Source
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Destination
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'left', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Port
                  </th>
                  <th style={{ padding: 'var(--space-3) var(--space-4)', textAlign: 'right', fontSize: '0.875rem', fontWeight: '600', color: 'rgb(var(--foreground-rgb))', borderBottom: '1px solid rgba(var(--border-rgb), 0.5)' }}>
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((rule) => (
                  <tr 
                    key={rule['.id']}
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
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', fontSize: '0.875rem', color: 'rgb(var(--foreground-rgb))' }}>
                      {rule.chain}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
                      <span 
                        style={{
                          padding: 'var(--space-1) var(--space-2)',
                          borderRadius: 'var(--space-1)',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: rule.action === 'accept' ? 'rgba(var(--success-rgb), 0.2)' : rule.action === 'drop' || rule.action === 'reject' ? 'rgba(var(--error-rgb), 0.2)' : 'rgba(var(--warning-rgb), 0.2)',
                          color: rule.action === 'accept' ? 'rgb(var(--success-rgb))' : rule.action === 'drop' || rule.action === 'reject' ? 'rgb(var(--error-rgb))' : 'rgb(var(--warning-rgb))',
                          border: `1px solid ${rule.action === 'accept' ? 'rgba(var(--success-rgb), 0.5)' : rule.action === 'drop' || rule.action === 'reject' ? 'rgba(var(--error-rgb), 0.5)' : 'rgba(var(--warning-rgb), 0.5)'}`
                        }}
                      >
                        {rule.action.toUpperCase()}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', fontSize: '0.875rem', color: 'rgba(var(--secondary-rgb), 0.9)' }}>
                      {rule.protocol || 'any'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'rgba(var(--secondary-rgb), 0.9)' }}>
                      {rule['src-address'] || 'any'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'rgba(var(--secondary-rgb), 0.9)' }}>
                      {rule['dst-address'] || 'any'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', fontFamily: 'var(--font-mono)', fontSize: '0.875rem', color: 'rgba(var(--secondary-rgb), 0.9)' }}>
                      {rule['dst-port'] || 'any'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => openModal('edit', rule)}
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
                          onClick={() => openModal('delete', rule)}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))', marginBottom: 'var(--space-2)' }}>
                  Chain
                </label>
                <CustomSelect
                  options={chainOptions}
                  value={formData.chain || 'input'}
                  onChange={(value) => setFormData({ ...formData, chain: value })}
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
                  Action
                </label>
                <CustomSelect
                  options={actionOptions}
                  value={formData.action || 'accept'}
                  onChange={(value) => setFormData({ ...formData, action: value })}
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
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))', marginBottom: 'var(--space-2)' }}>
                Protocol (optional)
              </label>
              <CustomSelect
                options={protocolOptions}
                value={formData.protocol || ''}
                onChange={(value) => setFormData({ ...formData, protocol: value })}
                placeholder="Select or type protocol..."
                searchable={true}
                allowCustom={true}
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))', marginBottom: 'var(--space-2)' }}>
                  Source Address (optional)
                </label>
                <input
                  type="text"
                  value={formData['src-address'] || ''}
                  onChange={(e) => setFormData({ ...formData, 'src-address': e.target.value })}
                  placeholder="192.168.1.0/24"
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
                  Destination Address (optional)
                </label>
                <input
                  type="text"
                  value={formData['dst-address'] || ''}
                  onChange={(e) => setFormData({ ...formData, 'dst-address': e.target.value })}
                  placeholder="192.168.1.1"
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
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))', marginBottom: 'var(--space-2)' }}>
                Destination Port (optional)
              </label>
              <input
                type="text"
                value={formData['dst-port'] || ''}
                onChange={(e) => setFormData({ ...formData, 'dst-port': e.target.value })}
                placeholder="80, 443, 22, etc."
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
                Comment (optional)
              </label>
              <input
                type="text"
                value={formData.comment || ''}
                onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                placeholder="Description of this rule"
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