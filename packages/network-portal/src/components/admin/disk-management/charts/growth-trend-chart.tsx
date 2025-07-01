'use client';

import { useState, useEffect } from 'react';

interface GrowthDataPoint {
  timestamp: string;
  dailyGrowth: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  totalSize: number;
}

interface GrowthTrendChartProps {
  timeframe?: 'daily' | 'weekly' | 'monthly';
  days?: number;
}

export function GrowthTrendChart({ timeframe = 'daily', days = 30 }: GrowthTrendChartProps) {
  const [data, setData] = useState<GrowthDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGrowthData();
  }, [timeframe, days]);

  const fetchGrowthData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/disk/growth-trends?timeframe=${timeframe}&days=${days}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch growth trends');
      }
      
      const responseData = await response.json();
      setData(responseData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    });
  };

  const getGrowthValue = (point: GrowthDataPoint): number => {
    switch (timeframe) {
      case 'weekly': return point.weeklyGrowth;
      case 'monthly': return point.monthlyGrowth;
      default: return point.dailyGrowth;
    }
  };

  if (isLoading) {
    return (
      <div style={{
        height: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          width: '24px',
          height: '24px',
          border: '2px solid rgba(var(--primary-rgb), 0.3)',
          borderTop: '2px solid rgb(var(--primary-rgb))',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        height: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column' as const,
        gap: 'var(--space-2)'
      }}>
        <p style={{
          color: 'rgb(var(--error-rgb))',
          fontSize: '14px',
          margin: 0
        }}>
          Failed to load growth trends
        </p>
        <button
          onClick={fetchGrowthData}
          style={{
            padding: 'var(--space-2) var(--space-3)',
            backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
            border: '1px solid rgba(var(--primary-rgb), 0.5)',
            borderRadius: 'var(--space-2)',
            color: 'rgb(var(--primary-rgb))',
            fontSize: '12px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div style={{
        height: '300px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <p style={{
          color: 'rgb(var(--secondary-rgb))',
          fontSize: '14px',
          margin: 0
        }}>
          No growth data available
        </p>
      </div>
    );
  }

  // Chart dimensions and calculations
  const chartWidth = 400;
  const chartHeight = 250;
  const padding = { top: 20, right: 40, bottom: 50, left: 60 };
  const dataWidth = chartWidth - padding.left - padding.right;
  const dataHeight = chartHeight - padding.top - padding.bottom;

  const growthValues = data.map(getGrowthValue);
  const maxGrowth = Math.max(...growthValues, 0);
  const minGrowth = Math.min(...growthValues, 0);
  const growthRange = maxGrowth - minGrowth || 1;

  // Generate line path for growth trend
  const generateGrowthLine = () => {
    if (data.length === 0) return '';

    const points = data.map((point, index) => {
      const x = padding.left + (index / (data.length - 1)) * dataWidth;
      const value = getGrowthValue(point);
      const y = padding.top + dataHeight - ((value - minGrowth) / growthRange) * dataHeight;
      return `${x},${y}`;
    });

    return `M ${points.join(' L ')}`;
  };

  // Generate area under curve for positive growth
  const generatePositiveArea = () => {
    if (data.length === 0) return '';

    const zeroY = padding.top + dataHeight - ((0 - minGrowth) / growthRange) * dataHeight;
    
    const points = data.map((point, index) => {
      const x = padding.left + (index / (data.length - 1)) * dataWidth;
      const value = Math.max(getGrowthValue(point), 0);
      const y = padding.top + dataHeight - ((value - minGrowth) / growthRange) * dataHeight;
      return `${x},${y}`;
    });

    const firstX = padding.left;
    const lastX = padding.left + dataWidth;

    return `M ${firstX},${zeroY} L ${points.join(' L ')} L ${lastX},${zeroY} Z`;
  };

  // Generate Y-axis labels
  const yAxisLabels = [];
  for (let i = 0; i <= 4; i++) {
    const value = minGrowth + (growthRange * i) / 4;
    const y = padding.top + dataHeight - (i / 4) * dataHeight;
    yAxisLabels.push({ value, y });
  }

  // Generate X-axis labels (show every few points to avoid crowding)
  const xAxisLabels = [];
  const labelInterval = Math.max(1, Math.floor(data.length / 6));
  for (let i = 0; i < data.length; i += labelInterval) {
    const x = padding.left + (i / (data.length - 1)) * dataWidth;
    const dataPoint = data[i];
    if (dataPoint) {
      xAxisLabels.push({ 
        value: formatDate(dataPoint.timestamp), 
        x 
      });
    }
  }

  const averageGrowth = growthValues.reduce((sum, val) => sum + val, 0) / growthValues.length;
  const isGrowthPositive = averageGrowth > 0;

  return (
    <div style={{ width: '100%', height: '300px' }}>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        style={{ overflow: 'visible' }}
      >
        {/* Grid lines */}
        {yAxisLabels.map((label, index) => (
          <line
            key={index}
            x1={padding.left}
            y1={label.y}
            x2={padding.left + dataWidth}
            y2={label.y}
            stroke="rgba(var(--border-rgb), 0.3)"
            strokeWidth="1"
            strokeDasharray={index === 2 ? "2,2" : "none"} // Dashed line for zero
          />
        ))}

        {/* Zero line (if in range) */}
        {minGrowth < 0 && maxGrowth > 0 && (
          <line
            x1={padding.left}
            y1={padding.top + dataHeight - ((0 - minGrowth) / growthRange) * dataHeight}
            x2={padding.left + dataWidth}
            y2={padding.top + dataHeight - ((0 - minGrowth) / growthRange) * dataHeight}
            stroke="rgb(var(--secondary-rgb))"
            strokeWidth="2"
            strokeDasharray="3,3"
          />
        )}

        {/* Positive growth area */}
        <path
          d={generatePositiveArea()}
          fill="rgba(var(--success-rgb), 0.2)"
          stroke="none"
        />

        {/* Growth trend line */}
        <path
          d={generateGrowthLine()}
          fill="none"
          stroke={isGrowthPositive ? "rgb(var(--success-rgb))" : "rgb(var(--error-rgb))"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points */}
        {data.map((point, index) => {
          const x = padding.left + (index / (data.length - 1)) * dataWidth;
          const value = getGrowthValue(point);
          const y = padding.top + dataHeight - ((value - minGrowth) / growthRange) * dataHeight;
          
          return (
            <circle
              key={index}
              cx={x}
              cy={y}
              r="3"
              fill={value >= 0 ? "rgb(var(--success-rgb))" : "rgb(var(--error-rgb))"}
              stroke="white"
              strokeWidth="1"
            >
              <title>
                {formatDate(point.timestamp)}: {formatBytes(value)} {timeframe} growth
              </title>
            </circle>
          );
        })}

        {/* Y-axis labels */}
        {yAxisLabels.map((label, index) => (
          <text
            key={index}
            x={padding.left - 10}
            y={label.y + 4}
            textAnchor="end"
            fontSize="11"
            fill="rgb(var(--secondary-rgb))"
          >
            {formatBytes(label.value)}
          </text>
        ))}

        {/* X-axis labels */}
        {xAxisLabels.map((label, index) => (
          <text
            key={index}
            x={label.x}
            y={chartHeight - 10}
            textAnchor="middle"
            fontSize="10"
            fill="rgb(var(--secondary-rgb))"
          >
            {label.value}
          </text>
        ))}

        {/* Axis lines */}
        <line
          x1={padding.left}
          y1={padding.top}
          x2={padding.left}
          y2={padding.top + dataHeight}
          stroke="rgba(var(--border-rgb), 0.5)"
          strokeWidth="1"
        />
        <line
          x1={padding.left}
          y1={padding.top + dataHeight}
          x2={padding.left + dataWidth}
          y2={padding.top + dataHeight}
          stroke="rgba(var(--border-rgb), 0.5)"
          strokeWidth="1"
        />

        {/* Chart title */}
        <text
          x={chartWidth / 2}
          y={15}
          textAnchor="middle"
          fontSize="12"
          fill="rgb(var(--secondary-rgb))"
          fontWeight="500"
          style={{ textTransform: 'capitalize' }}
        >
          {timeframe} Growth Trend
        </text>
      </svg>

      {/* Summary stats */}
      <div style={{
        marginTop: 'var(--space-2)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-2)',
        backgroundColor: 'rgba(var(--border-rgb), 0.2)',
        borderRadius: 'var(--space-2)',
        fontSize: '12px'
      }}>
        <div style={{ color: 'rgb(var(--secondary-rgb))' }}>
          Average {timeframe} growth:
        </div>
        <div style={{
          fontWeight: '500',
          color: isGrowthPositive ? 'rgb(var(--success-rgb))' : 'rgb(var(--error-rgb))'
        }}>
          {isGrowthPositive ? '+' : ''}{formatBytes(averageGrowth)}
        </div>
      </div>
    </div>
  );
} 