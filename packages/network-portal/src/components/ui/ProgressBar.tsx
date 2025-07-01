import React from 'react';

interface ProgressBarProps {
  value: number; // 0 to 100
  max?: number;
  showPercentage?: boolean;
  variant?: 'default' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
  label?: string;
}

export function ProgressBar({
  value,
  max = 100,
  showPercentage = true,
  variant = 'default',
  size = 'md',
  animated = false,
  className = '',
  label
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  
  const getVariantColors = () => {
    switch (variant) {
      case 'success':
        return {
          background: 'rgb(var(--success-rgb))',
          glow: 'rgba(var(--success-rgb), 0.3)'
        };
      case 'warning':
        return {
          background: 'rgb(var(--warning-rgb))',
          glow: 'rgba(var(--warning-rgb), 0.3)'
        };
      case 'error':
        return {
          background: 'rgb(var(--error-rgb))',
          glow: 'rgba(var(--error-rgb), 0.3)'
        };
      default:
        return {
          background: `linear-gradient(90deg, 
            rgb(var(--success-rgb)) 0%, 
            rgb(var(--warning-rgb)) 70%, 
            rgb(var(--error-rgb)) 90%)`,
          glow: 'rgba(var(--primary-rgb), 0.3)'
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { height: '6px', borderRadius: '3px' };
      case 'lg':
        return { height: '12px', borderRadius: '6px' };
      default:
        return { height: '8px', borderRadius: '4px' };
    }
  };

  const colors = getVariantColors();
  const sizeStyles = getSizeStyles();

  return (
    <div className={`progress-bar-container ${className}`}>
      {label && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px',
          fontSize: '0.875rem',
          color: 'rgb(var(--foreground-rgb))'
        }}>
          <span style={{ fontWeight: 500 }}>{label}</span>
          {showPercentage && (
            <span style={{ 
              color: 'rgb(var(--secondary-rgb))',
              fontSize: '0.8rem'
            }}>
              {percentage.toFixed(0)}%
            </span>
          )}
        </div>
      )}
      
      <div
        style={{
          width: '100%',
          backgroundColor: 'rgba(var(--border-rgb), 0.3)',
          border: '1px solid rgba(var(--border-rgb), 0.5)',
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
          overflow: 'hidden',
          position: 'relative',
          ...sizeStyles
        }}
      >
        <div
          style={{
            width: `${percentage}%`,
            height: '100%',
            background: colors.background,
            transition: animated ? 'width 0.3s ease-in-out, box-shadow 0.2s ease-in-out' : 'none',
            position: 'relative',
            boxShadow: `0 0 8px ${colors.glow}`
          }}
        >
          {animated && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: '-100%',
                width: '100%',
                height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent)',
                animation: 'progress-shimmer 2s infinite'
              }}
            />
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes progress-shimmer {
          0% {
            left: -100%;
          }
          100% {
            left: 100%;
          }
        }
      `}</style>
    </div>
  );
}

// Additional usage examples for disk management:

// Disk usage progress
export function DiskUsageProgress({ 
  used, 
  total, 
  label = "Disk Usage" 
}: { 
  used: number; 
  total: number; 
  label?: string; 
}) {
  const percentage = (used / total) * 100;
  const getVariant = () => {
    if (percentage >= 90) return 'error';
    if (percentage >= 75) return 'warning';
    return 'success';
  };

  return (
    <ProgressBar
      value={used}
      max={total}
      variant={getVariant()}
      label={label}
      showPercentage={true}
      animated={percentage > 85}
    />
  );
}

// Cleanup progress indicator
export function CleanupProgress({ 
  completed, 
  total, 
  label = "Cleanup Progress" 
}: { 
  completed: number; 
  total: number; 
  label?: string; 
}) {
  return (
    <ProgressBar
      value={completed}
      max={total}
      variant="success"
      label={label}
      animated={true}
      size="lg"
    />
  );
}

export default ProgressBar; 