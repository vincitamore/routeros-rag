'use client';

interface TableUsage {
  tableName: string;
  recordCount: number;
  sizeBytes: number;
  averageRowSize: number;
  indexSizeBytes: number;
  lastUpdated: string;
  growthRate: number;
}

interface TableBreakdownChartProps {
  data: TableUsage[];
}

export function TableBreakdownChart({ data }: TableBreakdownChartProps) {
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  if (!data || data.length === 0) {
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
          No table data available
        </p>
      </div>
    );
  }

  // Sort tables by size and take top 5 (instead of 10)
  const sortedData = [...data]
    .sort((a, b) => b.sizeBytes - a.sizeBytes)
    .slice(0, 5);

  const maxSize = Math.max(...sortedData.map(d => d.sizeBytes));
  const totalSize = data.reduce((sum, table) => sum + table.sizeBytes, 0);
  const top5Size = sortedData.reduce((sum, table) => sum + table.sizeBytes, 0);
  const coveragePercentage = ((top5Size / totalSize) * 100).toFixed(1);

  // Chart dimensions - better spacing for 5 bars
  const chartHeight = 220;
  const barHeight = 24;
  const barSpacing = 12;
  const labelWidth = 120;
  const chartWidth = 400;
  const barAreaWidth = chartWidth - labelWidth - 80; // 80px for value labels

  // Color palette for different tables
  const colors = [
    'rgb(var(--primary-rgb))',
    'rgb(var(--success-rgb))',
    'rgb(var(--warning-rgb))',
    'rgba(var(--primary-rgb), 0.8)',
    'rgba(var(--success-rgb), 0.8)'
  ];

  return (
    <div style={{ 
      width: '100%', 
      height: '300px',
      display: 'flex',
      flexDirection: 'column' as const
    }}>
      {/* Chart SVG - takes up most of the space */}
      <div style={{ 
        flex: '1',
        minHeight: '220px',
        marginBottom: 'var(--space-2)'
      }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          style={{ overflow: 'visible' }}
        >
          {sortedData.map((table, index) => {
            const y = 40 + index * (barHeight + barSpacing);
            const barWidth = (table.sizeBytes / maxSize) * barAreaWidth;
            const percentage = ((table.sizeBytes / totalSize) * 100).toFixed(1);

            return (
              <g key={table.tableName}>
                {/* Table name label */}
                <text
                  x={labelWidth - 5}
                  y={y + barHeight / 2 + 5}
                  textAnchor="end"
                  fontSize="13"
                  fill="rgb(var(--foreground-rgb))"
                  fontFamily="monospace"
                >
                  {table.tableName.length > 15 
                    ? `${table.tableName.substring(0, 15)}...` 
                    : table.tableName}
                </text>

                {/* Background bar */}
                <rect
                  x={labelWidth}
                  y={y}
                  width={barAreaWidth}
                  height={barHeight}
                  fill="rgba(var(--border-rgb), 0.3)"
                  rx="4"
                />

                {/* Data bar */}
                <rect
                  x={labelWidth}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill={colors[index % colors.length]}
                  rx="4"
                >
                  <title>
                    {`${table.tableName}: ${formatBytes(table.sizeBytes)} (${percentage}%)`}
                  </title>
                </rect>

                {/* Size label */}
                <text
                  x={labelWidth + barAreaWidth + 10}
                  y={y + barHeight / 2 + 5}
                  fontSize="12"
                  fill="rgb(var(--secondary-rgb))"
                >
                  {formatBytes(table.sizeBytes)}
                </text>

                {/* Percentage label inside bar if there's space */}
                {barWidth > 60 && (
                  <text
                    x={labelWidth + barWidth / 2}
                    y={y + barHeight / 2 + 5}
                    textAnchor="middle"
                    fontSize="11"
                    fill="white"
                    fontWeight="500"
                  >
                    {percentage}%
                  </text>
                )}
              </g>
            );
          })}

          {/* Chart title */}
          <text
            x={chartWidth / 2}
            y={25}
            textAnchor="middle"
            fontSize="14"
            fill="rgb(var(--foreground-rgb))"
            fontWeight="600"
          >
            Top 5 Tables by Size
          </text>
        </svg>
      </div>

      {/* Compact Summary Section - fixed height */}
      <div style={{
        backgroundColor: 'rgba(var(--border-rgb), 0.2)',
        border: '1px solid rgba(var(--border-rgb), 0.4)',
        borderRadius: 'var(--space-2)',
        padding: 'var(--space-2)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '60px',
        flexShrink: 0
      }}>
        <div style={{ textAlign: 'center' as const }}>
          <div style={{
            fontSize: '0.65rem',
            color: 'rgb(var(--secondary-rgb))',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.025em',
            marginBottom: '2px'
          }}>
            Total Logical Size
          </div>
          <div style={{
            fontSize: '0.9rem',
            fontWeight: '600',
            color: 'rgb(var(--foreground-rgb))'
          }}>
            {formatBytes(totalSize)}
          </div>
        </div>

        <div style={{ textAlign: 'center' as const }}>
          <div style={{
            fontSize: '0.65rem',
            color: 'rgb(var(--secondary-rgb))',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.025em',
            marginBottom: '2px'
          }}>
            Tables
          </div>
          <div style={{
            fontSize: '0.9rem',
            fontWeight: '600',
            color: 'rgb(var(--foreground-rgb))'
          }}>
            {data.length}
          </div>
        </div>

        <div style={{ textAlign: 'center' as const }}>
          <div style={{
            fontSize: '0.65rem',
            color: 'rgb(var(--secondary-rgb))',
            textTransform: 'uppercase' as const,
            letterSpacing: '0.025em',
            marginBottom: '2px'
          }}>
            Top 5 Coverage
          </div>
          <div style={{
            fontSize: '0.9rem',
            fontWeight: '600',
            color: 'rgb(var(--success-rgb))'
          }}>
            {coveragePercentage}%
          </div>
        </div>
      </div>
    </div>
  );
} 