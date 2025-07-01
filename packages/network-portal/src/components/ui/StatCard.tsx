'use client';

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  trend?: 'up' | 'down' | 'neutral';
  icon?: React.ReactNode;
}

export function StatCard({ title, value, subtitle, trend = 'neutral', icon }: StatCardProps) {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'rgb(var(--success-rgb))';
      case 'down':
        return 'rgb(var(--error-rgb))';
      default:
        return 'rgb(var(--secondary-rgb))';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
        );
      case 'down':
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="23 18 13.5 8.5 8.5 13.5 1 6" />
            <polyline points="17 18 23 18 23 12" />
          </svg>
        );
      default:
        return (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        );
    }
  };

  return (
    <div className="card" style={{
      padding: 'var(--space-6)',
      transition: 'all 0.2s ease-in-out',
      cursor: 'default'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-3)'
      }}>
        <h4 style={{
          fontSize: '14px',
          fontWeight: '500',
          color: 'rgb(var(--secondary-rgb))',
          margin: 0,
          textTransform: 'uppercase' as const,
          letterSpacing: '0.025em'
        }}>
          {title}
        </h4>
        {icon && (
          <div style={{
            color: 'rgb(var(--primary-rgb))',
            opacity: 0.7
          }}>
            {icon}
          </div>
        )}
      </div>

      <div style={{
        marginBottom: subtitle ? 'var(--space-2)' : 0
      }}>
        <div style={{
          fontSize: '28px',
          fontWeight: '700',
          color: 'rgb(var(--foreground-rgb))',
          lineHeight: 1.2
        }}>
          {value}
        </div>
      </div>

      {subtitle && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)'
        }}>
          <span style={{
            color: getTrendColor(),
            display: 'flex',
            alignItems: 'center'
          }}>
            {getTrendIcon()}
          </span>
          <span style={{
            fontSize: '13px',
            color: 'rgb(var(--secondary-rgb))',
            lineHeight: 1.4
          }}>
            {subtitle}
          </span>
        </div>
      )}
    </div>
  );
} 