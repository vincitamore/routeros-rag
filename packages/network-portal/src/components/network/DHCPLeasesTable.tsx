import React, { useState } from 'react';

interface DHCPLease {
  id: number;
  device_id: string;
  lease_id: string;
  ip_address: string;
  mac_address: string;
  hostname?: string;
  server_name: string;
  expires_after?: string;
  is_dynamic: boolean;
  is_active: boolean;
  first_seen: string;
  last_seen: string;
}

interface DHCPLeasesTableProps {
  deviceId: string;
  dhcpLeases: DHCPLease[];
  isLoading: boolean;
}

export function DHCPLeasesTable({ deviceId, dhcpLeases, isLoading }: DHCPLeasesTableProps) {
  const [filter, setFilter] = useState<'all' | 'active' | 'dynamic'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredLeases = dhcpLeases.filter(lease => {
    // Apply filter
    if (filter === 'active' && !lease.is_active) return false;
    if (filter === 'dynamic' && !lease.is_dynamic) return false;
    
    // Apply search
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        lease.ip_address.toLowerCase().includes(search) ||
        lease.mac_address.toLowerCase().includes(search) ||
        (lease.hostname && lease.hostname.toLowerCase().includes(search))
      );
    }
    
    return true;
  });

  const getLeaseStatusColor = (isActive: boolean): string => {
    return isActive ? 'var(--success)' : 'var(--text-secondary)';
  };

  const getLeaseTypeLabel = (isDynamic: boolean): string => {
    return isDynamic ? 'Dynamic' : 'Static';
  };

  const formatMacAddress = (mac: string): string => {
    // Format MAC address with consistent separators
    return mac.replace(/[:-]/g, ':').toUpperCase();
  };

  const formatExpiration = (expiresAfter?: string): string => {
    if (!expiresAfter) return 'Never';
    
    // Parse RouterOS time format (e.g., "23h59m59s")
    const timeMatch = expiresAfter.match(/(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?/);
    if (!timeMatch) return expiresAfter;
    
    const hours = parseInt(timeMatch[1] || '0');
    const minutes = parseInt(timeMatch[2] || '0');
    const seconds = parseInt(timeMatch[3] || '0');
    
    const totalMinutes = hours * 60 + minutes;
    if (totalMinutes > 60) {
      return `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`;
    } else if (totalMinutes > 0) {
      return `${totalMinutes}m`;
    } else {
      return `${seconds}s`;
    }
  };

  if (isLoading) {
    return (
      <div className="card">
        <div style={{ padding: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>DHCP Clients</h2>
          <div className="animate-pulse">
            <div style={{ height: '8px', backgroundColor: 'var(--border-light)', borderRadius: 'var(--space-1)', marginBottom: 'var(--space-2)', width: '40%' }}></div>
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ height: '40px', backgroundColor: 'var(--border-light)', borderRadius: 'var(--space-1)' }}></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div style={{ padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)' }}>DHCP Clients</h2>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {filteredLeases.length} of {dhcpLeases.length} leases
            </span>
          </div>
        </div>

        {/* Filters and Search */}
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Filter Buttons */}
          <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
            {(['all', 'active', 'dynamic'] as const).map((filterOption) => (
              <button
                key={filterOption}
                onClick={() => setFilter(filterOption)}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  borderRadius: 'var(--space-2)',
                  backgroundColor: filter === filterOption ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(var(--border-rgb), 0.2)',
                  border: `1px solid ${filter === filterOption ? 'rgba(var(--primary-rgb), 0.5)' : 'transparent'}`,
                  color: filter === filterOption ? 'rgba(var(--primary-rgb), 1)' : 'rgba(var(--foreground-rgb), 0.8)',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  fontSize: '0.8rem',
                  textTransform: 'capitalize'
                }}
              >
                {filterOption}
              </button>
            ))}
          </div>

          {/* Search Input */}
          <input
            type="text"
            placeholder="Search by IP, MAC, or hostname..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              borderRadius: 'var(--space-2)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              backgroundColor: 'rgba(var(--border-rgb), 0.1)',
              color: 'var(--text-primary)',
              fontSize: '0.8rem',
              minWidth: '200px',
              outline: 'none'
            }}
          />
        </div>

        {/* DHCP Leases Table */}
        {filteredLeases.length > 0 ? (
          <div style={{ 
            border: '1px solid rgba(var(--border-rgb), 0.3)', 
            borderRadius: 'var(--space-2)', 
            overflow: 'hidden' 
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr',
              backgroundColor: 'rgba(var(--border-rgb), 0.1)',
              padding: 'var(--space-3)',
              fontWeight: '600',
              fontSize: '0.8rem',
              color: 'var(--text-primary)',
              borderBottom: '1px solid rgba(var(--border-rgb), 0.3)'
            }}>
              <div>IP Address</div>
              <div>MAC Address</div>
              <div>Hostname</div>
              <div>Type</div>
              <div>Status</div>
              <div>Expires</div>
            </div>
            
            {filteredLeases.map((lease, index) => (
              <div 
                key={lease.id || `${lease.ip_address}-${lease.mac_address}`}
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1fr 1fr 2fr 1fr 1fr 1fr',
                  padding: 'var(--space-3)',
                  fontSize: '0.8rem',
                  borderBottom: index < filteredLeases.length - 1 ? '1px solid rgba(var(--border-rgb), 0.2)' : 'none',
                  backgroundColor: index % 2 === 0 ? 'transparent' : 'rgba(var(--border-rgb), 0.05)'
                }}
              >
                <div style={{ fontFamily: 'monospace', fontWeight: '500' }}>
                  {lease.ip_address}
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {formatMacAddress(lease.mac_address)}
                </div>
                <div style={{ fontWeight: '500' }}>
                  {lease.hostname || '-'}
                </div>
                <div>
                  <span style={{
                    padding: 'var(--space-1) var(--space-2)',
                    borderRadius: 'var(--space-1)',
                    backgroundColor: lease.is_dynamic ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(var(--warning-rgb), 0.2)',
                    color: lease.is_dynamic ? 'var(--primary)' : 'var(--warning)',
                    fontSize: '0.7rem',
                    fontWeight: '500'
                  }}>
                    {getLeaseTypeLabel(lease.is_dynamic)}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: getLeaseStatusColor(lease.is_active)
                  }}></div>
                  <span style={{ color: lease.is_active ? 'var(--success)' : 'var(--text-secondary)' }}>
                    {lease.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                  {formatExpiration(lease.expires_after)}
                </div>
              </div>
            ))}
          </div>
        ) : dhcpLeases.length > 0 ? (
          <div style={{ 
            textAlign: 'center', 
            padding: 'var(--space-6)', 
            color: 'var(--text-secondary)',
            backgroundColor: 'rgba(var(--border-rgb), 0.1)',
            borderRadius: 'var(--space-2)'
          }}>
            <p>No DHCP leases match your current filter criteria</p>
            <p style={{ fontSize: '0.8rem', marginTop: 'var(--space-1)' }}>
              Try adjusting your search or filter settings
            </p>
          </div>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: 'var(--space-8)', 
            color: 'var(--text-secondary)',
            backgroundColor: 'rgba(var(--border-rgb), 0.1)',
            borderRadius: 'var(--space-2)'
          }}>
            <h3 style={{ fontWeight: '500', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>No DHCP Leases Found</h3>
            <p style={{ fontSize: '0.9rem' }}>
              This device may not have a DHCP server configured, or network discovery needs to be started.
            </p>
          </div>
        )}

        {/* Summary Information */}
        {dhcpLeases.length > 0 && (
          <div style={{ 
            marginTop: 'var(--space-4)',
            padding: 'var(--space-3)', 
            backgroundColor: 'rgba(var(--border-rgb), 0.05)', 
            borderRadius: 'var(--space-2)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: 'var(--space-3)',
            fontSize: '0.8rem'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '600', color: 'var(--success)' }}>
                {dhcpLeases.filter(l => l.is_active).length}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>Active Leases</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '600', color: 'var(--primary)' }}>
                {dhcpLeases.filter(l => l.is_dynamic).length}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>Dynamic Leases</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '600', color: 'var(--warning)' }}>
                {dhcpLeases.filter(l => !l.is_dynamic).length}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>Static Leases</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                {dhcpLeases.filter(l => l.hostname).length}
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>With Hostname</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 