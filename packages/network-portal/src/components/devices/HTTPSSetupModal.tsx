'use client';

import React from 'react';
import { HTTPSSetupProgress } from './HTTPSSetupProgress';
import type { HTTPSSetupRecommendation } from '@/types/https-setup';

interface Device {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  username: string;
  password: string;
  useSSL: boolean;
}

interface HTTPSSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: any; // Use any to handle both pending devices and saved devices
  recommendation: HTTPSSetupRecommendation;
  onConfirm: (device: any) => Promise<void>;
  isProcessing: boolean;
  currentStep: number;
  error: string | null;
  success: boolean;
}

export function HTTPSSetupModal({
  isOpen,
  onClose,
  device,
  recommendation,
  onConfirm,
  isProcessing,
  currentStep,
  error,
  success
}: HTTPSSetupModalProps) {

  console.log('🎭 HTTPSSetupModal render:', { isOpen, device: device?.name, recommendation: recommendation?.canUpgrade });

  if (!isOpen) {
    console.log('🚫 Modal not open, returning null');
    return null;
  }

  const handleConfirm = async () => {
    try {
      await onConfirm(device);
    } catch (err) {
      // Error handling is now managed by the parent component
      console.error('HTTPS setup failed:', err);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(4px)',
      WebkitBackdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: 'rgba(var(--background-rgb), 0.95)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(var(--border-rgb), 0.8)',
        borderRadius: '16px',
        padding: '32px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 40px 0 rgba(0, 0, 0, 0.4)',
        position: 'relative'
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          disabled={isProcessing}
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            background: 'none',
            border: 'none',
            color: 'rgb(var(--secondary-rgb))',
            cursor: isProcessing ? 'not-allowed' : 'pointer',
            fontSize: '20px',
            opacity: isProcessing ? 0.5 : 1
          }}
        >
          ×
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{
            width: '64px',
            height: '64px',
            margin: '0 auto 16px',
            borderRadius: '50%',
            backgroundColor: 'rgba(var(--success-rgb), 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '2px solid rgba(var(--success-rgb), 0.4)'
          }}>
            {/* Shield/Lock icon */}
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--success-rgb))" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <circle cx="12" cy="16" r="1"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          
          <h2 style={{
            fontSize: '24px',
            fontWeight: '600',
            color: 'rgb(var(--foreground-rgb))',
            margin: '0 0 8px 0',
            letterSpacing: '-0.02em'
          }}>
            Enable HTTPS Security
          </h2>
          
          <p style={{
            fontSize: '14px',
            color: 'rgb(var(--secondary-rgb))',
            margin: 0,
            lineHeight: '1.5'
          }}>
            Secure your connection to {device.name}
          </p>
        </div>

        {/* Content */}
        {success ? (
          /* Success State */
          <div style={{ textAlign: 'center' }}>
            <div style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 24px',
              borderRadius: '50%',
              backgroundColor: 'rgba(var(--success-rgb), 0.2)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '3px solid rgba(var(--success-rgb), 0.4)'
            }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--success-rgb))" strokeWidth="2">
                <path d="M7 13l3 3 7-7"/>
              </svg>
            </div>
            
            <h3 style={{
              fontSize: '20px',
              fontWeight: '600',
              color: 'rgb(var(--foreground-rgb))',
              margin: '0 0 12px 0'
            }}>
              HTTPS Security Enabled!
            </h3>
            
            <p style={{
              fontSize: '14px',
              color: 'rgb(var(--secondary-rgb))',
              margin: '0 0 24px 0',
              lineHeight: '1.5'
            }}>
              Your connection to <strong>{device.name}</strong> is now secured with SSL encryption.
              The device will now use HTTPS on port {recommendation.recommendedPort}.
            </p>

            <div style={{
              backgroundColor: 'rgba(var(--success-rgb), 0.1)',
              border: '1px solid rgba(var(--success-rgb), 0.3)',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '24px',
              textAlign: 'left'
            }}>
              <div style={{
                fontSize: '13px',
                color: 'rgb(var(--success-rgb))',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                ✅ SSH Key Authentication Configured
              </div>
              <div style={{
                fontSize: '13px',
                color: 'rgb(var(--success-rgb))',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                ✅ SSL Certificate Generated
              </div>
              <div style={{
                fontSize: '13px',
                color: 'rgb(var(--success-rgb))',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                ✅ HTTPS Service Enabled (Port 443)
              </div>
              <div style={{
                fontSize: '13px',
                color: 'rgb(var(--success-rgb))',
                fontWeight: '500',
                marginBottom: '8px'
              }}>
                ✅ Insecure Services Disabled (HTTP/FTP)
              </div>
              <div style={{
                fontSize: '13px',
                color: 'rgb(var(--success-rgb))',
                fontWeight: '500'
              }}>
                ✅ Secure Connection Verified
              </div>
            </div>

            <button
              onClick={onClose}
              style={{
                padding: '12px 32px',
                backgroundColor: 'rgb(var(--success-rgb))',
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                boxShadow: '0 4px 12px 0 rgba(var(--success-rgb), 0.3)'
              }}
            >
              Continue
            </button>
          </div>
        ) : !isProcessing ? (
          <div>
            {/* Device info card */}
            <div style={{
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgb(var(--foreground-rgb))'
                }}>
                  Current Connection
                </span>
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: 'rgba(var(--warning-rgb), 0.2)',
                  color: 'rgb(var(--warning-rgb))',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  HTTP (Unsecured)
                </span>
              </div>
              
              <div style={{
                fontSize: '13px',
                color: 'rgb(var(--secondary-rgb))',
                lineHeight: '1.4'
              }}>
                <div>{device.ipAddress}:{recommendation.currentPort}</div>
                <div style={{ marginTop: '4px' }}>
                  Data transmitted without encryption
                </div>
              </div>
            </div>

            {/* Arrow */}
            <div style={{
              textAlign: 'center',
              margin: '16px 0',
              color: 'rgb(var(--success-rgb))'
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M7 13l3 3 7-7"/>
              </svg>
            </div>

            {/* After setup info */}
            <div style={{
              backgroundColor: 'rgba(var(--success-rgb), 0.1)',
              border: '1px solid rgba(var(--success-rgb), 0.3)',
              borderRadius: '12px',
              padding: '20px',
              marginBottom: '24px',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgb(var(--foreground-rgb))'
                }}>
                  After Setup
                </span>
                <span style={{
                  padding: '4px 8px',
                  backgroundColor: 'rgba(var(--success-rgb), 0.2)',
                  color: 'rgb(var(--success-rgb))',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  HTTPS (Secured)
                </span>
              </div>
              
              <div style={{
                fontSize: '13px',
                color: 'rgb(var(--secondary-rgb))',
                lineHeight: '1.4'
              }}>
                <div>{device.ipAddress}:{recommendation.recommendedPort}</div>
                <div style={{ marginTop: '4px' }}>
                  Encrypted connection with SSL certificate
                </div>
              </div>
            </div>

            {/* What will happen / Diagnostics */}
            {recommendation.canUpgrade ? (
              <div style={{
                backgroundColor: 'rgba(var(--border-rgb), 0.2)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgb(var(--foreground-rgb))',
                  margin: '0 0 12px 0'
                }}>
                  What will happen:
                </h4>
                <ul style={{
                  margin: 0,
                  paddingLeft: '20px',
                  fontSize: '13px',
                  color: 'rgb(var(--secondary-rgb))',
                  lineHeight: '1.5'
                }}>
                  <li>Generate SSH key pair and configure key-based authentication</li>
                  <li>Disable password authentication for enhanced security</li>
                  <li>Generate SSL certificate on the router</li>
                  <li>Enable HTTPS service on port {recommendation.recommendedPort}</li>
                  <li>Disable insecure services (HTTP and FTP)</li>
                  <li>Verify secure connection and update device settings</li>
                </ul>
              </div>
            ) : (
              /* SSH Diagnostics */
              <div style={{
                backgroundColor: 'rgba(var(--warning-rgb), 0.1)',
                border: '1px solid rgba(var(--warning-rgb), 0.3)',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '24px'
              }}>
                <h4 style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgb(var(--warning-rgb))',
                  margin: '0 0 12px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                  SSH Setup Required
                </h4>
                
                <p style={{
                  fontSize: '13px',
                  color: 'rgb(var(--secondary-rgb))',
                  margin: '0 0 16px 0',
                  lineHeight: '1.5'
                }}>
                  HTTPS setup requires SSH access to configure certificates. We detected the following issues:
                </p>

                {recommendation.sshDiagnostics?.possibleIssues && recommendation.sshDiagnostics.possibleIssues.length > 0 && (
                  <div style={{ marginBottom: '16px' }}>
                    <h5 style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: 'rgb(var(--warning-rgb))',
                      margin: '0 0 8px 0'
                    }}>
                      Issues Found:
                    </h5>
                    <ul style={{
                      margin: 0,
                      paddingLeft: '20px',
                      fontSize: '12px',
                      color: 'rgb(var(--secondary-rgb))',
                      lineHeight: '1.4'
                    }}>
                      {recommendation.sshDiagnostics.possibleIssues.map((issue, index) => (
                        <li key={index}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {recommendation.sshDiagnostics?.suggestedFixes && recommendation.sshDiagnostics.suggestedFixes.length > 0 && (
                  <div>
                    <h5 style={{
                      fontSize: '13px',
                      fontWeight: '500',
                      color: 'rgb(var(--success-rgb))',
                      margin: '0 0 8px 0'
                    }}>
                      Suggested Fixes:
                    </h5>
                    <ul style={{
                      margin: 0,
                      paddingLeft: '20px',
                      fontSize: '12px',
                      color: 'rgb(var(--secondary-rgb))',
                      lineHeight: '1.4'
                    }}>
                      {recommendation.sshDiagnostics.suggestedFixes.map((fix, index) => (
                        <li key={index} style={{ 
                          fontFamily: fix.startsWith('/') ? 'monospace' : 'inherit',
                          backgroundColor: fix.startsWith('/') ? 'rgba(var(--border-rgb), 0.3)' : 'transparent',
                          padding: fix.startsWith('/') ? '2px 4px' : '0',
                          borderRadius: fix.startsWith('/') ? '3px' : '0',
                          marginBottom: '4px'
                        }}>
                          {fix}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div style={{
                backgroundColor: 'rgba(var(--error-rgb), 0.1)',
                border: '1px solid rgba(var(--error-rgb), 0.3)',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '24px',
                color: 'rgb(var(--error-rgb))',
                fontSize: '14px'
              }}>
                {error}
              </div>
            )}

            {/* Action buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={onClose}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  border: '1px solid rgba(var(--border-rgb), 0.6)',
                  borderRadius: '8px',
                  color: 'rgb(var(--secondary-rgb))',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease-in-out',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)'
                }}
              >
                {recommendation.canUpgrade ? 'Skip for Now' : 'Close'}
              </button>
              
              {recommendation.canUpgrade && (
                <button
                  onClick={handleConfirm}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: 'rgb(var(--success-rgb))',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out',
                    boxShadow: '0 4px 12px 0 rgba(var(--success-rgb), 0.3)'
                  }}
                >
                  Enable HTTPS Security
                </button>
              )}
            </div>
          </div>
        ) : (
          <HTTPSSetupProgress 
            currentStep={currentStep}
            error={error}
          />
        )}
      </div>
    </div>
  );
} 