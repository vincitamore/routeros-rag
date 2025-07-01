'use client';

import { useState, useCallback } from 'react';
import { Device } from '@/types/device';

interface HTTPSSetupState {
  isProcessing: boolean;
  currentStep: number;
  error: string | null;
  success: boolean;
}

export function useHTTPSSetup() {
  const [state, setState] = useState<HTTPSSetupState>({
    isProcessing: false,
    currentStep: 0,
    error: null,
    success: false
  });

  const setupHTTPS = useCallback(async (device: Device): Promise<void> => {
    setState({
      isProcessing: true,
      currentStep: 0,
      error: null,
      success: false
    });

    try {
      // Validate device ID before making API call
      if (!device.id) {
        throw new Error('Device ID is required for HTTPS setup');
      }
      
      // Show realistic progress steps
      const steps = [
        'Testing current HTTP connection...',
        'Setting up SSH key authentication...',
        'Creating SSL certificates...',
        'Configuring HTTPS service...',
        'Testing HTTPS connection...',
        'Updating device settings...'
      ];

      // Start progress simulation
      const progressInterval = setInterval(() => {
        setState(prev => {
          if (prev.currentStep < steps.length - 1) {
            return { ...prev, currentStep: prev.currentStep + 1 };
          }
          return prev;
        });
      }, 2000); // Update every 2 seconds

      // Start the actual setup process
      const response = await fetch(`/api/devices/${device.id}/setup-https`, {
        method: 'POST'
      });

      // Clear progress interval
      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'HTTPS setup failed');
      }

      const result = await response.json();
      
      // Set final success state
      setState({
        isProcessing: false,
        currentStep: steps.length - 1,
        error: null,
        success: true
      });

    } catch (error) {
      setState({
        isProcessing: false,
        currentStep: 0,
        error: error instanceof Error ? error.message : 'HTTPS setup failed',
        success: false
      });
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setState({
      isProcessing: false,
      currentStep: 0,
      error: null,
      success: false
    });
  }, []);

  return {
    ...state,
    setupHTTPS,
    reset
  };
} 