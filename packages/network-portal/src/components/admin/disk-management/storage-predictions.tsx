'use client';

import { useState, useEffect } from 'react';
import { StatCard } from '../../ui/StatCard';
import { PredictionMetrics, FrontendStoragePrediction } from '../../../types/disk-management';

export function StoragePredictions() {
  const [metrics, setMetrics] = useState<PredictionMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTimeframe, setSelectedTimeframe] = useState<30 | 60 | 90>(30);

  useEffect(() => {
    fetchPredictions();
  }, [selectedTimeframe]);

  const fetchPredictions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/admin/disk/predictions?days=${selectedTimeframe}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch storage predictions');
      }
      
      const data = await response.json();
      setMetrics(data);
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

  const formatPercentage = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getPredictionTrend = (prediction: FrontendStoragePrediction): 'up' | 'down' | 'neutral' => {
    const growthRate = (prediction.predictedSize - (metrics?.currentSize || 0)) / (metrics?.currentSize || 1);
    if (growthRate > 0.5) return 'down'; // High growth is concerning
    if (growthRate > 0.2) return 'neutral';
    return 'up';
  };

  const getConfidenceColor = (confidence: number): string => {
    if (confidence >= 0.8) return 'rgb(var(--success-rgb))';
    if (confidence >= 0.6) return 'rgb(var(--warning-rgb))';
    return 'rgb(var(--error-rgb))';
  };

  const getPriorityColor = (priority: 'high' | 'medium' | 'low'): string => {
    switch (priority) {
      case 'high': return 'rgb(var(--error-rgb))';
      case 'medium': return 'rgb(var(--warning-rgb))';
      case 'low': return 'rgb(var(--success-rgb))';
    }
  };

  if (isLoading) {
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

  if (error) {
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
          Error loading predictions: {error}
        </p>
        <button
          onClick={fetchPredictions}
          style={{
            padding: 'var(--space-2) var(--space-4)',
            backgroundColor: 'rgb(var(--primary-rgb))',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--space-2)',
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!metrics) return null;

  const currentPrediction = metrics.predictions.find(p => p.days === selectedTimeframe && p.category === 'realistic');

  return (
    <div>
      {/* Timeframe Selection */}
      <div style={{
        marginBottom: 'var(--space-6)',
        display: 'flex',
        gap: 'var(--space-2)',
        flexWrap: 'wrap' as const
      }}>
        {[30, 60, 90].map((days) => (
          <button
            key={days}
            onClick={() => setSelectedTimeframe(days as 30 | 60 | 90)}
            style={{
              padding: 'var(--space-2) var(--space-4)',
              backgroundColor: selectedTimeframe === days 
                ? 'rgba(var(--primary-rgb), 0.2)' 
                : 'rgba(var(--border-rgb), 0.3)',
              border: selectedTimeframe === days 
                ? '1px solid rgba(var(--primary-rgb), 0.5)' 
                : '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: 'var(--space-2)',
              color: selectedTimeframe === days 
                ? 'rgb(var(--primary-rgb))' 
                : 'rgb(var(--foreground-rgb))',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              transition: 'all 0.2s ease-in-out',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          >
            {days} Days
          </button>
        ))}
      </div>

      {/* Growth Rate Statistics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)'
      }}>
        <StatCard
          title="Current Size"
          value={formatBytes(metrics.currentSize)}
          subtitle="Current database size"
          trend="neutral"
        />
        
        <StatCard
          title="Daily Growth"
          value={formatBytes(metrics.dailyGrowthRate)}
          subtitle={`${formatPercentage(metrics.dailyGrowthRate / metrics.currentSize)} per day`}
          trend={metrics.dailyGrowthRate > 1024 * 1024 ? "down" : "neutral"}
        />
        
        <StatCard
          title="Weekly Growth"
          value={formatBytes(metrics.weeklyGrowthRate)}
          subtitle={`${formatPercentage(metrics.weeklyGrowthRate / metrics.currentSize)} per week`}
          trend={metrics.weeklyGrowthRate > 7 * 1024 * 1024 ? "down" : "neutral"}
        />
        
        <StatCard
          title={`${selectedTimeframe} Day Prediction`}
          value={currentPrediction ? formatBytes(currentPrediction.predictedSize) : 'N/A'}
          subtitle={currentPrediction ? `${formatPercentage(currentPrediction.confidence)} confidence` : 'No data'}
          trend={currentPrediction ? getPredictionTrend(currentPrediction) : "neutral"}
        />
      </div>

      {/* Prediction Details */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))',
        gap: 'var(--space-4)',
        marginBottom: 'var(--space-6)'
      }}>
        {/* Prediction Scenarios */}
        <div className="card">
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            margin: '0 0 var(--space-4) 0',
            color: 'rgb(var(--foreground-rgb))'
          }}>
            Prediction Scenarios
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 'var(--space-3)' }}>
            {metrics.predictions
              .filter(p => p.days === selectedTimeframe)
              .map((prediction) => (
                <div
                  key={prediction.category}
                  style={{
                    padding: 'var(--space-3)',
                    backgroundColor: 'rgba(var(--border-rgb), 0.2)',
                    border: '1px solid rgba(var(--border-rgb), 0.3)',
                    borderRadius: 'var(--space-2)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'rgb(var(--foreground-rgb))',
                      textTransform: 'capitalize' as const,
                      marginBottom: 'var(--space-1)'
                    }}>
                      {prediction.category}
                    </div>
                    <div style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: 'rgb(var(--foreground-rgb))'
                    }}>
                      {formatBytes(prediction.predictedSize)}
                    </div>
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
                      backgroundColor: getConfidenceColor(prediction.confidence)
                    }} />
                    <span style={{
                      fontSize: '12px',
                      color: 'rgb(var(--secondary-rgb))'
                    }}>
                      {formatPercentage(prediction.confidence)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Storage Thresholds */}
        <div className="card">
          <h3 style={{
            fontSize: '20px',
            fontWeight: '600',
            margin: '0 0 var(--space-4) 0',
            color: 'rgb(var(--foreground-rgb))'
          }}>
            Storage Thresholds
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 'var(--space-4)' }}>
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-2)'
              }}>
                <span style={{
                  fontSize: '14px',
                  color: 'rgb(var(--foreground-rgb))'
                }}>
                  Warning Threshold
                </span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgb(var(--warning-rgb))'
                }}>
                  {formatBytes(metrics.thresholds.warning)}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.min((metrics.currentSize / metrics.thresholds.warning) * 100, 100)}%`,
                  height: '100%',
                  backgroundColor: 'rgb(var(--warning-rgb))',
                  transition: 'width 0.3s ease-in-out'
                }} />
              </div>
            </div>
            
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 'var(--space-2)'
              }}>
                <span style={{
                  fontSize: '14px',
                  color: 'rgb(var(--foreground-rgb))'
                }}>
                  Critical Threshold
                </span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '500',
                  color: 'rgb(var(--error-rgb))'
                }}>
                  {formatBytes(metrics.thresholds.critical)}
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
                <div style={{
                  width: `${Math.min((metrics.currentSize / metrics.thresholds.critical) * 100, 100)}%`,
                  height: '100%',
                  backgroundColor: 'rgb(var(--error-rgb))',
                  transition: 'width 0.3s ease-in-out'
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="card">
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          margin: '0 0 var(--space-4) 0',
          color: 'rgb(var(--foreground-rgb))'
        }}>
          Optimization Recommendations
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 'var(--space-3)' }}>
          {metrics.recommendations.map((recommendation, index) => (
            <div
              key={index}
              style={{
                padding: 'var(--space-4)',
                backgroundColor: 'rgba(var(--border-rgb), 0.2)',
                border: '1px solid rgba(var(--border-rgb), 0.3)',
                borderRadius: 'var(--space-3)',
                borderLeft: `4px solid ${getPriorityColor(recommendation.priority)}`
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 'var(--space-2)'
              }}>
                <div>
                  <h4 style={{
                    fontSize: '16px',
                    fontWeight: '500',
                    color: 'rgb(var(--foreground-rgb))',
                    margin: '0 0 var(--space-1) 0'
                  }}>
                    {recommendation.title}
                  </h4>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-2)'
                  }}>
                    <span style={{
                      fontSize: '12px',
                      fontWeight: '500',
                      color: getPriorityColor(recommendation.priority),
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.025em'
                    }}>
                      {recommendation.priority} priority
                    </span>
                    <span style={{
                      fontSize: '12px',
                      color: 'rgb(var(--secondary-rgb))',
                      textTransform: 'capitalize' as const
                    }}>
                      {recommendation.type}
                    </span>
                  </div>
                </div>
                
                {recommendation.expectedSavings && (
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '500',
                    color: 'rgb(var(--success-rgb))'
                  }}>
                    Save {formatBytes(recommendation.expectedSavings)}
                  </div>
                )}
              </div>
              
              <p style={{
                fontSize: '14px',
                color: 'rgb(var(--secondary-rgb))',
                lineHeight: 1.5,
                margin: 0
              }}>
                {recommendation.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
} 