'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { AppLayout } from '../../../components/layout/app-layout';
import { IPAddressTable } from '../../../components/configuration/ip-address-table';
import { RoutingTable } from '../../../components/configuration/routing-table';
import { FirewallTable } from '../../../components/configuration/firewall-table';
import { NATRulesTable } from '../../../components/configuration/nat-rules-table';
import { AddressListsTable } from '../../../components/configuration/address-lists-table';
import { IPsecTab } from '../../../components/configuration/ipsec-tab';
import { ConfirmDialog } from '../../../components/ui/ConfirmDialog';
import { Tooltip } from '../../../components/ui/Tooltip';
import { Device } from '../../../types/device';

// Dynamically import Unified Terminal Manager component with no SSR
const UnifiedTerminalManager = dynamic(() => import('../../../components/terminal/UnifiedTerminalManager'), {
  ssr: false,
  loading: () => null
});

interface ConfigSection {
  id: string;
  title: string;
  description: string;
  icon: React.ReactElement;
}

interface IPAddress {
  '.id': string;
  address: string;
  network: string;
  interface: string;
  invalid?: string;
  dynamic?: string;
  disabled?: string;
}

interface Route {
  '.id': string;
  'dst-address': string;
  gateway: string;
  distance: number;
  scope: number;
  'target-scope': number;
  comment?: string;
}

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

interface Backup {
  id: string;
  name: string;
  size: string;
  creation_time: string;
  stored_locally?: boolean;
  available_on_device?: boolean;
}

