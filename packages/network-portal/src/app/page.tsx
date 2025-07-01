'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Device } from '../types/device';
import { AppLayout } from '../components/layout/app-layout';
import { Tooltip } from '../components/ui/Tooltip';
import { apiClient } from '@/lib/api-client';

// Dynamically import Terminal component with no SSR
const Terminal = dynamic(() => import('../components/terminal/Terminal').then(mod => ({ default: mod.Terminal })), {
  ssr: false,
  loading: () => null
});

interface DashboardStats {
  totalDevices: number;
  connectedDevices: number;
  disconnectedDevices: number;
  errorDevices: number;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats>({
    totalDevices: 0,
    connectedDevices: 0,
    disconnectedDevices: 0,
    errorDevices: 0,
  });
  const [recentDevices, setRecentDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalDeviceId, setTerminalDeviceId] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setIsLoading(true);
        const response = await apiClient.get('/api/devices');
        if (!response.ok) throw new Error('Failed to fetch dashboard data');
        
        const data = await response.json();
        const devices: Device[] = data.devices || [];

        setStats({
          totalDevices: devices.length,
          connectedDevices: devices.filter(d => d.status === 'connected').length,
          disconnectedDevices: devices.filter(d => d.status === 'disconnected').length,
          errorDevices: devices.filter(d => d.status === 'error').length,
        });

