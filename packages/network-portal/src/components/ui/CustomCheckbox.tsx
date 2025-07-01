import React from 'react';

interface CustomCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  indeterminate?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  style?: React.CSSProperties;
}

export function CustomCheckbox({
  checked,
  onChange,
  indeterminate = false,
  disabled = false,
  size = 'md',
  className = '',
  style = {}
}: CustomCheckboxProps) {
  const sizeMap = {
    sm: '14px',
    md: '16px',
    lg: '20px'
  };

  const checkboxSize = sizeMap[size];

  const handleChange = () => {
    if (!disabled) {
      onChange(!checked);
    }
  };

  return (
    <div
      onClick={handleChange}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: checkboxSize,
        height: checkboxSize,
        borderRadius: 'var(--space-1)',
        border: `1px solid ${checked || indeterminate ? 'rgba(var(--primary-rgb), 0.6)' : 'rgba(var(--border-rgb), 0.6)'}`,
        backgroundColor: checked || indeterminate 
          ? 'rgba(var(--primary-rgb), 0.2)' 
          : 'rgba(var(--border-rgb), 0.3)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s ease-in-out',
        opacity: disabled ? 0.6 : 1,
        ...style
      }}
      className={className}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = 'rgba(var(--primary-rgb), 0.8)';
          e.currentTarget.style.backgroundColor = checked || indeterminate 
            ? 'rgba(var(--primary-rgb), 0.3)' 
            : 'rgba(var(--primary-rgb), 0.1)';
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = checked || indeterminate 
            ? 'rgba(var(--primary-rgb), 0.6)' 
            : 'rgba(var(--border-rgb), 0.6)';
          e.currentTarget.style.backgroundColor = checked || indeterminate 
            ? 'rgba(var(--primary-rgb), 0.2)' 
            : 'rgba(var(--border-rgb), 0.3)';
        }
      }}
    >
      {indeterminate ? (
        <svg 
          width={size === 'sm' ? '8' : size === 'md' ? '10' : '12'} 
          height="2" 
          viewBox="0 0 12 2" 
          fill="none"
        >
          <rect 
            width="12" 
            height="2" 
            rx="1" 
            fill="rgb(var(--primary-rgb))" 
          />
        </svg>
      ) : checked ? (
        <svg 
          width={size === 'sm' ? '8' : size === 'md' ? '10' : '12'} 
          height={size === 'sm' ? '8' : size === 'md' ? '10' : '12'} 
          viewBox="0 0 12 12" 
          fill="none"
        >
          <path 
            d="M10 3L4.5 8.5L2 6" 
            stroke="rgb(var(--primary-rgb))" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </div>
  );
} 