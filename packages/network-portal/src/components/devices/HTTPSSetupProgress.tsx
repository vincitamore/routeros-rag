'use client';

import React from 'react';

interface HTTPSSetupProgressProps {
  currentStep: number;
  error?: string | null;
}

const steps = [
  { label: 'Testing HTTP Connection', description: 'Verifying current connection' },
  { label: 'Setting up SSH Key Authentication', description: 'Generating secure SSH keys and disabling password auth' },
  { label: 'Creating SSL Certificates', description: 'Generating security certificates via SSH' },
  { label: 'Configuring HTTPS Service', description: 'Enabling secure web interface on port 443' },
  { label: 'Hardening Security', description: 'Disabling insecure services (HTTP/FTP)' },
  { label: 'Finalizing Configuration', description: 'Updating device settings and testing connection' }
];

export function HTTPSSetupProgress({ currentStep, error }: HTTPSSetupProgressProps) {
  return (
    <div style={{ textAlign: 'center' }}>
      <h3 style={{
        fontSize: '20px',
        fontWeight: '600',
        color: 'rgb(var(--foreground-rgb))',
        margin: '0 0 24px 0'
      }}>
        Setting up HTTPS...
      </h3>

      <div style={{ marginBottom: '32px' }}>
        {steps.map((step, index) => (
          <div
            key={index}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 0',
              opacity: index <= currentStep ? 1 : 0.4
            }}
          >
            {/* Step indicator */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: index < currentStep 
                ? 'rgb(var(--success-rgb))' 
                : index === currentStep 
                  ? 'rgb(var(--primary-rgb))' 
                  : 'rgba(var(--border-rgb), 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: '16px',
              flexShrink: 0
            }}>
              {index < currentStep ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M7 13l3 3 7-7"/>
                </svg>
              ) : index === currentStep ? (
                <div style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '50%',
                  backgroundColor: 'white',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
              ) : (
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(255, 255, 255, 0.3)'
                }} />
              )}
            </div>

            {/* Step content */}
            <div style={{ textAlign: 'left', flex: 1 }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '500',
                color: 'rgb(var(--foreground-rgb))',
                marginBottom: '2px'
              }}>
                {step.label}
              </div>
              <div style={{
                fontSize: '12px',
                color: 'rgb(var(--secondary-rgb))'
              }}>
                {step.description}
              </div>
            </div>
          </div>
        ))}
      </div>

      {error && (
        <div style={{
          backgroundColor: 'rgba(var(--error-rgb), 0.1)',
          border: '1px solid rgba(var(--error-rgb), 0.3)',
          borderRadius: '8px',
          padding: '16px',
          color: 'rgb(var(--error-rgb))',
          fontSize: '14px',
          marginTop: '16px'
        }}>
          <strong>Setup Failed:</strong> {error}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
} 