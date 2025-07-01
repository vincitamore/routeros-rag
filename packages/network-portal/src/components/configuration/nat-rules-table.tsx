'use client';

import React, { useState } from 'react';
import { ConfigurationModal } from './configuration-modal';
import { CustomSelect, SelectOption } from '../ui/CustomSelect';

interface NATRule {
  '.id': string;
  chain: string;
  action: string;
  protocol?: string;
  'src-address'?: string;
  'dst-address'?: string;
  'src-port'?: string;
  'dst-port'?: string;
  'to-addresses'?: string;
  'to-ports'?: string;
  'in-interface'?: string;
  'out-interface'?: string;
  comment?: string;
  disabled?: string;
  bytes: number;
  packets: number;
}

interface NATRulesTableProps {
  deviceId: string;
  natRules: NATRule[];
  onRefresh: () => void;
  isLoading?: boolean;
}

export function NATRulesTable({ deviceId, natRules, onRefresh, isLoading = false }: NATRulesTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete'>('add');
  const [editingItem, setEditingItem] = useState<NATRule | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // NAT specific options
  const chainOptions: SelectOption[] = [
    { label: 'srcnat', value: 'srcnat' },
    { label: 'dstnat', value: 'dstnat' }
  ];

  const actionOptions: SelectOption[] = [
    { label: 'masquerade', value: 'masquerade' },
    { label: 'src-nat', value: 'src-nat' },
    { label: 'dst-nat', value: 'dst-nat' },
    { label: 'redirect', value: 'redirect' },
    { label: 'accept', value: 'accept' },
    { label: 'drop', value: 'drop' }
  ];

  const protocolOptions: SelectOption[] = [
    { label: 'Any', value: '' },
    { label: 'TCP', value: 'tcp' },
    { label: 'UDP', value: 'udp' },
    { label: 'ICMP', value: 'icmp' },
    { label: 'ESP', value: 'esp' },
    { label: 'AH', value: 'ah' }
  ];

  const openModal = (type: 'add' | 'edit' | 'delete', item?: NATRule) => {
    setModalType(type);
    setEditingItem(item || null);
    setShowModal(true);
    
    if (type === 'add') {
      setFormData({ 
        chain: 'srcnat', 
        action: 'masquerade', 
        protocol: '', 
        'src-address': '', 
        'dst-address': '', 
        'src-port': '', 
        'dst-port': '',
        'to-addresses': '',
        'to-ports': '',
        'in-interface': '',
        'out-interface': '',
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
        response = await fetch(`/api/config/devices/${deviceId}/nat-rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else if (modalType === 'edit' && editingItem) {
        response = await fetch(`/api/config/devices/${deviceId}/nat-rules/${editingItem['.id']}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (response && response.ok) {
        closeModal();
        onRefresh();
      } else {
        throw new Error(`Failed to ${modalType} NAT rule`);
      }
    } catch (error) {
      console.error(`Error ${modalType}ing NAT rule:`, error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingItem) return;
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/config/devices/${deviceId}/nat-rules/${editingItem['.id']}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        closeModal();
        onRefresh();
      } else {
        throw new Error('Failed to delete NAT rule');
      }
    } catch (error) {
      console.error('Error deleting NAT rule:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredData = natRules.filter(rule => 
    !searchTerm || 
    rule.chain?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule['src-address']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule['dst-address']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule['to-addresses']?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    rule.protocol?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getModalTitle = () => {
    switch (modalType) {
      case 'add': return 'Add NAT Rule';
      case 'edit': return 'Edit NAT Rule';
      case 'delete': return 'Delete NAT Rule';
      default: return '';
    }
  };

  const getActionColor = (action: string): string => {
    switch (action.toLowerCase()) {
      case 'masquerade':
      case 'src-nat': 
      case 'dst-nat': return 'var(--primary)';
      case 'redirect': return 'var(--warning)';
      case 'accept': return 'var(--success)';
      case 'drop': return 'var(--error)';
      default: return 'var(--text-secondary)';
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0, color: 'rgb(var(--foreground-rgb))' }}>NAT Rules</h2>
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
            Add NAT Rule
          </button>
        </div>

        {/* Search Bar */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <input 
            type="text"
            placeholder="Search NAT rules..."
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
          <div style={{
            backgroundColor: 'rgba(var(--border-rgb), 0.3)',
            border: '1px solid rgba(var(--border-rgb), 0.5)',
            borderRadius: 'var(--space-3)',
            padding: 'var(--space-6)',
            textAlign: 'center',
            backdropFilter: 'blur(12px)'
          }}>
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
              {isLoading ? 'Loading NAT rules...' : 'No NAT rules found'}
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
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Chain</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Src Address</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Dst Address</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To Address</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Interface</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Traffic</th>
                  <th style={{ padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.75rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((rule, index) => (
                  <tr key={rule['.id']} style={{ 
                    borderTop: index > 0 ? '1px solid rgba(var(--border-rgb), 0.3)' : 'none',
                    opacity: rule.disabled === 'true' ? 0.6 : 1
                  }}>
                    <td style={{ padding: 'var(--space-3)', color: 'rgb(var(--foreground-rgb))', fontSize: '0.875rem' }}>
                      <span style={{
                        backgroundColor: 'rgba(var(--border-rgb), 0.5)',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        fontWeight: '500'
                      }}>
                        {rule.chain || 'srcnat'}
                      </span>
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: getActionColor(rule.action), fontSize: '0.875rem', fontWeight: '500' }}>
                      {rule.action}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'rgb(var(--foreground-rgb))', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                      {rule['src-address'] || '-'}
                      {rule['src-port'] && `:${rule['src-port']}`}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'rgb(var(--foreground-rgb))', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                      {rule['dst-address'] || '-'}
                      {rule['dst-port'] && `:${rule['dst-port']}`}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'rgb(var(--foreground-rgb))', fontSize: '0.875rem', fontFamily: 'monospace' }}>
                      {rule['to-addresses'] || '-'}
                      {rule['to-ports'] && `:${rule['to-ports']}`}
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'rgb(var(--foreground-rgb))', fontSize: '0.875rem' }}>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {rule['in-interface'] && `In: ${rule['in-interface']}`}
                        {rule['in-interface'] && rule['out-interface'] && <br />}
                        {rule['out-interface'] && `Out: ${rule['out-interface']}`}
                        {!rule['in-interface'] && !rule['out-interface'] && '-'}
                      </div>
                    </td>
                    <td style={{ padding: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      <div>{formatBytes(rule.bytes)}</div>
                      <div>{rule.packets.toLocaleString()} packets</div>
                    </td>
                    <td style={{ padding: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                        <button
                          onClick={() => openModal('edit', rule)}
                          style={{
                            backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                            border: '1px solid rgba(var(--primary-rgb), 0.5)',
                            color: 'rgb(var(--primary-rgb))',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openModal('delete', rule)}
                          style={{
                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                            border: '1px solid rgba(239, 68, 68, 0.5)',
                            color: 'rgb(239, 68, 68)',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            cursor: 'pointer',
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
          <p>Are you sure you want to delete this NAT rule? This action cannot be undone.</p>
        ) : (
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                  Chain *
                </label>
                <CustomSelect
                  options={chainOptions}
                  value={formData.chain || 'srcnat'}
                  onChange={(value) => setFormData({ ...formData, chain: value })}
                  placeholder="Select chain"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                  Action *
                </label>
                <CustomSelect
                  options={actionOptions}
                  value={formData.action || 'masquerade'}
                  onChange={(value) => setFormData({ ...formData, action: value })}
                  placeholder="Select action"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                  Protocol
                </label>
                <CustomSelect
                  options={protocolOptions}
                  value={formData.protocol || ''}
                  onChange={(value) => setFormData({ ...formData, protocol: value })}
                  placeholder="Any protocol"
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                  Comment
                </label>
                <input
                  type="text"
                  value={formData.comment || ''}
                  onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
                  placeholder="Optional comment"
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                  Source Address
                </label>
                <input
                  type="text"
                  value={formData['src-address'] || ''}
                  onChange={(e) => setFormData({ ...formData, 'src-address': e.target.value })}
                  placeholder="0.0.0.0/0"
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
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                  Source Port
                </label>
                <input
                  type="text"
                  value={formData['src-port'] || ''}
                  onChange={(e) => setFormData({ ...formData, 'src-port': e.target.value })}
                  placeholder="Any port"
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
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                  Destination Address
                </label>
                <input
                  type="text"
                  value={formData['dst-address'] || ''}
                  onChange={(e) => setFormData({ ...formData, 'dst-address': e.target.value })}
                  placeholder="0.0.0.0/0"
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
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                  Destination Port
                </label>
                <input
                  type="text"
                  value={formData['dst-port'] || ''}
                  onChange={(e) => setFormData({ ...formData, 'dst-port': e.target.value })}
                  placeholder="Any port"
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
              </div>
            </div>

            {(formData.action === 'src-nat' || formData.action === 'dst-nat') && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                    To Addresses
                  </label>
                  <input
                    type="text"
                    value={formData['to-addresses'] || ''}
                    onChange={(e) => setFormData({ ...formData, 'to-addresses': e.target.value })}
                    placeholder="192.168.1.1"
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
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                    To Ports
                  </label>
                  <input
                    type="text"
                    value={formData['to-ports'] || ''}
                    onChange={(e) => setFormData({ ...formData, 'to-ports': e.target.value })}
                    placeholder="80-90"
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
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                  In Interface
                </label>
                <input
                  type="text"
                  value={formData['in-interface'] || ''}
                  onChange={(e) => setFormData({ ...formData, 'in-interface': e.target.value })}
                  placeholder="ether1"
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
                <label style={{ display: 'block', marginBottom: 'var(--space-1)', fontSize: '0.875rem', fontWeight: '500', color: 'rgb(var(--foreground-rgb))' }}>
                  Out Interface
                </label>
                <input
                  type="text"
                  value={formData['out-interface'] || ''}
                  onChange={(e) => setFormData({ ...formData, 'out-interface': e.target.value })}
                  placeholder="ether2"
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
          </div>
        )}
      </ConfigurationModal>
    </>
  );
} 