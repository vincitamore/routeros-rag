'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Device, DeviceStatus } from '../../types/device';
import { AddDeviceModal } from '../../components/devices/add-device-modal';
import { EditDeviceModal } from '../../components/devices/edit-device-modal';
import { HTTPSSetupModal } from '../../components/devices/HTTPSSetupModal';
import { AppLayout } from '../../components/layout/app-layout';
import { Tooltip } from '../../components/ui/Tooltip';
import { useHTTPSSetup } from '../../hooks/use-https-setup';
import type { HTTPSSetupRecommendation } from '../../types/https-setup';
import { apiClient } from '@/lib/api-client';
// Dynamically import Terminal Manager Modal component with no SSR
const TerminalManagerModal = dynamic(() => import('../../components/terminal/TerminalManagerModal').then(mod => ({ default: mod.TerminalManagerModal })), {
  ssr: false,
  loading: () => null
});

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showHTTPSSetupModal, setShowHTTPSSetupModal] = useState(false);
  const [httpsSetupDevice, setHTTPSSetupDevice] = useState<{
    device: Device;
    recommendation: HTTPSSetupRecommendation;
    originalFormData?: any;
  } | null>(null);
  const [showTerminalManager, setShowTerminalManager] = useState(false);
  const searchParams = useSearchParams();
  const { setupHTTPS, isProcessing, currentStep, error: httpsError, success, reset } = useHTTPSSetup();

  // Fetch devices from API
  const fetchDevices = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/api/devices');
      if (!response.ok) {
        throw new Error(`Failed to fetch devices: ${response.statusText}`);
      }
      const data = await response.json();
      setDevices(data.devices || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch devices');
      console.error('Error fetching devices:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Load devices on component mount
  useEffect(() => {
    if (searchParams.get('action') === 'add') {
      setIsAddModalOpen(true);
    }
    fetchDevices();
  }, [searchParams]);

  // Filter devices based on search term
  const filteredDevices = useMemo(() => {
    if (!searchTerm) return devices;
    const term = searchTerm.toLowerCase();
    return devices.filter(device => 
      device.name.toLowerCase().includes(term) ||
      device.ipAddress.toLowerCase().includes(term) ||
      device.boardName?.toLowerCase().includes(term) ||
      device.routerosVersion?.toLowerCase().includes(term)
    );
  }, [devices, searchTerm]);

  const handleAddDevice = () => {
    setIsAddModalOpen(true);
  };

  const handleDeviceAdded = () => {
    setIsAddModalOpen(false);
    fetchDevices(); // Refresh the list
  };

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    setIsEditModalOpen(true);
  };

  const handleDeviceUpdated = () => {
    setIsEditModalOpen(false);
    setEditingDevice(null);
    fetchDevices(); // Refresh the list
  };

  const handleDeleteDevice = async (deviceId: string) => {
    try {
      const response = await apiClient.delete(`/api/devices/${deviceId}`);
      
      if (!response.ok) {
        throw new Error('Failed to delete device');
      }
      
      // Refresh the device list
      fetchDevices();
    } catch (err) {
      console.error('Error deleting device:', err);
      // Could add toast notification here
    }
  };

  const handleTestConnection = async (device: Device) => {
    try {
      const response = await apiClient.post(`/api/devices/${device.id}/test-connection`);

      const result = await response.json();

      if (result.success) {
        // Always show HTTPS setup modal for HTTP connections, even if SSH is not available
        // This allows users to see diagnostic information and potential fixes
        if (result.httpsRecommendation && !device.useSSL) {
          setHTTPSSetupDevice({
            device,
            recommendation: result.httpsRecommendation
          });
          setShowHTTPSSetupModal(true);
        } else if (device.useSSL) {
          // Already using HTTPS
          console.log('Connection test successful - device already using HTTPS');
        } else {
          // Show normal success message for HTTPS devices
          console.log('Connection test successful');
        }
      } else {
        // Show error message - could add toast notification here
        console.error(`Connection failed: ${result.error || result.message}`);
      }
    } catch (error) {
      console.error('Connection test failed:', error);
    }
  };

  const handleHTTPSSetup = async (device: any) => {
    try {
      if (device.id === 'pending') {
        // This is a device from the add-device modal that hasn't been saved yet
        // We need to save it first, then setup HTTPS
        console.log('🔄 Setting up HTTPS for pending device:', device.name);
        
        // Extract the device data from the httpsSetupDevice state
        const deviceData = {
          name: device.name,
          ipAddress: device.ipAddress,
          port: device.port,
          username: device.username,
          password: httpsSetupDevice?.originalFormData?.password || 'unknown', // Get password from original form data
          useSSL: false, // Start with HTTP
          comment: httpsSetupDevice?.originalFormData?.comment || ''
        };
        
        console.log('💾 Saving device to database first...');
        
        // First, save the device to the database with HTTP settings
        const createResponse = await apiClient.post('/api/devices', deviceData);

        if (!createResponse.ok) {
          const errorData = await createResponse.json();
          throw new Error(errorData.error || 'Failed to save device');
        }

        const createdDevice = await createResponse.json();
        console.log('✅ Device creation response:', createdDevice);
        
        // The API returns the device directly, not nested under 'device'
        const savedDevice = createdDevice.device || createdDevice;
        console.log('✅ Device saved with ID:', savedDevice.id);
        
        // Verify we have a valid device ID before proceeding
        if (!savedDevice.id) {
          console.error('❌ No device ID found in response:', savedDevice);
          throw new Error('Device was saved but no ID was returned');
        }
        
        // Now setup HTTPS for the saved device
        console.log('🔐 Running HTTPS setup for device ID:', savedDevice.id);
        await setupHTTPS({
          ...savedDevice,
          password: deviceData.password // Ensure password is available for HTTPS setup
        });
        
        setShowHTTPSSetupModal(false);
        
        // Refresh device list to show the new device with HTTPS
        await fetchDevices();
        
        // Close the add device modal since we successfully added the device
        setIsAddModalOpen(false);
        
        // Show success message
        console.log(`✅ Device ${device.name} added and HTTPS enabled successfully!`);
        
      } else {
        // This is an existing device
        await setupHTTPS(device);
        setShowHTTPSSetupModal(false);
        
        // Refresh device list to show updated HTTPS status
        await fetchDevices();
        
        // Show success message
        console.log(`HTTPS enabled successfully for ${device.name}`);
      }
    } catch (error) {
      // Error handling is done in the hook
      console.error('HTTPS setup failed:', error);
    }
  };



  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected': return 'rgb(var(--success-rgb))';
      case 'connecting': return 'rgb(var(--warning-rgb))';
      case 'error': return 'rgb(var(--error-rgb))';
      default: return 'var(--text-secondary)';
    }
  };

  const getStatusIcon = (status: Device['status']) => {
    switch (status) {
      case 'connected':
        return (
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'rgb(var(--success-rgb))' }}>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case 'connecting':
        return (
          <svg width="16" height="16" className="animate-spin" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'rgb(var(--warning-rgb))' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        );
      case 'error':
        return (
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'rgb(var(--error-rgb))' }}>
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--text-secondary)' }}>
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div style={{ padding: 'var(--space-6)' }}>
          <div className="loading-state text-center" style={{ padding: 'var(--space-8)' }}>
            <div className="spinner" style={{ margin: '0 auto var(--space-4)' }}></div>
            <p>Loading device management...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
              <div style={{ 
          paddingLeft: 'var(--space-6)', 
          paddingRight: 'var(--space-6)', 
          paddingBottom: 'var(--space-6)', 
          paddingTop: 'var(--space-4)' 
        }}>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" style={{ marginBottom: 'var(--space-6)' }}>
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
              Device Management
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Manage, configure, and monitor your RouterOS devices
            </p>
          </div>
          <button
            onClick={handleAddDevice}
            className="btn btn-primary"
            style={{ 
              padding: 'var(--space-3) var(--space-4)',
              whiteSpace: 'nowrap',
              alignSelf: 'flex-start'
            }}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 'var(--space-2)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Add Device
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div 
            className="card"
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-4)',
              backgroundColor: 'rgba(var(--error-rgb), 0.1)',
              borderColor: 'rgb(var(--error-rgb))'
            }}
          >
            <div className="flex items-center">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'rgb(var(--error-rgb))', marginRight: 'var(--space-2)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm" style={{ color: 'rgb(var(--error-rgb))', margin: 0 }}>{error}</p>
            </div>
          </div>
        )}

        {/* Terminal Manager Modal */}
        <TerminalManagerModal
          isOpen={showTerminalManager}
          onClose={() => setShowTerminalManager(false)}
          devices={devices.map(device => ({
            id: device.id,
            name: device.name,
            ip_address: device.ipAddress,
            username: device.username,
            port: device.port,
            use_ssl: device.useSSL,
            status: device.status,
            terminalAvailable: device.status === 'connected',
            authMethod: 'password' as const,
            sshKeysConfigured: false
          }))}
        />

        {/* Search Bar */}
        <div style={{ marginBottom: 'var(--space-4)' }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <input 
              type="text"
              placeholder="Search devices by name, IP, board, or version..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: 'var(--space-3) var(--space-4) var(--space-3) var(--space-10)',
                backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                border: '1px solid rgba(var(--border-rgb), 0.5)',
                borderRadius: 'var(--space-3)',
                color: 'rgb(var(--foreground-rgb))',
                fontSize: '0.875rem',
                backdropFilter: 'blur(12px)',
                outline: 'none'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                e.target.style.boxShadow = '0 0 0 3px rgba(var(--primary-rgb), 0.1)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(var(--border-rgb), 0.5)';
                e.target.style.boxShadow = 'none';
              }}
            />
            <svg 
              width="16" 
              height="16" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth={2} 
              viewBox="0 0 24 24"
              style={{ 
                position: 'absolute', 
                left: 'var(--space-3)', 
                top: '50%', 
                transform: 'translateY(-50%)', 
                color: 'var(--text-secondary)' 
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                style={{
                  position: 'absolute',
                  right: 'var(--space-3)',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: 'var(--space-1)'
                }}
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Device Content */}
        {filteredDevices.length === 0 && !isLoading ? (
          <div className="card text-center" style={{ padding: 'var(--space-8)' }}>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              <svg width="64" height="64" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24" style={{ margin: '0 auto' }}>
                <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                <line x1="6" y1="6" x2="6.01" y2="6"/>
                <line x1="6" y1="18" x2="6.01" y2="18"/>
              </svg>
            </div>
            <h3 style={{ fontWeight: '500', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>
              {searchTerm ? 'No matching devices found' : 'No Devices Found'}
            </h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-4)' }}>
              {searchTerm ? `No devices match "${searchTerm}"` : 'Add some devices to start managing their configurations'}
            </p>
            {!searchTerm && (
              <button onClick={handleAddDevice} className="btn btn-primary">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 'var(--space-2)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Add Your First Device
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden lg:block">
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.4)' }}>
                      <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
                        Device
                      </th>
                      <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
                        Connection
                      </th>
                      <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
                        System Info
                      </th>
                      <th style={{ padding: 'var(--space-4)', textAlign: 'left', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
                        Status
                      </th>
                      <th style={{ padding: 'var(--space-4)', textAlign: 'center', fontWeight: '600', fontSize: '0.875rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDevices.map((device, index) => (
                      <tr 
                        key={device.id}
                        style={{ 
                          borderBottom: index < filteredDevices.length - 1 ? '1px solid rgba(var(--border-rgb), 0.2)' : 'none',
                          transition: 'background-color 0.2s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.05)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        {/* Device Info */}
                        <td style={{ padding: 'var(--space-4)', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                            {getStatusIcon(device.status)}
                            <div>
                              <div style={{ fontWeight: '600', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                                {device.name}
                              </div>
                              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                ID: {device.id.substring(0, 8)}...
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Connection Info */}
                        <td style={{ padding: 'var(--space-4)', verticalAlign: 'top' }}>
                          <div style={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                            {device.ipAddress}:{device.port}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            {device.useSSL ? 'HTTPS' : 'HTTP'} • {device.username}
                          </div>
                          {device.lastSeen && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                              Last seen: {new Date(device.lastSeen).toLocaleString()}
                            </div>
                          )}
                        </td>

                        {/* System Info */}
                        <td style={{ padding: 'var(--space-4)', verticalAlign: 'top' }}>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                            {device.boardName || 'Unknown Board'}
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                            RouterOS {device.routerosVersion || 'Unknown'}
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ padding: 'var(--space-4)', verticalAlign: 'top' }}>
                          <span 
                            style={{
                              padding: 'var(--space-1) var(--space-2)',
                              borderRadius: 'var(--space-2)',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              backgroundColor: `rgba(${getStatusColor(device.status)}, 0.2)`,
                              color: `rgb(${getStatusColor(device.status)})`,
                              border: `1px solid rgba(${getStatusColor(device.status)}, 0.3)`
                            }}
                          >
                            {device.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: 'var(--space-4)', verticalAlign: 'top' }}>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--space-2)' }}>
                            <Tooltip content="Configure device settings">
                              <Link
                                href={`/configuration/${device.id}`}
                                style={{
                                  padding: 'var(--space-2)',
                                  borderRadius: 'var(--space-2)',
                                  backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                                  color: 'rgb(var(--primary-rgb))',
                                  border: '1px solid rgba(var(--primary-rgb), 0.3)',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.3)';
                                  e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                                  e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.3)';
                                }}
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </Link>
                            </Tooltip>
                            
                            <Tooltip content="Monitor device metrics">
                              <Link
                                href={`/monitoring?device=${device.id}`}
                                style={{
                                  padding: 'var(--space-2)',
                                  borderRadius: 'var(--space-2)',
                                  backgroundColor: 'rgba(var(--success-rgb), 0.2)',
                                  color: 'rgb(var(--success-rgb))',
                                  border: '1px solid rgba(var(--success-rgb), 0.3)',
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(var(--success-rgb), 0.3)';
                                  e.currentTarget.style.borderColor = 'rgba(var(--success-rgb), 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(var(--success-rgb), 0.2)';
                                  e.currentTarget.style.borderColor = 'rgba(var(--success-rgb), 0.3)';
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 128 128" fill="currentColor">
                                  <path d="M128 104.9v7.1H0V16h7v88.9h12.7V54.3h22.7v50.6h5.3V43.7h22.8v61.2h5.2V64.4h22.8v40.5z"/>
                                </svg>
                              </Link>
                            </Tooltip>
                            
                                                        <Tooltip content="Terminal Manager">
                              <button
                                onClick={() => setShowTerminalManager(true)}
                                style={{
                                  padding: 'var(--space-2)',
                                  borderRadius: 'var(--space-2)',
                                  backgroundColor: 'rgba(99, 102, 241, 0.2)',
                                  color: 'rgb(99, 102, 241)',
                                  border: '1px solid rgba(99, 102, 241, 0.3)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
                                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.2)';
                                  e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                                }}
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </button>
                            </Tooltip>
                            
                            <Tooltip content="Edit device">
                              <button
                                onClick={() => handleEditDevice(device)}
                                style={{
                                  padding: 'var(--space-2)',
                                  borderRadius: 'var(--space-2)',
                                  backgroundColor: 'rgba(var(--warning-rgb), 0.2)',
                                  color: 'rgb(var(--warning-rgb))',
                                  border: '1px solid rgba(var(--warning-rgb), 0.3)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(var(--warning-rgb), 0.3)';
                                  e.currentTarget.style.borderColor = 'rgba(var(--warning-rgb), 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(var(--warning-rgb), 0.2)';
                                  e.currentTarget.style.borderColor = 'rgba(var(--warning-rgb), 0.3)';
                                }}
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </button>
                            </Tooltip>
                            
                            <Tooltip content="Delete device">
                              <button
                                onClick={() => handleDeleteDevice(device.id)}
                                style={{
                                  padding: 'var(--space-2)',
                                  borderRadius: 'var(--space-2)',
                                  backgroundColor: 'rgba(var(--error-rgb), 0.2)',
                                  color: 'rgb(var(--error-rgb))',
                                  border: '1px solid rgba(var(--error-rgb), 0.3)',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  transition: 'all 0.2s ease'
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.3)';
                                  e.currentTarget.style.borderColor = 'rgba(var(--error-rgb), 0.5)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.2)';
                                  e.currentTarget.style.borderColor = 'rgba(var(--error-rgb), 0.3)';
                                }}
                              >
                                <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                  <polyline points="3,6 5,6 21,6"></polyline>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                  <line x1="10" y1="11" x2="10" y2="17"></line>
                                  <line x1="14" y1="11" x2="14" y2="17"></line>
                                </svg>
                              </button>
                            </Tooltip>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-4">
              {filteredDevices.map((device) => (
                <div key={device.id} className="card" style={{ padding: 'var(--space-4)' }}>
                  {/* Device Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    {getStatusIcon(device.status)}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: '600', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                        {device.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        ID: {device.id.substring(0, 8)}...
                      </div>
                    </div>
                    <span 
                      style={{
                        padding: 'var(--space-1) var(--space-2)',
                        borderRadius: 'var(--space-2)',
                        fontSize: '0.75rem',
                        fontWeight: '500',
                        backgroundColor: `rgba(${getStatusColor(device.status)}, 0.2)`,
                        color: `rgb(${getStatusColor(device.status)})`,
                        border: `1px solid rgba(${getStatusColor(device.status)}, 0.3)`
                      }}
                    >
                      {device.status}
                    </span>
                  </div>

                  {/* Device Details */}
                  <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                    {/* Connection Info */}
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                        Connection
                      </div>
                      <div style={{ fontSize: '0.9rem', fontFamily: 'monospace', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                        {device.ipAddress}:{device.port}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {device.useSSL ? 'HTTPS' : 'HTTP'} • {device.username}
                      </div>
                      {device.lastSeen && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                          Last seen: {new Date(device.lastSeen).toLocaleString()}
                        </div>
                      )}
                    </div>

                    {/* System Info */}
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: 'var(--space-1)' }}>
                        System Info
                      </div>
                      <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                        {device.boardName || 'Unknown Board'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        RouterOS {device.routerosVersion || 'Unknown'}
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2)' }}>
                    <Link
                      href={`/configuration/${device.id}`}
                      style={{
                        padding: 'var(--space-3)',
                        borderRadius: 'var(--space-2)',
                        backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                        color: 'rgb(var(--primary-rgb))',
                        border: '1px solid rgba(var(--primary-rgb), 0.3)',
                        textDecoration: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 'var(--space-2)',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.3)';
                        e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                        e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.3)';
                      }}
                    >
                      <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Configure
                    </Link>
                    
                                          <Link
                        href={`/monitoring?device=${device.id}`}
                        style={{
                          padding: 'var(--space-3)',
                          borderRadius: 'var(--space-2)',
                          backgroundColor: 'rgba(var(--success-rgb), 0.2)',
                          color: 'rgb(var(--success-rgb))',
                          border: '1px solid rgba(var(--success-rgb), 0.3)',
                          textDecoration: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 'var(--space-2)',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--success-rgb), 0.3)';
                          e.currentTarget.style.borderColor = 'rgba(var(--success-rgb), 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--success-rgb), 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(var(--success-rgb), 0.3)';
                        }}
                      >
                        <svg width="16" height="16" viewBox="0 0 128 128" fill="currentColor">
                          <path d="M128 104.9v7.1H0V16h7v88.9h12.7V54.3h22.7v50.6h5.3V43.7h22.8v61.2h5.2V64.4h22.8v40.5z"/>
                        </svg>
                        Monitor
                      </Link>
                    
                                          <button
                        onClick={() => setShowTerminalManager(true)}
                        style={{
                          padding: 'var(--space-3)',
                          borderRadius: 'var(--space-2)',
                          backgroundColor: 'rgba(99, 102, 241, 0.2)',
                          color: 'rgb(99, 102, 241)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 'var(--space-2)',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
                          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
                        }}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Terminal Manager
                      </button>
                    
                    <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                      <button
                        onClick={() => handleEditDevice(device)}
                        style={{
                          flex: 1,
                          padding: 'var(--space-3)',
                          borderRadius: 'var(--space-2)',
                          backgroundColor: 'rgba(var(--warning-rgb), 0.2)',
                          color: 'rgb(var(--warning-rgb))',
                          border: '1px solid rgba(var(--warning-rgb), 0.3)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--warning-rgb), 0.3)';
                          e.currentTarget.style.borderColor = 'rgba(var(--warning-rgb), 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--warning-rgb), 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(var(--warning-rgb), 0.3)';
                        }}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteDevice(device.id)}
                        style={{
                          flex: 1,
                          padding: 'var(--space-3)',
                          borderRadius: 'var(--space-2)',
                          backgroundColor: 'rgba(var(--error-rgb), 0.2)',
                          color: 'rgb(var(--error-rgb))',
                          border: '1px solid rgba(var(--error-rgb), 0.3)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.875rem',
                          fontWeight: '500',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.3)';
                          e.currentTarget.style.borderColor = 'rgba(var(--error-rgb), 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(var(--error-rgb), 0.3)';
                        }}
                      >
                        <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <polyline points="3,6 5,6 21,6"></polyline>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17"></line>
                          <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* Search Results Info */}
        {searchTerm && filteredDevices.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Showing {filteredDevices.length} of {devices.length} devices matching "{searchTerm}"
          </div>
        )}

        {/* Add Device Modal */}
        {isAddModalOpen && (
          <AddDeviceModal
            isOpen={isAddModalOpen}
            onClose={() => setIsAddModalOpen(false)}
            onDeviceAdded={handleDeviceAdded}
          onHTTPSSetupRequired={(deviceData, recommendation) => {
            console.log('🔐 HTTPS setup required from add-device modal:', deviceData, recommendation);
            // Create a mock device object for the HTTPS setup modal
            const mockDevice = {
              id: 'pending',
              name: deviceData.name,
              ipAddress: deviceData.ipAddress,
              port: deviceData.port,
              username: deviceData.username,
              useSSL: deviceData.useSSL,
              status: 'connecting' as const,
              lastSeen: null,
              lastError: null,
              connectionAttempts: 0,
              deviceType: null,
              routerosVersion: null,
              architecture: null,
              boardName: null,
              createdAt: new Date(),
              updatedAt: new Date()
            };
            
            setHTTPSSetupDevice({
              device: mockDevice,
              recommendation,
              originalFormData: deviceData // Store the original form data including password
            });
            setShowHTTPSSetupModal(true);
            console.log('🎯 Modal state updated:', { showHTTPSSetupModal: true, httpsSetupDevice: mockDevice });
          }}
          />
        )}

        {/* Edit Device Modal */}
        {isEditModalOpen && (
          <EditDeviceModal
            isOpen={isEditModalOpen}
            device={editingDevice}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingDevice(null);
            }}
            onDeviceUpdated={handleDeviceUpdated}
          />
        )}

        {/* HTTPS Setup Modal */}
        {showHTTPSSetupModal && httpsSetupDevice && (
          <HTTPSSetupModal
            isOpen={showHTTPSSetupModal}
            onClose={() => {
              if (!isProcessing) {
                setShowHTTPSSetupModal(false);
                reset();
              }
            }}
            device={httpsSetupDevice.device}
            recommendation={httpsSetupDevice.recommendation}
            onConfirm={handleHTTPSSetup}
            isProcessing={isProcessing}
            currentStep={currentStep}
            error={httpsError}
            success={success}
          />
        )}


      </div>
    </AppLayout>
  );
} 