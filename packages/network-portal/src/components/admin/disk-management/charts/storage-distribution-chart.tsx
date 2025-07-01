'use client';

import React, { useState, useMemo } from 'react';
import { Palette, Eye, EyeOff, Database } from 'lucide-react';

interface StorageItem {
  name: string;
  size: number;
  percentage: number;
  color: string;
  type: 'table' | 'system' | 'logs' | 'other';
}

interface StorageDistributionChartProps {
  data: StorageItem[];
  title?: string;
  showLegend?: boolean;
  showLabels?: boolean;
  className?: string;
}

export default function StorageDistributionChart({
  data,
  title = "Storage Distribution",
  showLegend = true,
  showLabels = true,
  className = ""
}: StorageDistributionChartProps) {
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);
  const [hiddenItems, setHiddenItems] = useState<Set<string>>(new Set());

  // Filter out hidden items and recalculate percentages
  const visibleData = useMemo(() => {
    const visible = data.filter(item => !hiddenItems.has(item.name));
    const totalVisible = visible.reduce((sum, item) => sum + item.size, 0);
    
    return visible.map(item => ({
      ...item,
      percentage: totalVisible > 0 ? (item.size / totalVisible) * 100 : 0
    }));
  }, [data, hiddenItems]);

  // Generate SVG path for pie slice
  const createPieSlice = (
    startAngle: number,
    endAngle: number,
    radius: number,
    innerRadius: number = 0
  ): string => {
    const centerX = 150;
    const centerY = 150;
    
    const startAngleRad = (startAngle * Math.PI) / 180;
    const endAngleRad = (endAngle * Math.PI) / 180;
    
    const x1 = centerX + Math.cos(startAngleRad) * radius;
    const y1 = centerY + Math.sin(startAngleRad) * radius;
    const x2 = centerX + Math.cos(endAngleRad) * radius;
    const y2 = centerY + Math.sin(endAngleRad) * radius;
    
    const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
    
    if (innerRadius > 0) {
      // Donut chart
      const ix1 = centerX + Math.cos(startAngleRad) * innerRadius;
      const iy1 = centerY + Math.sin(startAngleRad) * innerRadius;
      const ix2 = centerX + Math.cos(endAngleRad) * innerRadius;
      const iy2 = centerY + Math.sin(endAngleRad) * innerRadius;
      
      return [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${ix2} ${iy2}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${ix1} ${iy1}`,
        'Z'
      ].join(' ');
    } else {
      // Full pie chart
      return [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z'
      ].join(' ');
    }
  };

  // Generate label position for pie slice
  const getLabelPosition = (startAngle: number, endAngle: number, radius: number) => {
    const centerX = 150;
    const centerY = 150;
    const midAngle = (startAngle + endAngle) / 2;
    const midAngleRad = (midAngle * Math.PI) / 180;
    
    const labelRadius = radius * 0.7;
    const x = centerX + Math.cos(midAngleRad) * labelRadius;
    const y = centerY + Math.sin(midAngleRad) * labelRadius;
    
    return { x, y };
  };

  // Toggle item visibility
  const toggleItemVisibility = (itemName: string) => {
    setHiddenItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemName)) {
        newSet.delete(itemName);
      } else {
        newSet.add(itemName);
      }
      return newSet;
    });
  };

  // Format file size
  const formatSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  // Get type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'table':
        return <Database size={14} />;
      case 'system':
        return <div className="system-icon">⚙️</div>;
      case 'logs':
        return <div className="logs-icon">📄</div>;
      case 'other':
        return <div className="other-icon">📦</div>;
      default:
        return <div className="default-icon">▪️</div>;
    }
  };

  if (!visibleData.length) {
    return (
      <div className={`storage-distribution-chart ${className}`}>
        <div className="chart-header">
          <h3>{title}</h3>
        </div>
        <div className="empty-chart">
          <Database size={48} />
          <p>No storage data available</p>
        </div>
      </div>
    );
  }

  let currentAngle = -90; // Start from top

  return (
    <div className={`storage-distribution-chart ${className}`}>
      {/* Header */}
      <div className="chart-header">
        <h3>{title}</h3>
        <div className="chart-controls">
          <span className="total-size">
            Total: {formatSize(data.reduce((sum, item) => sum + item.size, 0))}
          </span>
        </div>
      </div>

      <div className="chart-container">
        {/* Pie Chart SVG */}
        <div className="pie-chart-wrapper">
          <svg width="300" height="300" viewBox="0 0 300 300" className="pie-chart">
            {/* Background circle */}
            <circle
              cx="150"
              cy="150"
              r="120"
              fill="rgba(var(--border-rgb), 0.1)"
              stroke="rgba(var(--border-rgb), 0.2)"
              strokeWidth="1"
            />
            
            {/* Pie segments */}
            {visibleData.map((item, index) => {
              const segmentAngle = (item.percentage / 100) * 360;
              const endAngle = currentAngle + segmentAngle;
              const isHovered = hoveredSegment === item.name;
              const radius = isHovered ? 125 : 120;
              
              const pathData = createPieSlice(currentAngle, endAngle, radius, 30);
              
              const result = (
                <g key={item.name}>
                  <path
                    d={pathData}
                    fill={item.color}
                    stroke="rgba(var(--background-rgb), 0.8)"
                    strokeWidth="2"
                    opacity={isHovered ? 0.9 : 0.8}
                    style={{
                      transition: 'all 0.2s ease',
                      cursor: 'pointer',
                      filter: isHovered ? 'brightness(1.1)' : 'none'
                    }}
                    onMouseEnter={() => setHoveredSegment(item.name)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  />
                  
                  {/* Labels */}
                  {showLabels && item.percentage > 5 && (
                    <>
                      {(() => {
                        const labelPos = getLabelPosition(currentAngle, endAngle, radius);
                        return (
                          <g>
                            <text
                              x={labelPos.x}
                              y={labelPos.y - 5}
                              textAnchor="middle"
                              fontSize="11"
                              fontWeight="600"
                              fill="rgba(var(--foreground-rgb), 0.9)"
                              style={{ pointerEvents: 'none' }}
                            >
                              {item.name.length > 8 ? `${item.name.slice(0, 8)}...` : item.name}
                            </text>
                            <text
                              x={labelPos.x}
                              y={labelPos.y + 8}
                              textAnchor="middle"
                              fontSize="10"
                              fill="rgba(var(--foreground-rgb), 0.7)"
                              style={{ pointerEvents: 'none' }}
                            >
                              {item.percentage.toFixed(1)}%
                            </text>
                          </g>
                        );
                      })()}
                    </>
                  )}
                </g>
              );
              
              currentAngle = endAngle;
              return result;
            })}
            
            {/* Center circle with total */}
            <circle
              cx="150"
              cy="150"
              r="25"
              fill="rgba(var(--background-rgb), 0.9)"
              stroke="rgba(var(--border-rgb), 0.5)"
              strokeWidth="1"
            />
            <text
              x="150"
              y="145"
              textAnchor="middle"
              fontSize="10"
              fontWeight="600"
              fill="rgba(var(--foreground-rgb), 0.8)"
            >
              TOTAL
            </text>
            <text
              x="150"
              y="158"
              textAnchor="middle"
              fontSize="9"
              fill="rgba(var(--foreground-rgb), 0.6)"
            >
              {visibleData.length} items
            </text>
          </svg>

          {/* Hover tooltip */}
          {hoveredSegment && (
            <div className="hover-tooltip">
              {(() => {
                const item = visibleData.find(d => d.name === hoveredSegment);
                if (!item) return null;
                
                return (
                  <div className="tooltip-content">
                    <div className="tooltip-header">
                      <div 
                        className="color-indicator" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="item-name">{item.name}</span>
                    </div>
                    <div className="tooltip-stats">
                      <div>Size: {formatSize(item.size)}</div>
                      <div>Share: {item.percentage.toFixed(2)}%</div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="chart-legend">
            <div className="legend-header">
              <Palette size={16} />
              <span>Storage Items</span>
            </div>
            
            <div className="legend-items">
              {data.map((item) => {
                const isHidden = hiddenItems.has(item.name);
                const isHovered = hoveredSegment === item.name;
                
                return (
                  <div
                    key={item.name}
                    className={`legend-item ${isHidden ? 'hidden' : ''} ${isHovered ? 'hovered' : ''}`}
                    onMouseEnter={() => setHoveredSegment(item.name)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <div className="legend-left">
                      <button
                        onClick={() => toggleItemVisibility(item.name)}
                        className="visibility-toggle"
                        title={isHidden ? 'Show item' : 'Hide item'}
                      >
                        {isHidden ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      
                      <div 
                        className="color-indicator"
                        style={{ backgroundColor: item.color }}
                      />
                      
                      <div className="item-info">
                        <div className="item-header">
                          {getTypeIcon(item.type)}
                          <span className="item-name">{item.name}</span>
                        </div>
                        <div className="item-stats">
                          {formatSize(item.size)} • {item.percentage.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                    
                    <div className="item-bar">
                      <div 
                        className="bar-fill"
                        style={{
                          width: `${item.percentage}%`,
                          backgroundColor: item.color
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {hiddenItems.size > 0 && (
              <div className="legend-footer">
                <button
                  onClick={() => setHiddenItems(new Set())}
                  className="show-all-button"
                >
                  Show All ({hiddenItems.size} hidden)
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .storage-distribution-chart {
          background: rgba(var(--background-rgb), 0.3);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          backdrop-filter: blur(12px);
          border-radius: var(--space-4);
          padding: var(--space-6);
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--space-4);
        }

        .chart-header h3 {
          margin: 0;
          color: rgb(var(--foreground-rgb));
          font-size: 18px;
          font-weight: 600;
        }

        .chart-controls {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .total-size {
          font-size: 14px;
          color: rgba(var(--foreground-rgb), 0.7);
          font-weight: 500;
        }

        .chart-container {
          flex: 1;
          display: flex;
          gap: var(--space-6);
          align-items: flex-start;
        }

        .pie-chart-wrapper {
          position: relative;
          flex-shrink: 0;
        }

        .pie-chart {
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.1));
        }

        .hover-tooltip {
          position: absolute;
          top: 10px;
          right: 10px;
          background: rgba(var(--background-rgb), 0.95);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-2);
          padding: var(--space-3);
          font-size: 12px;
          z-index: 10;
          backdrop-filter: blur(8px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .tooltip-content {
          min-width: 120px;
        }

        .tooltip-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-2);
        }

        .tooltip-header .color-indicator {
          width: 12px;
          height: 12px;
          border-radius: 50%;
          flex-shrink: 0;
        }

        .tooltip-header .item-name {
          font-weight: 600;
          color: rgb(var(--foreground-rgb));
        }

        .tooltip-stats {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
          color: rgba(var(--foreground-rgb), 0.7);
        }

        .chart-legend {
          flex: 1;
          min-width: 280px;
          max-height: 400px;
          display: flex;
          flex-direction: column;
        }

        .legend-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-3);
          color: rgba(var(--foreground-rgb), 0.8);
          font-weight: 500;
        }

        .legend-items {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .legend-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: var(--space-3);
          background: rgba(var(--border-rgb), 0.2);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          border-radius: var(--space-2);
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .legend-item:hover,
        .legend-item.hovered {
          background: rgba(var(--border-rgb), 0.3);
          border-color: rgba(var(--border-rgb), 0.5);
          transform: translateY(-1px);
        }

        .legend-item.hidden {
          opacity: 0.5;
        }

        .legend-left {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          flex: 1;
          min-width: 0;
        }

        .visibility-toggle {
          padding: var(--space-1);
          background: rgba(var(--background-rgb), 0.5);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          border-radius: var(--space-1);
          cursor: pointer;
          transition: all 0.2s ease;
          color: rgba(var(--foreground-rgb), 0.6);
        }

        .visibility-toggle:hover {
          background: rgba(var(--primary-rgb), 0.1);
          border-color: rgba(var(--primary-rgb), 0.3);
          color: rgb(var(--primary-rgb));
        }

        .legend-left .color-indicator {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          flex-shrink: 0;
          border: 2px solid rgba(var(--background-rgb), 0.8);
        }

        .item-info {
          flex: 1;
          min-width: 0;
        }

        .item-header {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          margin-bottom: var(--space-1);
        }

        .item-name {
          font-weight: 500;
          color: rgb(var(--foreground-rgb));
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .item-stats {
          font-size: 12px;
          color: rgba(var(--foreground-rgb), 0.6);
        }

        .item-bar {
          width: 60px;
          height: 6px;
          background: rgba(var(--border-rgb), 0.3);
          border-radius: 3px;
          overflow: hidden;
          margin-left: var(--space-2);
        }

        .bar-fill {
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 3px;
        }

        .legend-footer {
          margin-top: var(--space-3);
          padding-top: var(--space-3);
          border-top: 1px solid rgba(var(--border-rgb), 0.3);
        }

        .show-all-button {
          width: 100%;
          padding: var(--space-2);
          background: rgba(var(--primary-rgb), 0.1);
          border: 1px solid rgba(var(--primary-rgb), 0.3);
          border-radius: var(--space-2);
          color: rgb(var(--primary-rgb));
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 12px;
        }

        .show-all-button:hover {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgba(var(--primary-rgb), 0.5);
        }

        .empty-chart {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-8);
          color: rgba(var(--foreground-rgb), 0.6);
          text-align: center;
        }

        .empty-chart p {
          margin: var(--space-3) 0 0 0;
        }

        .system-icon,
        .logs-icon,
        .other-icon,
        .default-icon {
          width: 14px;
          height: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
        }

        @media (max-width: 768px) {
          .chart-container {
            flex-direction: column;
            gap: var(--space-4);
          }

          .pie-chart-wrapper {
            align-self: center;
          }

          .chart-legend {
            min-width: auto;
            max-height: 300px;
          }

          .hover-tooltip {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
          }
        }
      `}</style>
    </div>
  );
} 