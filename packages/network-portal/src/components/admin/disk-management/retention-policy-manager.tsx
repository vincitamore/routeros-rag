'use client';

import { useState } from 'react';
import { useDiskManagement, DEFAULT_RETENTION_CONFIG } from '@/hooks/use-disk-management';
import { RetentionPolicy, UseDiskManagementReturn } from '@/types/disk-management';

// Convert DEFAULT_RETENTION_CONFIG to array format for easier iteration
const DEFAULT_POLICIES = Object.values(DEFAULT_RETENTION_CONFIG);

interface RetentionPolicyManagerProps {
  diskManagementHook?: UseDiskManagementReturn;
}

export function RetentionPolicyManager({ diskManagementHook }: RetentionPolicyManagerProps) {
  // Use provided hook or create a new one (for backwards compatibility)
  const hookResult = diskManagementHook || useDiskManagement();
  
  // Apply memory pattern: store hook result in const first, then destructure
  // This prevents missing state updates due to React's batching behavior
  const { 
    retentionPolicies, 
    isLoadingPolicies, 
    policiesError, 
    updateRetentionPolicy 
  } = hookResult;



  const [editingPolicy, setEditingPolicy] = useState<RetentionPolicy | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleEdit = (policy: RetentionPolicy) => {
    setEditingPolicy({ ...policy });
  };

  const handleCancel = () => {
    setEditingPolicy(null);
  };

  const handleSave = async () => {
    if (!editingPolicy) return;
    
    try {
      setIsSaving(true);
      await updateRetentionPolicy(editingPolicy.dataType, editingPolicy);
      setEditingPolicy(null);
    } catch (err) {
      console.error('Error saving retention policy:', err);
      // Error is already handled by the hook
    } finally {
      setIsSaving(false);
    }
  };

  const updateEditingPolicy = (field: keyof RetentionPolicy, value: any) => {
    if (editingPolicy) {
      setEditingPolicy({
        ...editingPolicy,
        [field]: value
      });
    }
  };

  const formatDuration = (days: number): string => {
    if (days < 7) return `${days} day${days !== 1 ? 's' : ''}`;
    if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) !== 1 ? 's' : ''}`;
    if (days < 365) return `${Math.floor(days / 30)} month${Math.floor(days / 30) !== 1 ? 's' : ''}`;
    return `${Math.floor(days / 365)} year${Math.floor(days / 365) !== 1 ? 's' : ''}`;
  };

  if (isLoadingPolicies) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '400px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          border: '3px solid rgba(var(--primary-rgb), 0.3)',
          borderTop: '3px solid rgb(var(--primary-rgb))',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (policiesError) {
    return (
      <div className="card" style={{
        padding: 'var(--space-6)',
        textAlign: 'center' as const
      }}>
        <p style={{
          color: 'rgb(var(--error-rgb))',
          fontSize: '14px',
          margin: '0 0 var(--space-4) 0'
        }}>
          Error loading retention policies: {policiesError}
        </p>
        <p style={{
          color: 'rgb(var(--secondary-rgb))',
          fontSize: '13px',
          margin: '0 0 var(--space-4) 0'
        }}>
          Showing default configuration below. Changes will be saved once the backend is available.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div style={{
        marginBottom: 'var(--space-6)',
        padding: 'var(--space-4)',
        backgroundColor: 'rgba(var(--border-rgb), 0.2)',
        borderRadius: 'var(--space-3)',
        border: '1px solid rgba(var(--border-rgb), 0.3)'
      }}>
        <h2 style={{
          fontSize: '20px',
          fontWeight: '600',
          margin: '0 0 var(--space-2) 0',
          color: 'rgb(var(--foreground-rgb))'
        }}>
          Data Retention Policies
        </h2>
        <p style={{
          fontSize: '14px',
          color: 'rgb(var(--secondary-rgb))',
          margin: 0,
          lineHeight: 1.5
        }}>
          Configure how long different types of data are kept before automatic cleanup.
          Policies help maintain optimal database performance and comply with data governance requirements.
        </p>
      </div>

      {/* Show warning if using fallback data */}
      {retentionPolicies.length === 0 && !isLoadingPolicies && (
        <div style={{
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-3)',
          backgroundColor: 'rgba(var(--warning-rgb), 0.1)',
          border: '1px solid rgba(var(--warning-rgb), 0.3)',
          borderRadius: 'var(--space-2)',
          color: 'rgb(var(--warning-rgb))',
          fontSize: '14px'
        }}>
          <strong>Demo Mode:</strong> Showing default retention configuration. 
          Backend services are not yet implemented.
        </div>
      )}

      {/* Policies Grid */}
      <div style={{
        display: 'grid',
        gap: 'var(--space-4)',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))'
      }}>
        {DEFAULT_POLICIES.map((defaultPolicy) => {
          // Use actual policy if available, otherwise use default
          const policy = retentionPolicies.find(p => p.dataType === defaultPolicy.dataType) || defaultPolicy;
          const isEditing = editingPolicy?.dataType === defaultPolicy.dataType;

          return (
            <div key={defaultPolicy.dataType} className="card">
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-3)'
              }}>
                <div>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: '600',
                    margin: '0 0 var(--space-1) 0',
                    color: 'rgb(var(--foreground-rgb))',
                    fontFamily: 'monospace'
                  }}>
                    {defaultPolicy.dataType}
                  </h3>
                  <p style={{
                    fontSize: '13px',
                    color: 'rgb(var(--secondary-rgb))',
                    margin: 0
                  }}>
                    {defaultPolicy.description}
                  </p>
                </div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)'
                }}>
                  <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: policy.isEnabled 
                      ? 'rgb(var(--success-rgb))' 
                      : 'rgb(var(--secondary-rgb))'
                  }} />
                  <span style={{
                    fontSize: '12px',
                    color: policy.isEnabled 
                      ? 'rgb(var(--success-rgb))' 
                      : 'rgb(var(--secondary-rgb))'
                  }}>
                    {policy.isEnabled ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
              </div>

              {isEditing ? (
                // Edit Mode
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 'var(--space-3)' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: '12px',
                      fontWeight: '500',
                      color: 'rgb(var(--secondary-rgb))',
                      marginBottom: 'var(--space-1)',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.025em'
                    }}>
                      Max Age (Days)
                    </label>
                    <input
                      type="number"
                      value={editingPolicy?.maxAgeDays || 0}
                      onChange={(e) => updateEditingPolicy('maxAgeDays', parseInt(e.target.value))}
                      style={{
                        width: '100%',
                        padding: 'var(--space-2) var(--space-3)',
                        backgroundColor: 'rgba(var(--border-rgb), 0.4)',
                        border: '1px solid rgba(var(--border-rgb), 0.6)',
                        borderRadius: 'var(--space-2)',
                        color: 'rgb(var(--foreground-rgb))',
                        fontSize: '14px'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: '14px',
                      color: 'rgb(var(--foreground-rgb))',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={editingPolicy?.isEnabled || false}
                        onChange={(e) => updateEditingPolicy('isEnabled', e.target.checked)}
                        style={{ accentColor: 'rgb(var(--primary-rgb))' }}
                      />
                      Enabled
                    </label>

                    <label style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: '14px',
                      color: 'rgb(var(--foreground-rgb))',
                      cursor: 'pointer'
                    }}>
                      <input
                        type="checkbox"
                        checked={editingPolicy?.compressionEnabled || false}
                        onChange={(e) => updateEditingPolicy('compressionEnabled', e.target.checked)}
                        style={{ accentColor: 'rgb(var(--primary-rgb))' }}
                      />
                      Compression
                    </label>
                  </div>

                  <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                    <button
                      onClick={handleSave}
                      disabled={isSaving}
                      style={{
                        flex: 1,
                        padding: 'var(--space-2) var(--space-3)',
                        backgroundColor: 'rgb(var(--success-rgb))',
                        color: 'white',
                        border: 'none',
                        borderRadius: 'var(--space-2)',
                        fontSize: '14px',
                        fontWeight: '500',
                        cursor: isSaving ? 'not-allowed' : 'pointer',
                        opacity: isSaving ? 0.7 : 1
                      }}
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      onClick={handleCancel}
                      style={{
                        flex: 1,
                        padding: 'var(--space-2) var(--space-3)',
                        backgroundColor: 'transparent',
                        color: 'rgb(var(--secondary-rgb))',
                        border: '1px solid rgba(var(--border-rgb), 0.6)',
                        borderRadius: 'var(--space-2)',
                        fontSize: '14px',
                        cursor: 'pointer'
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                // View Mode
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{
                        fontSize: '12px',
                        color: 'rgb(var(--secondary-rgb))',
                        textTransform: 'uppercase' as const,
                        letterSpacing: '0.025em'
                      }}>
                        Retention Period
                      </span>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: 'rgb(var(--foreground-rgb))'
                      }}>
                        {formatDuration(policy.maxAgeDays)}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                      {policy.compressionEnabled && (
                        <div style={{
                          padding: 'var(--space-1) var(--space-2)',
                          backgroundColor: 'rgba(var(--warning-rgb), 0.2)',
                          border: '1px solid rgba(var(--warning-rgb), 0.5)',
                          borderRadius: 'var(--space-1)',
                          fontSize: '11px',
                          color: 'rgb(var(--warning-rgb))'
                        }}>
                          COMPRESSED
                        </div>
                      )}
                      
                      {policy.archivalEnabled && (
                        <div style={{
                          padding: 'var(--space-1) var(--space-2)',
                          backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                          border: '1px solid rgba(var(--primary-rgb), 0.5)',
                          borderRadius: 'var(--space-1)',
                          fontSize: '11px',
                          color: 'rgb(var(--primary-rgb))'
                        }}>
                          ARCHIVED
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{
                      fontSize: '13px',
                      color: 'rgb(var(--secondary-rgb))'
                    }}>
                      <span style={{ textTransform: 'uppercase', letterSpacing: '0.025em' }}>
                        Cleanup: 
                      </span>
                      <span style={{ marginLeft: 'var(--space-1)' }}>
                        {policy.cleanupFrequency}
                      </span>
                    </div>

                    <button
                      onClick={() => handleEdit(policy)}
                      style={{
                        padding: 'var(--space-1) var(--space-3)',
                        backgroundColor: 'transparent',
                        color: 'rgb(var(--primary-rgb))',
                        border: '1px solid rgba(var(--primary-rgb), 0.5)',
                        borderRadius: 'var(--space-1)',
                        fontSize: '12px',
                        cursor: 'pointer',
                        fontWeight: '500'
                      }}
                    >
                      Edit
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
} 