export default function DeviceConfigurationPage() {
  const params = useParams();
  const deviceId = params?.deviceId as string;
  
  const [device, setDevice] = useState<Device | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Confirmation dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteBackupData, setDeleteBackupData] = useState<{id: string, name: string} | null>(null);
  const [showDeviceDeleteDialog, setShowDeviceDeleteDialog] = useState(false);
  const [deviceDeleteBackupData, setDeviceDeleteBackupData] = useState<{id: string, name: string} | null>(null);
  const [showRestoreDialog, setShowRestoreDialog] = useState(false);
  const [restoreBackupData, setRestoreBackupData] = useState<{id: string, name: string} | null>(null);
  
  // Configuration data states
  const [ipAddresses, setIpAddresses] = useState<IPAddress[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [firewallRules, setFirewallRules] = useState<FirewallRule[]>([]);
  const [natRules, setNatRules] = useState<any[]>([]);
  const [addressLists, setAddressLists] = useState<any[]>([]);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [ipsecPolicies, setIpsecPolicies] = useState<any[]>([]);
  const [ipsecPeers, setIpsecPeers] = useState<any[]>([]);
  const [ipsecProfiles, setIpsecProfiles] = useState<any[]>([]);
  const [ipsecActivePeers, setIpsecActivePeers] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(false);

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'edit' | 'delete'>('add');
  const [modalSection, setModalSection] = useState<string>('');
  const [editingItem, setEditingItem] = useState<any>(null);


  // Form states
  const [formData, setFormData] = useState<any>({});

  const configSections: ConfigSection[] = [
    {
      id: 'overview',
      title: 'Overview',
      description: 'Device status and basic information',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'ip',
      title: 'IP Addresses',
      description: 'Manage IP address assignments',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 9.563C9 9.252 9.252 9 9.563 9h4.874c.311 0 .563.252.563.563v4.874c0 .311-.252.563-.563.563H9.564A.562.562 0 019 14.437V9.564z" />
        </svg>
      )
    },
    {
      id: 'routing',
      title: 'Routing',
      description: 'Configure routing tables and routes',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
        </svg>
      )
    },
    {
      id: 'firewall',
      title: 'Firewall',
      description: 'Manage firewall rules and filters',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      )
    },
    {
      id: 'nat',
      title: 'NAT Rules',
      description: 'Configure Network Address Translation',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
      )
    },
    {
      id: 'address-lists',
      title: 'Address Lists',
      description: 'Manage firewall address lists',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
        </svg>
      )
    },
    {
      id: 'ipsec',
      title: 'IPsec VPN',
      description: 'Configure IPsec VPN tunnels and policies',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      )
    },
    {
      id: 'terminal',
      title: 'Terminal Manager',
      description: 'Manage SSH terminal sessions and history',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      id: 'backup',
      title: 'Backup & Restore',
      description: 'Create and manage configuration backups',
      icon: (
        <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
        </svg>
      )
    }
  ];

  useEffect(() => {
    if (deviceId) {
      fetchDevice();
    }
  }, [deviceId]);

  useEffect(() => {
    if (device && activeSection !== 'overview') {
      loadSectionData(activeSection);
    }
  }, [device, activeSection]);

  const fetchDevice = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/devices/${deviceId}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch device: ${response.statusText}`);
      }
      const data = await response.json();
      setDevice(data); // The API returns the device directly, not wrapped in a 'device' property
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch device');
      console.error('Error fetching device:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSectionData = async (section: string) => {
    if (!device) return;
    
    try {
      setIsDataLoading(true);
      setError(null);
      
      switch (section) {
        case 'ip':
          console.log(`Fetching IP addresses for device ${deviceId}...`);
          const ipResponse = await fetch(`/api/config/devices/${deviceId}/ip-addresses`);
          console.log('IP response status:', ipResponse.status);
          
          if (ipResponse.ok) {
            const ipData = await ipResponse.json();
            console.log('IP data received:', ipData);
            setIpAddresses(ipData.addresses || []); // Note: API returns 'addresses' not 'ip_addresses'
          } else {
            const errorData = await ipResponse.text();
            console.error('IP fetch error:', errorData);
            throw new Error(`Failed to fetch IP addresses: ${ipResponse.status} ${errorData}`);
          }
          break;
          
        case 'routing':
          const routeResponse = await fetch(`/api/config/devices/${deviceId}/routes`);
          if (routeResponse.ok) {
            const routeData = await routeResponse.json();
            setRoutes(routeData.routes || []);
          } else {
            const errorData = await routeResponse.text();
            console.error('Routes fetch error:', errorData);
            throw new Error(`Failed to fetch routes: ${routeResponse.status}`);
          }
          break;
          
        case 'firewall':
          const firewallResponse = await fetch(`/api/config/devices/${deviceId}/firewall-rules`);
          if (firewallResponse.ok) {
            const firewallData = await firewallResponse.json();
            setFirewallRules(firewallData.rules || []);
          } else {
            const errorData = await firewallResponse.text();
            console.error('Firewall fetch error:', errorData);
            throw new Error(`Failed to fetch firewall rules: ${firewallResponse.status}`);
          }
          break;
          
        case 'nat':
          const natResponse = await fetch(`/api/config/devices/${deviceId}/nat-rules`);
          if (natResponse.ok) {
            const natData = await natResponse.json();
            setNatRules(natData.rules || []);
          } else {
            const errorData = await natResponse.text();
            console.error('NAT rules fetch error:', errorData);
            throw new Error(`Failed to fetch NAT rules: ${natResponse.status}`);
          }
          break;
          
        case 'address-lists':
          const addressListsResponse = await fetch(`/api/config/devices/${deviceId}/address-lists`);
          if (addressListsResponse.ok) {
            const addressListsData = await addressListsResponse.json();
            setAddressLists(addressListsData.entries || []);
          } else {
            const errorData = await addressListsResponse.text();
            console.error('Address lists fetch error:', errorData);
            throw new Error(`Failed to fetch address lists: ${addressListsResponse.status}`);
          }
          break;
          
        case 'ipsec':
          // Load all IPsec data in parallel
          const [policiesResponse, peersResponse, profilesResponse, activePeersResponse] = await Promise.all([
            fetch(`/api/config/devices/${deviceId}/ipsec/policies`),
            fetch(`/api/config/devices/${deviceId}/ipsec/peers`),
            fetch(`/api/config/devices/${deviceId}/ipsec/profiles`),
            fetch(`/api/config/devices/${deviceId}/ipsec/active-peers`)
          ]);

          if (policiesResponse.ok) {
            const policiesData = await policiesResponse.json();
            console.log('📊 IPsec Policies Response:', policiesData);
            console.log('📊 Policies Array Length:', (policiesData.policies || []).length);
            setIpsecPolicies(policiesData.policies || []);
          } else {
            console.error('❌ Policies Response Error:', policiesResponse.status, await policiesResponse.text());
          }

          if (peersResponse.ok) {
            const peersData = await peersResponse.json();
            console.log('📊 IPsec Peers Response:', peersData);
            console.log('📊 Peers Array Length:', (peersData.peers || []).length);
            setIpsecPeers(peersData.peers || []);
          } else {
            console.error('❌ Peers Response Error:', peersResponse.status, await peersResponse.text());
          }

          if (profilesResponse.ok) {
            const profilesData = await profilesResponse.json();
            console.log('📊 IPsec Profiles Response:', profilesData);
            console.log('📊 Profiles Array Length:', (profilesData.profiles || []).length);
            setIpsecProfiles(profilesData.profiles || []);
          } else {
            console.error('❌ Profiles Response Error:', profilesResponse.status, await profilesResponse.text());
          }

          if (activePeersResponse.ok) {
            const activePeersData = await activePeersResponse.json();
            console.log('📊 IPsec Active Peers Response:', activePeersData);
            console.log('📊 Active Peers Array Length:', (activePeersData.activePeers || []).length);
            setIpsecActivePeers(activePeersData.activePeers || []);
          } else {
            console.error('❌ Active Peers Response Error:', activePeersResponse.status, await activePeersResponse.text());
          }
          break;

        case 'backup':
          const backupResponse = await fetch(`/api/config/devices/${deviceId}/backups?include_device=true`);
          if (backupResponse.ok) {
            const backupData = await backupResponse.json();
            // Transform backend data structure to frontend expected structure
            const transformedBackups = (backupData.backups || []).map((backup: any) => ({
              id: backup.id,
              name: backup.backup_name,
              size: backup.file_size ? `${(backup.file_size / 1024).toFixed(1)} KB` : 'Unknown',
              creation_time: backup.created_at,
              stored_locally: backup.stored_locally,
              available_on_device: backup.available_on_device
            }));
            setBackups(transformedBackups);
          } else {
            const errorData = await backupResponse.text();
            console.error('Backup fetch error:', errorData);
            throw new Error(`Failed to fetch backups: ${backupResponse.status}`);
          }
          break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load configuration data');
    } finally {
      setIsDataLoading(false);
    }
  };

  const createBackup = async () => {
    if (!device) return;
    
    try {
      setIsDataLoading(true);
      setSuccessMessage(''); // Clear any existing success messages
      const response = await fetch(`/api/config/devices/${deviceId}/backup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `backup-${new Date().toISOString().split('T')[0]}`, type: 'manual' })
      });
      
      if (response.ok) {
        // Refresh backup list
        await loadSectionData('backup');
      } else {
        const errorData = await response.text();
        console.error('Backup creation error:', errorData);
        throw new Error('Failed to create backup');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create backup');
    } finally {
      setIsDataLoading(false);
    }
  };

  const uploadBackup = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.backup';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        setIsDataLoading(true);
        
        // Read file as base64
        const reader = new FileReader();
        reader.onload = async () => {
          try {
            const base64Data = (reader.result as string).split(',')[1]; // Remove data:application/octet-stream;base64, prefix
            const backupName = file.name.replace(/\.backup$/, '');
            
            const response = await fetch(`/api/config/devices/${deviceId}/backup/upload`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                backupName, 
                backupData: base64Data,
                userId: 'admin'
              })
            });
            
            if (response.ok) {
              // Refresh backup list
              await loadSectionData('backup');
            } else {
              const errorData = await response.text();
              console.error('Upload error:', errorData);
              throw new Error('Failed to upload backup');
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to upload backup');
          } finally {
            setIsDataLoading(false);
          }
        };
        reader.readAsDataURL(file);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to read backup file');
        setIsDataLoading(false);
      }
    };
    input.click();
  };

  const downloadBackup = async (backupId: string, backupName: string) => {
    try {
      setSuccessMessage(''); // Clear any existing success messages
      console.log(`Downloading backup: ID=${backupId}, Name=${backupName}`); // Debug log
      let response;
      
      // Check if this is a device-only backup (ID starts with 'device_')
      if (String(backupId).startsWith('device_')) {
        // First download from device to local database
        const downloadResponse = await fetch(`/api/config/devices/${deviceId}/backup/${backupName}/download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'admin' })
        });
        
        if (!downloadResponse.ok) {
          const errorData = await downloadResponse.text();
          console.error('Device download error:', errorData);
          throw new Error('Failed to download backup from device');
        }
        
        const downloadResult = await downloadResponse.json();
        console.log('Download result:', downloadResult); // Debug log
        console.log('New backup ID:', downloadResult.backup?.id); // Debug log
        
        // Wait a moment for the database to be updated, then refresh backup list
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadSectionData('backup');
        
        // Show success message instead of automatically downloading
        setError('');
        setSuccessMessage(`Backup "${backupName}" successfully downloaded from device and stored locally. Click Download again to save to your computer.`);
        // Clear success message after 5 seconds
        setTimeout(() => setSuccessMessage(''), 5000);
        return; // Exit here - don't automatically download to computer
      } else {
        // Download local backup directly to computer
        response = await fetch(`/api/config/devices/${deviceId}/backup/${backupId}/download`);
      }
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${backupName}.backup`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Show success message for browser download
        setError('');
        setSuccessMessage(`✅ Backup "${backupName}" successfully downloaded to your computer.`);
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Refresh the backup list to show updated status
        await loadSectionData('backup');
      } else {
        const errorData = await response.text();
        console.error('Download error:', errorData);
        console.error('Response status:', response.status);
        throw new Error(`Failed to download backup: ${response.status} - ${errorData}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download backup');
    }
  };

  const restoreBackup = async (backupId: string, backupName: string) => {
    // Show custom confirmation dialog
    setRestoreBackupData({ id: backupId, name: backupName });
    setShowRestoreDialog(true);
  };

  const handleRestoreConfirm = async () => {
    if (!restoreBackupData) return;
    
    try {
      setShowRestoreDialog(false);
      setSuccessMessage(''); // Clear any existing success messages
      setIsDataLoading(true);
      
      const response = await fetch(`/api/config/devices/${deviceId}/backup/${restoreBackupData.id}/restore`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'admin' })
      });
      
      if (response.ok) {
        setSuccessMessage(`✅ Backup "${restoreBackupData.name}" restoration initiated. The device will reboot shortly.`);
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        const errorData = await response.text();
        console.error('Restore error:', errorData);
        throw new Error('Failed to restore backup');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore backup');
    } finally {
      setIsDataLoading(false);
      setRestoreBackupData(null);
    }
  };

  const handleRestoreCancel = () => {
    setShowRestoreDialog(false);
    setRestoreBackupData(null);
  };

  const uploadBackupToDevice = async (backupId: string, backupName: string) => {
    try {
      setSuccessMessage(''); // Clear any existing success messages
      setIsDataLoading(true);
      
      const response = await fetch(`/api/config/devices/${deviceId}/backup/${backupId}/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'admin' })
      });
      
      if (response.ok) {
        setSuccessMessage(`✅ Backup "${backupName}" uploaded to RouterOS device successfully.`);
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Refresh backup list to show updated status
        await loadSectionData('backup');
      } else {
        const errorData = await response.text();
        console.error('Upload to device error:', errorData);
        throw new Error('Failed to upload backup to device');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to upload backup to device');
    } finally {
      setIsDataLoading(false);
    }
  };

  const deleteBackupFromDevice = async (backupId: string, backupName: string) => {
    // Show custom confirmation dialog
    setDeviceDeleteBackupData({ id: backupId, name: backupName });
    setShowDeviceDeleteDialog(true);
  };

  const handleDeviceDeleteConfirm = async () => {
    if (!deviceDeleteBackupData) return;
    
    try {
      setShowDeviceDeleteDialog(false);
      setSuccessMessage(''); // Clear any existing success messages
      setIsDataLoading(true);
      
      const response = await fetch(`/api/config/devices/${deviceId}/backup/${deviceDeleteBackupData.id}/device`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: 'admin' })
      });
      
      if (response.ok) {
        setSuccessMessage(`✅ Backup "${deviceDeleteBackupData.name}" deleted from RouterOS device successfully.`);
        setTimeout(() => setSuccessMessage(''), 3000);
        
        // Refresh backup list
        window.location.reload();
      } else {
        const errorData = await response.json();
        setError(`Failed to delete backup from device: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deleting backup from device:', error);
      setError(`Network error: ${error instanceof Error ? error.message : 'Failed to delete backup from device'}`);
    } finally {
      setIsDataLoading(false);
      setDeviceDeleteBackupData(null);
    }
  };

  const handleDeviceDeleteCancel = () => {
    setShowDeviceDeleteDialog(false);
    setDeviceDeleteBackupData(null);
  };

  const deleteBackupFromLocal = async (backupId: string, backupName: string) => {
    // Show confirmation dialog instead of browser confirm
    setDeleteBackupData({ id: backupId, name: backupName });
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteBackupData) return;

    try {
      setIsDataLoading(true);
      setSuccessMessage(''); // Clear any existing success messages
      setShowDeleteDialog(false); // Close dialog
      
      const { id: backupId, name: backupName } = deleteBackupData;
      
      // Only delete local database entries (not device files)
      if (!String(backupId).startsWith('device_')) {
        const response = await fetch(`/api/config/devices/${deviceId}/backup/${backupId}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: 'admin' })
        });
        
        if (response.ok) {
          // Show success message
          setSuccessMessage(`✅ Backup "${backupName}" deleted successfully.`);
          setTimeout(() => setSuccessMessage(''), 3000);
          
          // Refresh backup list
          await loadSectionData('backup');
        } else {
          const errorData = await response.text();
          console.error('Delete error:', errorData);
          throw new Error('Failed to delete backup');
        }
      } else {
        setError('Cannot delete device-only backups. Download them first to manage locally.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete backup');
    } finally {
      setIsDataLoading(false);
      setDeleteBackupData(null);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteDialog(false);
    setDeleteBackupData(null);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'connected': return 'var(--success)';
      case 'connecting': return 'var(--warning)';
      case 'error': return 'var(--error)';
      default: return 'var(--text-secondary)';
    }
  };

  // Modal management functions
  const openModal = (type: 'add' | 'edit' | 'delete', section: string, item?: any) => {
    setModalType(type);
    setModalSection(section);
    setEditingItem(item || null);
    setShowModal(true);
    
    // Initialize form data based on type and section
    if (type === 'add') {
      switch (section) {
        case 'ip':
          setFormData({ address: '', interface: '', comment: '' });
          break;
        case 'routing':
          setFormData({ 'dst-address': '', gateway: '', distance: 1, comment: '' });
          break;
        case 'firewall':
          setFormData({ chain: 'input', action: 'accept', protocol: '', 'src-address': '', 'dst-address': '', 'dst-port': '', comment: '' });
          break;
        default:
          setFormData({});
      }
    } else if (type === 'edit' && item) {
      setFormData({ ...item });
    } else {
      setFormData({});
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setModalType('add');
    setModalSection('');
    setEditingItem(null);
    setFormData({});
  };

  // CRUD operations
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!device) return;

    try {
      setIsDataLoading(true);
      let response;
      
      if (modalType === 'add') {
        response = await fetch(`/api/config/devices/${deviceId}/${modalSection === 'ip' ? 'ip-addresses' : modalSection === 'routing' ? 'routes' : 'firewall-rules'}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      } else if (modalType === 'edit') {
        response = await fetch(`/api/config/devices/${deviceId}/${modalSection === 'ip' ? 'ip-addresses' : modalSection === 'routing' ? 'routes' : 'firewall-rules'}/${editingItem['.id']}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData)
        });
      }

      if (response && response.ok) {
        closeModal();
        loadSectionData(modalSection);
      } else {
        throw new Error(`Failed to ${modalType} item`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${modalType} item`);
    } finally {
      setIsDataLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!device || !editingItem) return;

    try {
      setIsDataLoading(true);
      const response = await fetch(`/api/config/devices/${deviceId}/${modalSection === 'ip' ? 'ip-addresses' : modalSection === 'routing' ? 'routes' : 'firewall-rules'}/${editingItem['.id']}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        closeModal();
        loadSectionData(modalSection);
      } else {
        throw new Error('Failed to delete item');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete item');
    } finally {
      setIsDataLoading(false);
    }
  };



  if (isLoading) {
    return (
      <AppLayout>
        <div className="configuration-dashboard" style={{ padding: 'var(--space-4)' }}>
          <div className="loading-state text-center" style={{ padding: 'var(--space-8)' }}>
            <div className="spinner" style={{ margin: '0 auto var(--space-4)' }}></div>
            <p>Loading device configuration...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!device) {
    return (
      <AppLayout>
        <div className="configuration-dashboard" style={{ padding: 'var(--space-4)' }}>
          <div className="card text-center" style={{ padding: 'var(--space-8)' }}>
            <h3 style={{ fontWeight: '500', fontSize: '1rem', marginBottom: 'var(--space-2)' }}>Device Not Found</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-4)' }}>
              The requested device could not be found.
            </p>
            <Link href="/configuration" className="btn btn-primary">
              Back to Configuration
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="configuration-dashboard" style={{ padding: 'var(--space-4)' }}>
        {/* Breadcrumb Navigation */}
        <div className="breadcrumb-nav" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
              <Link 
                href="/"
                className="flex items-center transition-colors hover:text-primary"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ marginRight: 'var(--space-1)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Dashboard
              </Link>
              <span style={{ color: 'var(--text-muted)' }}>{'>'}</span>
              <Link 
                href="/configuration"
                className="transition-colors hover:text-primary"
                style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              >
                Configuration
              </Link>
              <span style={{ color: 'var(--text-muted)' }}>{'>'}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>
                {device.name}
              </span>
            </div>
          </div>
        </div>

        {/* Device Header */}
        <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: 'var(--space-1)' }}>
                {device.name}
              </h1>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
                {device.ipAddress} • {device.boardName} • RouterOS {device.routerosVersion}
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: getStatusColor(device.status)
                }}
              ></span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                {device.status}
              </span>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div 
            className="card"
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-4)',
              backgroundColor: 'rgba(248, 113, 113, 0.1)',
              borderColor: 'var(--error)'
            }}
          >
            <div className="flex items-center">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--error)', marginRight: 'var(--space-2)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--error)', margin: 0 }}>{error}</p>
            </div>
          </div>
        )}

        {/* Success Message */}
        {successMessage && (
          <div 
            className="card"
            style={{
              marginBottom: 'var(--space-4)',
              padding: 'var(--space-4)',
              backgroundColor: 'rgba(34, 197, 94, 0.1)',
              borderColor: 'var(--success)'
            }}
          >
            <div className="flex items-center">
              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'var(--success)', marginRight: 'var(--space-2)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm" style={{ color: 'var(--success)', margin: 0 }}>{successMessage}</p>
            </div>
          </div>
        )}

        {/* Configuration Layout */}
        <div style={{ display: 'flex', gap: 'var(--space-6)', alignItems: 'flex-start' }}>
          {/* Section Navigation */}
          <div className="card" style={{ flex: '1', minWidth: '250px', maxWidth: '300px', padding: 'var(--space-4)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: '500', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
              Configuration Sections
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
              {configSections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-3)',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--space-2)',
                    backgroundColor: activeSection === section.id ? 'rgba(var(--primary-rgb), 0.2)' : 'rgba(var(--border-rgb), 0.2)',
                    border: `1px solid ${activeSection === section.id ? 'rgba(var(--primary-rgb), 0.5)' : 'transparent'}`,
                    color: activeSection === section.id ? 'rgba(var(--primary-rgb), 1)' : 'rgba(var(--foreground-rgb), 0.8)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    fontSize: '0.85rem',
                    textAlign: 'left',
                    width: '100%'
                  }}
                  onMouseEnter={(e) => {
                    if (activeSection !== section.id) {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeSection !== section.id) {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }
                  }}
                >
                  {section.icon}
                  <div>
                    <div style={{ fontWeight: '500' }}>{section.title}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-1)' }}>
                      {section.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Section Content */}
          <div className="card" style={{ flex: '3', padding: 'var(--space-6)' }}>
            {isDataLoading && (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                <div className="spinner" style={{ margin: '0 auto var(--space-3)' }}></div>
                <p style={{ color: 'var(--text-secondary)' }}>Loading configuration data...</p>
              </div>
            )}

            {!isDataLoading && (
              <>
                {activeSection === 'overview' && (
                  <div>
                    <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: 'var(--space-4)' }}>
                      Device Overview
                    </h2>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 'var(--space-4)' }}>
                      <div style={{ 
                        padding: 'var(--space-4)', 
                        backgroundColor: 'rgba(var(--border-rgb), 0.2)', 
                        borderRadius: 'var(--space-3)',
                        border: '1px solid rgba(var(--border-rgb), 0.3)'
                      }}>
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Connection Status</h4>
                        <p style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0, textTransform: 'capitalize' }}>
                          {device.status}
                        </p>
                      </div>
                      <div style={{ 
                        padding: 'var(--space-4)', 
                        backgroundColor: 'rgba(var(--border-rgb), 0.2)', 
                        borderRadius: 'var(--space-3)',
                        border: '1px solid rgba(var(--border-rgb), 0.3)'
                      }}>
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>IP Address</h4>
                        <p style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                          {device.ipAddress}
                        </p>
                      </div>
                      <div style={{ 
                        padding: 'var(--space-4)', 
                        backgroundColor: 'rgba(var(--border-rgb), 0.2)', 
                        borderRadius: 'var(--space-3)',
                        border: '1px solid rgba(var(--border-rgb), 0.3)'
                      }}>
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>Board Name</h4>
                        <p style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                          {device.boardName || 'Unknown'}
                        </p>
                      </div>
                      <div style={{ 
                        padding: 'var(--space-4)', 
                        backgroundColor: 'rgba(var(--border-rgb), 0.2)', 
                        borderRadius: 'var(--space-3)',
                        border: '1px solid rgba(var(--border-rgb), 0.3)'
                      }}>
                        <h4 style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-2)' }}>RouterOS Version</h4>
                        <p style={{ fontSize: '1.1rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                          {device.routerosVersion || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {activeSection === 'ip' && (
                  <IPAddressTable 
                    deviceId={deviceId}
                    ipAddresses={ipAddresses}
                    onRefresh={() => loadSectionData('ip')}
                    isLoading={isDataLoading}
                  />
                )}

                {activeSection === 'routing' && (
                  <RoutingTable 
                    deviceId={deviceId}
                    routes={routes}
                    onRefresh={() => loadSectionData('routing')}
                    isLoading={isDataLoading}
                  />
                )}

                {activeSection === 'firewall' && (
                  <FirewallTable 
                    deviceId={deviceId}
                    firewallRules={firewallRules}
                    onRefresh={() => loadSectionData('firewall')}
                    isLoading={isDataLoading}
                  />
                )}

                {activeSection === 'nat' && (
                  <NATRulesTable 
                    deviceId={deviceId}
                    natRules={natRules}
                    onRefresh={() => loadSectionData('nat')}
                    isLoading={isDataLoading}
                  />
                )}

                {activeSection === 'address-lists' && (
                  <AddressListsTable 
                    deviceId={deviceId}
                    addressLists={addressLists}
                    onRefresh={() => loadSectionData('address-lists')}
                    isLoading={isDataLoading}
                  />
                )}

                {activeSection === 'ipsec' && (
                  <IPsecTab 
                    deviceId={deviceId}
                    policies={ipsecPolicies}
                    peers={ipsecPeers}
                    profiles={ipsecProfiles}
                    activePeers={ipsecActivePeers}
                    onRefresh={() => loadSectionData('ipsec')}
                  />
                )}

                {activeSection === 'terminal' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Terminal Manager</h2>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: getStatusColor(device?.status || 'disconnected')
                          }}
                        ></span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
                          {device?.status || 'Disconnected'}
                        </span>
                      </div>
                    </div>
                    
                    {/* Embedded Terminal Manager */}
                    <div style={{ height: '800px', minHeight: '600px' }}>
                      <UnifiedTerminalManager 
                        onClose={() => {}} // No close needed for embedded version
                        deviceId={deviceId}
                        devices={device ? [{
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
                        }] : []}
                      />
                      </div>
                  </div>
                )}

                {activeSection === 'backup' && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
                      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>Configuration Backups</h2>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button 
                          className="btn btn-primary btn-sm" 
                          onClick={createBackup}
                          disabled={isDataLoading}
                        >
                          {isDataLoading ? 'Creating...' : 'Create Backup'}
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm" 
                          onClick={uploadBackup}
                          disabled={isDataLoading}
                          style={{
                            backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                            borderColor: 'rgba(var(--border-rgb), 0.5)',
                            color: 'var(--text-primary)'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                            e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.3)';
                            e.currentTarget.style.borderColor = 'rgba(var(--border-rgb), 0.5)';
                          }}
                        >
                          Upload Backup
                        </button>
                      </div>
                    </div>
                    
                    {backups.length === 0 ? (
                      <div className="card" style={{ textAlign: 'center', padding: 'var(--space-6)' }}>
                        <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24" style={{ margin: '0 auto var(--space-3)', color: 'rgb(var(--secondary-rgb))' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                        </svg>
                        <p style={{ marginBottom: 'var(--space-3)', color: 'rgb(var(--secondary-rgb))' }}>No backups available</p>
                        <button className="btn btn-primary btn-sm" onClick={createBackup}>Create First Backup</button>
                      </div>
                    ) : (
                      <>
                        {/* Search Bar */}
                        <div style={{ marginBottom: 'var(--space-4)' }}>
                          <input 
                            type="text"
                            placeholder="Search backups..."
                            style={{
                              width: '100%',
                              maxWidth: '300px',
                              padding: 'var(--space-2) var(--space-3)',
                              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                              border: '1px solid rgba(var(--border-rgb), 0.5)',
                              borderRadius: 'var(--space-2)',
                              color: 'rgb(var(--foreground-rgb))',
                              fontSize: '0.875rem',
                              backdropFilter: 'blur(12px)',
                              outline: 'none'
                            }}
                            onFocus={(e) => e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.5)'}
                            onBlur={(e) => e.target.style.borderColor = 'rgba(var(--border-rgb), 0.5)'}
                          />
                        </div>

                        {/* Glassmorphism Data Table */}
                        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ backgroundColor: 'rgba(var(--border-rgb), 0.4)' }}>
                                <th style={{ 
                                  padding: 'var(--space-3) var(--space-4)',
                                  textAlign: 'left',
                                  fontWeight: '600',
                                  fontSize: '0.875rem',
                                  color: 'rgb(var(--foreground-rgb))',
                                  borderBottom: '1px solid rgba(var(--border-rgb), 0.3)'
                                }}>
                                  Backup Name
                                </th>
                                <th style={{ 
                                  padding: 'var(--space-3) var(--space-4)',
                                  textAlign: 'left',
                                  fontWeight: '600',
                                  fontSize: '0.875rem',
                                  color: 'rgb(var(--foreground-rgb))',
                                  borderBottom: '1px solid rgba(var(--border-rgb), 0.3)'
                                }}>
                                  Size
                                </th>
                                <th style={{ 
                                  padding: 'var(--space-3) var(--space-4)',
                                  textAlign: 'left',
                                  fontWeight: '600',
                                  fontSize: '0.875rem',
                                  color: 'rgb(var(--foreground-rgb))',
                                  borderBottom: '1px solid rgba(var(--border-rgb), 0.3)'
                                }}>
                                  Created
                                </th>
                                <th style={{ 
                                  padding: 'var(--space-3) var(--space-4)',
                                  textAlign: 'left',
                                  fontWeight: '600',
                                  fontSize: '0.875rem',
                                  color: 'rgb(var(--foreground-rgb))',
                                  borderBottom: '1px solid rgba(var(--border-rgb), 0.3)'
                                }}>
                                  Status
                                </th>
                                <th style={{ 
                                  padding: 'var(--space-3) var(--space-4)',
                                  textAlign: 'right',
                                  fontWeight: '600',
                                  fontSize: '0.875rem',
                                  color: 'rgb(var(--foreground-rgb))',
                                  borderBottom: '1px solid rgba(var(--border-rgb), 0.3)'
                                }}>
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {backups.map((backup, index) => (
                                <tr 
                                  key={backup.id}
                                  style={{ 
                                    borderBottom: index === backups.length - 1 ? 'none' : '1px solid rgba(var(--border-rgb), 0.2)',
                                    transition: 'background-color 0.2s ease'
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                >
                                  <td style={{ 
                                    padding: 'var(--space-3) var(--space-4)',
                                    fontFamily: 'var(--font-mono)',
                                    fontSize: '0.875rem',
                                    color: 'rgb(var(--foreground-rgb))'
                                  }}>
                                    {backup.name}
                                  </td>
                                  <td style={{ 
                                    padding: 'var(--space-3) var(--space-4)',
                                    fontSize: '0.875rem',
                                    color: 'rgb(var(--secondary-rgb))'
                                  }}>
                                    {backup.size}
                                  </td>
                                  <td style={{ 
                                    padding: 'var(--space-3) var(--space-4)',
                                    fontSize: '0.875rem',
                                    color: 'rgb(var(--secondary-rgb))'
                                  }}>
                                    {new Date(backup.creation_time).toLocaleString()}
                                  </td>
                                  <td style={{ 
                                    padding: 'var(--space-3) var(--space-4)',
                                    fontSize: '0.875rem'
                                  }}>
                                    <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                                      {backup.stored_locally && (
                                        <Tooltip content="Backup file is stored locally in the database" position="top">
                                          <span style={{
                                            padding: '2px 6px',
                                            fontSize: '0.7rem',
                                            backgroundColor: 'rgba(34, 197, 94, 0.2)',
                                            color: 'rgb(34, 197, 94)',
                                            borderRadius: '4px',
                                            fontWeight: '500'
                                          }}>
                                            Local
                                          </span>
                                        </Tooltip>
                                      )}
                                      {backup.available_on_device && (
                                        <Tooltip content="Backup file is available on the RouterOS device" position="top">
                                          <span style={{
                                            padding: '2px 6px',
                                            fontSize: '0.7rem',
                                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                                            color: 'rgb(59, 130, 246)',
                                            borderRadius: '4px',
                                            fontWeight: '500'
                                          }}>
                                            Device
                                          </span>
                                        </Tooltip>
                                      )}
                                      {!backup.stored_locally && !backup.available_on_device && (
                                        <Tooltip content="Backup file is not available locally or on device" position="top">
                                          <span style={{
                                            padding: '2px 6px',
                                            fontSize: '0.7rem',
                                            backgroundColor: 'rgba(239, 68, 68, 0.2)',
                                            color: 'rgb(239, 68, 68)',
                                            borderRadius: '4px',
                                            fontWeight: '500'
                                          }}>
                                            Missing
                                          </span>
                                        </Tooltip>
                                      )}
                                    </div>
                                  </td>
                                  <td style={{ 
                                    padding: 'var(--space-3) var(--space-4)',
                                    textAlign: 'right'
                                  }}>
                                    <div style={{ display: 'flex', gap: 'var(--space-2)', justifyContent: 'flex-end' }}>
                                      <Tooltip 
                                        content={backup.stored_locally ? "Download backup file to your computer" : "Download backup from RouterOS device to local storage first"}
                                        position="top"
                                      >
                                        <button 
                                          onClick={() => downloadBackup(backup.id, backup.name)}
                                          style={{
                                            padding: 'var(--space-1) var(--space-2)',
                                            fontSize: '0.75rem',
                                            backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                                            border: '1px solid rgba(var(--primary-rgb), 0.3)',
                                            borderRadius: 'var(--space-1)',
                                            color: 'rgb(var(--primary-rgb))',
                                            cursor: 'pointer',
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
                                          Download
                                        </button>
                                      </Tooltip>

                                      {/* Show upload button for backups that are stored locally but not available on device */}
                                      {backup.stored_locally && !backup.available_on_device && (
                                        <Tooltip content="Upload backup file to RouterOS device" position="top">
                                          <button 
                                            onClick={() => uploadBackupToDevice(backup.id, backup.name)}
                                            style={{
                                              padding: 'var(--space-1) var(--space-2)',
                                              fontSize: '0.75rem',
                                              backgroundColor: 'rgba(59, 130, 246, 0.2)', // Blue color similar to primary
                                              border: '1px solid rgba(59, 130, 246, 0.3)',
                                              borderRadius: 'var(--space-1)',
                                              color: 'rgb(59, 130, 246)',
                                              cursor: 'pointer',
                                              transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.3)';
                                              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.5)';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.2)';
                                              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                                            }}
                                          >
                                            Upload
                                          </button>
                                        </Tooltip>
                                      )}
                                      <Tooltip content="Restore this backup on the RouterOS device" position="top">
                                        <button 
                                          onClick={() => restoreBackup(backup.id, backup.name)}
                                          disabled={!backup.stored_locally}
                                          style={{
                                            padding: 'var(--space-1) var(--space-2)',
                                            fontSize: '0.75rem',
                                            backgroundColor: !backup.stored_locally ? 'rgba(107, 114, 128, 0.2)' : 'rgba(var(--warning-rgb), 0.2)',
                                            border: `1px solid ${!backup.stored_locally ? 'rgba(107, 114, 128, 0.3)' : 'rgba(var(--warning-rgb), 0.3)'}`,
                                            borderRadius: 'var(--space-1)',
                                            color: !backup.stored_locally ? 'rgb(107, 114, 128)' : 'rgb(var(--warning-rgb))',
                                            cursor: !backup.stored_locally ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease',
                                            opacity: !backup.stored_locally ? 0.6 : 1
                                          }}
                                          onMouseEnter={(e) => {
                                            if (backup.stored_locally) {
                                              e.currentTarget.style.backgroundColor = 'rgba(var(--warning-rgb), 0.3)';
                                              e.currentTarget.style.borderColor = 'rgba(var(--warning-rgb), 0.5)';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            if (backup.stored_locally) {
                                              e.currentTarget.style.backgroundColor = 'rgba(var(--warning-rgb), 0.2)';
                                              e.currentTarget.style.borderColor = 'rgba(var(--warning-rgb), 0.3)';
                                            }
                                          }}
                                        >
                                          Restore
                                        </button>
                                      </Tooltip>

                                      {/* Show delete from device button for backups available on device */}
                                      {backup.available_on_device && (
                                        <Tooltip content="Delete backup file from RouterOS device" position="top">
                                          <button 
                                            onClick={() => deleteBackupFromDevice(backup.id, backup.name)}
                                            style={{
                                              padding: 'var(--space-1) var(--space-2)',
                                              fontSize: '0.75rem',
                                              backgroundColor: 'rgba(245, 101, 101, 0.2)', // Different red shade for device delete
                                              border: '1px solid rgba(245, 101, 101, 0.3)',
                                              borderRadius: 'var(--space-1)',
                                              color: 'rgb(245, 101, 101)',
                                              cursor: 'pointer',
                                              transition: 'all 0.2s ease'
                                            }}
                                            onMouseEnter={(e) => {
                                              e.currentTarget.style.backgroundColor = 'rgba(245, 101, 101, 0.3)';
                                              e.currentTarget.style.borderColor = 'rgba(245, 101, 101, 0.5)';
                                            }}
                                            onMouseLeave={(e) => {
                                              e.currentTarget.style.backgroundColor = 'rgba(245, 101, 101, 0.2)';
                                              e.currentTarget.style.borderColor = 'rgba(245, 101, 101, 0.3)';
                                            }}
                                          >
                                            Delete from Device
                                          </button>
                                        </Tooltip>
                                      )}
                                      
                                      <Tooltip 
                                        content={String(backup.id).startsWith('device_') ? 'Cannot delete device-only backups. Download them first to manage locally.' : 'Delete backup from local database'}
                                        position="top"
                                      >
                                        <button 
                                          onClick={() => deleteBackupFromLocal(backup.id, backup.name)}
                                          disabled={String(backup.id).startsWith('device_')}
                                          style={{
                                            padding: 'var(--space-1) var(--space-2)',
                                            fontSize: '0.75rem',
                                            backgroundColor: String(backup.id).startsWith('device_') ? 'rgba(107, 114, 128, 0.2)' : 'rgba(var(--error-rgb), 0.2)',
                                            border: `1px solid ${String(backup.id).startsWith('device_') ? 'rgba(107, 114, 128, 0.3)' : 'rgba(var(--error-rgb), 0.3)'}`,
                                            borderRadius: 'var(--space-1)',
                                            color: String(backup.id).startsWith('device_') ? 'rgb(107, 114, 128)' : 'rgb(var(--error-rgb))',
                                            cursor: String(backup.id).startsWith('device_') ? 'not-allowed' : 'pointer',
                                            transition: 'all 0.2s ease',
                                            opacity: String(backup.id).startsWith('device_') ? 0.6 : 1
                                          }}
                                          onMouseEnter={(e) => {
                                            if (!String(backup.id).startsWith('device_')) {
                                              e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.3)';
                                              e.currentTarget.style.borderColor = 'rgba(var(--error-rgb), 0.5)';
                                            }
                                          }}
                                          onMouseLeave={(e) => {
                                            if (!String(backup.id).startsWith('device_')) {
                                              e.currentTarget.style.backgroundColor = 'rgba(var(--error-rgb), 0.2)';
                                              e.currentTarget.style.borderColor = 'rgba(var(--error-rgb), 0.3)';
                                            }
                                          }}
                                        >
                                          Delete from Local
                                        </button>
                                      </Tooltip>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Backup"
        message={deleteBackupData ? `Are you sure you want to delete the backup "${deleteBackupData.name}" from local storage? This action cannot be undone.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        type="danger"
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
      />

      <ConfirmDialog
        isOpen={showDeviceDeleteDialog}
        title="Delete Backup from Device"
        message={deviceDeleteBackupData ? `Are you sure you want to delete the backup "${deviceDeleteBackupData.name}" from the RouterOS device? This action cannot be undone.` : ''}
        confirmText="Delete from Device"
        cancelText="Cancel"
        type="danger"
        onConfirm={handleDeviceDeleteConfirm}
        onCancel={handleDeviceDeleteCancel}
      />

      <ConfirmDialog
        isOpen={showRestoreDialog}
        title="Restore Backup"
        message={restoreBackupData ? `Are you sure you want to restore the backup "${restoreBackupData.name}"? This will reboot the RouterOS device and restore it to the state when this backup was created. This action cannot be undone.` : ''}
        confirmText="Restore"
        cancelText="Cancel"
        type="warning"
        onConfirm={handleRestoreConfirm}
        onCancel={handleRestoreCancel}
      />


    </AppLayout>
  );
} 