'use client';

import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/app-layout';
import { DiskUsageDashboard } from '@/components/admin/disk-management/disk-usage-dashboard';
import { RetentionPolicyManager } from '@/components/admin/disk-management/retention-policy-manager';
import { CleanupOperations } from '@/components/admin/disk-management/cleanup-operations';
import { StoragePredictions } from '@/components/admin/disk-management/storage-predictions';
import { useDiskManagement } from '@/hooks/use-disk-management';

type TabType = 'overview' | 'retention' | 'cleanup' | 'predictions';

export default function DiskManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [isLoading, setIsLoading] = useState(true);

  // Move the hook to parent component to prevent recreation on tab switches
  // Apply memory pattern: store hook result in const first
  const diskManagementHookResult = useDiskManagement();

  useEffect(() => {
    // Simulate initial loading
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const tabs = [
    { 
      id: 'overview' as TabType, 
      label: 'Overview', 
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      )
    },
    { 
      id: 'retention' as TabType, 
      label: 'Retention Policies', 
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12,6 12,12 16,14" />
        </svg>
      )
    },
    { 
      id: 'cleanup' as TabType, 
      label: 'Cleanup Operations', 
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c0-1 1-2 2-2v2" />
          <line x1="10" y1="11" x2="10" y2="17" />
          <line x1="14" y1="11" x2="14" y2="17" />
        </svg>
      )
    },
    { 
      id: 'predictions' as TabType, 
      label: 'Storage Predictions', 
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
      )
    }
  ];

  if (isLoading) {
    return (
      <AppLayout>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '400px'
        }}>
          <div style={{
            padding: 'var(--space-8)',
            backgroundColor: 'rgba(var(--border-rgb), 0.3)',
            border: '1px solid rgba(var(--border-rgb), 0.5)',
            borderRadius: 'var(--space-4)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            textAlign: 'center' as const
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              border: '3px solid rgba(var(--primary-rgb), 0.3)',
              borderTop: '3px solid rgb(var(--primary-rgb))',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto var(--space-4)'
            }} />
            <p style={{ 
              color: 'rgb(var(--foreground-rgb))',
              fontSize: '14px',
              margin: 0
            }}>
              Loading disk management...
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{
        padding: 'var(--space-6)',
        maxWidth: '1400px',
        margin: '0 auto'
      }}>
        {/* Page Header */}
        <div style={{ marginBottom: 'var(--space-6)' }}>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            letterSpacing: '-0.025em',
            margin: '0 0 8px 0',
            color: 'rgb(var(--foreground-rgb))'
          }}>
            Disk Management
          </h1>
          <p style={{
            fontSize: '15px',
            color: 'rgb(var(--secondary-rgb))',
            margin: 0,
            lineHeight: 1.5
          }}>
            Monitor disk usage, manage data retention policies, and optimize database performance
          </p>
        </div>

        {/* Tab Navigation */}
        <div style={{
          backgroundColor: 'rgba(var(--border-rgb), 0.3)',
          border: '1px solid rgba(var(--border-rgb), 0.5)',
          borderRadius: 'var(--space-4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          padding: 'var(--space-2)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          gap: 'var(--space-1)',
          overflowX: 'auto' as const
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: 'var(--space-3) var(--space-4)',
                backgroundColor: activeTab === tab.id 
                  ? 'rgba(var(--primary-rgb), 0.2)' 
                  : 'transparent',
                border: activeTab === tab.id 
                  ? '1px solid rgba(var(--primary-rgb), 0.5)' 
                  : '1px solid transparent',
                borderRadius: 'var(--space-2)',
                color: activeTab === tab.id 
                  ? 'rgb(var(--primary-rgb))' 
                  : 'rgb(var(--secondary-rgb))',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                whiteSpace: 'nowrap' as const,
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)'
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.backgroundColor = 'rgba(var(--border-rgb), 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div style={{
          minHeight: '600px'
        }}>
          <div style={{ display: activeTab === 'overview' ? 'block' : 'none' }}>
            <DiskUsageDashboard />
          </div>
          <div style={{ display: activeTab === 'retention' ? 'block' : 'none' }}>
            <RetentionPolicyManager diskManagementHook={diskManagementHookResult} />
          </div>
          <div style={{ display: activeTab === 'cleanup' ? 'block' : 'none' }}>
            <CleanupOperations />
          </div>
          <div style={{ display: activeTab === 'predictions' ? 'block' : 'none' }}>
            <StoragePredictions />
          </div>
        </div>
      </div>

      {/* Loading Animation Keyframes */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </AppLayout>
  );
} 