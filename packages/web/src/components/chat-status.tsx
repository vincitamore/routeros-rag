'use client';

import { useEffect, useState } from 'react';
import styles from './chat-status.module.css';

interface ChatStatusProps {
  isLoading: boolean;
  className?: string;
}

const loadingSteps = [
  { message: "🔍 Searching for relevant documents...", duration: 800 },
  { message: "📝 Building prompt with retrieved documents...", duration: 600 },
  { message: "🤖 Waiting for assistant response...", duration: 1000 },
];

export default function ChatStatus({ isLoading, className }: ChatStatusProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isLoading) {
      setIsVisible(true);
      setCurrentStep(0);
      
      const timer1 = setTimeout(() => setCurrentStep(1), loadingSteps[0].duration);
      const timer2 = setTimeout(() => setCurrentStep(2), loadingSteps[0].duration + loadingSteps[1].duration);
      
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
      };
    } else {
      const hideTimer = setTimeout(() => setIsVisible(false), 200);
      return () => clearTimeout(hideTimer);
    }
  }, [isLoading]);

  if (!isVisible) return null;

  return (
    <div className={`${styles.container} ${className || ''}`}>
      <div className={styles.statusCard}>
        <div className={styles.statusContent}>
          <div className={styles.spinner}>
            <div className={styles.dot1}></div>
            <div className={styles.dot2}></div>
            <div className={styles.dot3}></div>
          </div>
          <span className={styles.statusText}>
            {loadingSteps[currentStep]?.message || "Processing..."}
          </span>
        </div>
      </div>
    </div>
  );
} 