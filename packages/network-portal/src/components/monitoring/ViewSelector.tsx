import React from 'react';
import styles from './ViewSelector.module.css';

interface ViewSelectorProps {
  currentView: 'system' | 'interfaces' | 'traffic';
  onViewChange: (view: 'system' | 'interfaces' | 'traffic') => void;
}

export function ViewSelector({ currentView, onViewChange }: ViewSelectorProps) {
  return (
    <div className={`${styles.card} card`}>
      <h2 className={styles.title}>Monitoring View</h2>
      <div className={styles.buttonGroup}>
        <button
          className={`${styles.button} ${currentView === 'system' ? styles.active : ''}`}
          onClick={() => onViewChange('system')}
        >
          System Metrics
        </button>
        <button
          className={`${styles.button} ${currentView === 'interfaces' ? styles.active : ''}`}
          onClick={() => onViewChange('interfaces')}
        >
          Interface Monitoring
        </button>
        <button
          className={`${styles.button} ${currentView === 'traffic' ? styles.active : ''}`}
          onClick={() => onViewChange('traffic')}
        >
          Traffic Analysis
        </button>
      </div>
    </div>
  );
} 