        const sortedDevices = devices.sort((a, b) => 
          new Date(b.lastSeen || b.createdAt || 0).getTime() - 
          new Date(a.lastSeen || a.createdAt || 0).getTime()
        );
        setRecentDevices(sortedDevices.slice(0, 5));

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchDashboardData();
  }, []);

  const getStatusColor = (status: string): string => {
    const statusMap: { [key: string]: string } = {
      connected: 'var(--success)',
      connecting: 'var(--warning)',
      error: 'var(--error)',
    };
    return statusMap[status] || 'var(--text-secondary)';
  };

  const StatCard = ({ title, value, icon, colorName }: { title: string, value: number, icon: React.ReactElement, colorName: string }) => (
    <div className="card stat-card">
      <div style={{ 
        padding: 'var(--space-4)', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between' 
      }}>
        <div>
          <p style={{ 
            fontSize: '0.875rem', 
            fontWeight: '500', 
            color: 'var(--text-secondary)',
            margin: 0,
            marginBottom: 'var(--space-1)'
          }}>
            {title}
          </p>
          <p style={{ 
            fontSize: '1.875rem', 
            fontWeight: '700', 
            margin: 0,
            color: `var(--${colorName})` 
          }}>
            {value}
          </p>
        </div>
        <div 
          style={{ 
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: 'var(--space-2)',
            backgroundColor: `rgba(var(--${colorName}-rgb, 128, 128, 128), 0.1)`,
            flexShrink: 0
          }}
        >
          {icon}
        </div>
      </div>
      
      <style jsx>{`
        @media (max-width: 768px) {
          .stat-card {
            padding: 0 !important;
          }
          .stat-card > div {
            padding: var(--space-3) !important;
          }
          .stat-card p:first-child {
            font-size: 0.75rem !important;
            margin-bottom: 2px !important;
          }
          .stat-card p:last-child {
            font-size: 1.25rem !important;
          }
          .stat-card > div > div:last-child {
            width: 32px !important;
            height: 32px !important;
          }
          .stat-card svg {
            width: 16px !important;
            height: 16px !important;
          }
        }
      `}</style>
    </div>
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div style={{ padding: 'var(--space-6)' }}>
          <div className="animate-pulse">
            <div className="h-8 rounded mb-6" style={{ backgroundColor: 'var(--border-light)', width: '30%' }}></div>
            <div className="flex space-x-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 rounded w-1/4" style={{ backgroundColor: 'var(--border-light)' }}></div>
              ))}
            </div>
            <div className="flex space-x-8">
              <div className="h-96 rounded w-1/2" style={{ backgroundColor: 'var(--border-light)' }}></div>
              <div className="h-96 rounded w-1/2" style={{ backgroundColor: 'var(--border-light)' }}></div>
                      </div>
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
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '700', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
            Dashboard
          </h1>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            An overview of your RouterOS network.
          </p>
        </div>

        {/* Stats Grid - Responsive */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-8)' 
        }}
        className="stats-grid"
        >
        <style jsx>{`
          @media (max-width: 768px) {
            .stats-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: var(--space-3) !important;
              margin-bottom: var(--space-6) !important;
            }
          }
          @media (max-width: 480px) {
            .stats-grid {
              grid-template-columns: repeat(2, 1fr) !important;
              gap: var(--space-2) !important;
            }
          }
        `}</style>
          <StatCard 
            title="Total Devices" 
            value={stats.totalDevices} 
            colorName="primary"
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'rgb(var(--primary-rgb))' }}><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>}
          />
          <StatCard 
            title="Connected" 
            value={stats.connectedDevices} 
            colorName="success"
            icon={<svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'rgb(var(--success-rgb))' }}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
          <StatCard 
            title="Disconnected" 
            value={stats.disconnectedDevices} 
            colorName="text-secondary"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-secondary)' }}><circle cx="12" cy="12" r="10"></circle><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"></line></svg>}
          />
          <StatCard 
            title="Errors" 
            value={stats.errorDevices} 
            colorName="error"
            icon={<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'rgb(var(--error-rgb))' }}><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>}
          />
        </div>

        {/* Main Content Grid - Responsive */}
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 'var(--space-6)'
        }}>
          {/* Quick Actions Card */}
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>
              Quick Actions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <Link 
                href="/devices?action=add" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--space-3)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.2)',
                  border: '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--space-2)',
                  backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                  flexShrink: 0
                }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'rgb(var(--primary-rgb))' }}>
                    <line x1="12" y1="5" x2="12" y2="19"></line>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontWeight: '500', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    Add New Device
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Configure a new RouterOS device
                  </p>
                </div>
              </Link>

              <Link 
                href="/monitoring" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--space-3)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.2)',
                  border: '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--space-2)',
                  backgroundColor: 'rgba(var(--success-rgb), 0.1)',
                  flexShrink: 0
                }}>
                  <svg width="20" height="20" viewBox="0 0 128 128" fill="currentColor" style={{ color: 'rgb(var(--success-rgb))' }}>
                    <path d="M128 104.9v7.1H0V16h7v88.9h12.7V54.3h22.7v50.6h5.3V43.7h22.8v61.2h5.2V64.4h22.8v40.5z"/>
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontWeight: '500', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    View Monitoring
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Real-time system monitoring
                  </p>
                </div>
              </Link>

              <Link 
                href="/devices" 
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--space-3)',
                  backgroundColor: 'rgba(var(--border-rgb), 0.2)',
                  border: '1px solid transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                  e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                  e.currentTarget.style.borderColor = 'transparent';
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '40px',
                  height: '40px',
                  borderRadius: 'var(--space-2)',
                  backgroundColor: 'rgba(var(--warning-rgb), 0.1)',
                  flexShrink: 0
                }}>
                  <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" style={{ color: 'rgb(var(--warning-rgb))' }}>
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                    <line x1="6" y1="6" x2="6.01" y2="6"></line>
                    <line x1="6" y1="18" x2="6.01" y2="18"></line>
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontWeight: '500', fontSize: '0.95rem', color: 'var(--text-primary)', marginBottom: 'var(--space-1)' }}>
                    Manage Devices
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
                    Configure and edit devices
                  </p>
                </div>
              </Link>
            </div>
          </div>

          {/* Recent Devices Card */}
          <div className="card" style={{ padding: 'var(--space-6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                Recent Devices
              </h2>
              <Link 
                href="/devices" 
                style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '500', 
                  color: 'rgb(var(--primary-rgb))', 
                  textDecoration: 'none',
                  transition: 'color 0.2s ease'
                }}
                onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
              >
                View All
              </Link>
            </div>
            
            {recentDevices.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 'var(--space-10) var(--space-4)' }}>
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24" style={{ color: 'var(--text-secondary)', margin: '0 auto var(--space-2)' }}>
                  <rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect>
                  <rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect>
                  <line x1="6" y1="6" x2="6.01" y2="6"></line>
                  <line x1="6" y1="18" x2="6.01" y2="18"></line>
                </svg>
                <h3 style={{ fontWeight: '500', fontSize: '1rem', color: 'var(--text-primary)', marginBottom: 'var(--space-2)' }}>
                  No devices found
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
                  Add your first RouterOS device.
                </p>
                <Link 
                  href="/devices" 
                  className="btn btn-primary"
                  style={{ 
                    padding: 'var(--space-2) var(--space-4)',
                    fontSize: '0.875rem'
                  }}
                >
                  Add Device
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
                {recentDevices.map((device) => (
                  <div 
                    key={device.id} 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: 'var(--space-3)',
                      borderRadius: 'var(--space-2)',
                      backgroundColor: 'rgba(var(--border-rgb), 0.2)',
                      border: '1px solid transparent',
                      transition: 'all 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
                      e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.2)';
                      e.currentTarget.style.borderColor = 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                      <div 
                        style={{ 
                          width: '8px', 
                          height: '8px', 
                          borderRadius: '50%', 
                          backgroundColor: getStatusColor(device.status),
                          flexShrink: 0
                        }}
                      ></div>
                      <div>
                        <p style={{ fontWeight: '500', fontSize: '0.875rem', color: 'var(--text-primary)', margin: 0, marginBottom: 'var(--space-1)' }}>
                          {device.name}
                        </p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
                          {device.ipAddress}:{device.port}
                        </p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                      {/* Configure Button */}
                      <Tooltip content="Configure Device">
                        <button
                        onClick={() => router.push(`/configuration/${device.id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--space-2)',
                          border: '1px solid rgba(var(--primary-rgb), 0.3)',
                          backgroundColor: 'rgba(var(--primary-rgb), 0.1)',
                          color: 'rgb(var(--primary-rgb))',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          padding: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.3)';
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"></path>
                          <circle cx="12" cy="12" r="3"></circle>
                        </svg>
                      </button>
                      </Tooltip>

                      {/* Terminal Button */}
                      <Tooltip content="Open Terminal">
                      <button
                        onClick={() => {
                          setTerminalDeviceId(device.id);
                          setIsTerminalOpen(true);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--space-2)',
                          border: '1px solid rgba(var(--warning-rgb), 0.3)',
                          backgroundColor: 'rgba(var(--warning-rgb), 0.1)',
                          color: 'rgb(var(--warning-rgb))',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          padding: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--warning-rgb), 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(var(--warning-rgb), 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--warning-rgb), 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(var(--warning-rgb), 0.3)';
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <polyline points="4,17 10,11 4,5"></polyline>
                          <line x1="12" y1="19" x2="20" y2="19"></line>
                        </svg>
                      </button>
                      </Tooltip>

                      {/* Monitor Button */}
                      <Tooltip content="Monitor Device">
                      <button
                        onClick={() => router.push(`/monitoring?deviceId=${device.id}`)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--space-2)',
                          border: '1px solid rgba(var(--success-rgb), 0.3)',
                          backgroundColor: 'rgba(var(--success-rgb), 0.1)',
                          color: 'rgb(var(--success-rgb))',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          padding: 0
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--success-rgb), 0.2)';
                          e.currentTarget.style.borderColor = 'rgba(var(--success-rgb), 0.5)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'rgba(var(--success-rgb), 0.1)';
                          e.currentTarget.style.borderColor = 'rgba(var(--success-rgb), 0.3)';
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 128 128" fill="currentColor">
                          <path d="M128 104.9v7.1H0V16h7v88.9h12.7V54.3h22.7v50.6h5.3V43.7h22.8v61.2h5.2V64.4h22.8v40.5z"/>
                        </svg>
                      </button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Terminal Modal */}
        {isTerminalOpen && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }}>
            <div style={{ maxWidth: '95vw', maxHeight: '95vh', width: '1400px', height: '800px' }}>
              <Terminal
                deviceId={terminalDeviceId}
                deviceName={recentDevices.find(d => d.id === terminalDeviceId)?.name || 'Unknown Device'}
                onClose={() => setIsTerminalOpen(false)}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
