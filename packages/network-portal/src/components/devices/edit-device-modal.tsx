'use client';

import { useState, useEffect } from 'react';
import { Device, DeviceCreateInput } from '../../types/device';

interface EditDeviceModalProps {
  isOpen: boolean;
  device: Device | null;
  onClose: () => void;
  onDeviceUpdated: () => void;
}

export function EditDeviceModal({ isOpen, device, onClose, onDeviceUpdated }: EditDeviceModalProps) {
  const [formData, setFormData] = useState<DeviceCreateInput>({
    name: '',
    ipAddress: '',
    port: 443,
    username: '',
    password: '',
    useSSL: true
  });
  const [errors, setErrors] = useState<Partial<Record<keyof DeviceCreateInput, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Update form data when device changes
  useEffect(() => {
    if (device) {
      setFormData({
        name: device.name,
        ipAddress: device.ipAddress,
        port: device.port,
        username: device.username,
        password: '', // Don't prefill password for security
        useSSL: device.useSSL
      });
    }
  }, [device]);

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isOpen) {
      setErrors({});
      setTestResult(null);
      setError(null);
      if (device) {
        setFormData({
          name: device.name,
          ipAddress: device.ipAddress,
          port: device.port,
          username: device.username,
          password: '', // Reset password field
          useSSL: device.useSSL
        });
      }
    }
  }, [isOpen, device]);

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof DeviceCreateInput, string>> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Device name is required';
    }
    
    if (!formData.ipAddress.trim()) {
      newErrors.ipAddress = 'IP address is required';
    } else if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(formData.ipAddress)) {
      newErrors.ipAddress = 'Invalid IP address format';
    }
    
    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
    }
    
    if (!formData.password.trim()) {
      newErrors.password = 'Password is required';
    }
    
    if (formData.port < 1 || formData.port > 65535) {
      newErrors.port = 'Port must be between 1 and 65535';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleClose = () => {
    if (!isSubmitting && !isTesting) {
      onClose();
    }
  };

  const handleTestConnection = async () => {
    if (!validateForm()) return;

    setIsTesting(true);
    setTestResult(null);
    setError(null);

    try {
      const response = await fetch('/api/devices/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ipAddress: formData.ipAddress,
          port: formData.port,
          username: formData.username,
          password: formData.password,
          useSSL: formData.useSSL
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        setTestResult({ success: true, message: result.message });
      } else {
        setTestResult({ success: false, message: result.error || 'Connection test failed' });
      }
    } catch (err) {
      setTestResult({ 
        success: false, 
        message: err instanceof Error ? err.message : 'Connection test failed' 
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm() || !device) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/devices/${device.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onDeviceUpdated();
        handleClose();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to update device');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update device');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50" style={{ overflowY: 'auto' }}>
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div 
          className="fixed inset-0 transition-opacity" 
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={handleClose} 
        />

        <div 
          className="inline-block w-full p-6 my-8 text-left align-middle transition-all transform shadow-xl rounded-lg"
          style={{ 
            maxWidth: '28rem',
            backgroundColor: 'var(--background-card)',
            overflow: 'hidden'
          }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
              Edit Device
            </h3>
            <button
              type="button"
              className="transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              onClick={handleClose}
              disabled={isSubmitting || isTesting}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Device Name */}
          <div>
            <label htmlFor="edit-name" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Device Name *
            </label>
            <input
              type="text"
              id="edit-name"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full"
              placeholder="e.g., Main Router"
              disabled={isSubmitting || isTesting}
              required
            />
            {errors.name && <p className="text-sm mt-1" style={{ color: 'var(--error)' }}>{errors.name}</p>}
          </div>

          {/* IP Address */}
          <div>
            <label htmlFor="edit-ip" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              IP Address *
            </label>
            <input
              type="text"
              id="edit-ip"
              name="ipAddress"
              value={formData.ipAddress}
              onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
              className="w-full"
              placeholder="192.168.1.1"
              disabled={isSubmitting || isTesting}
              required
            />
            {errors.ipAddress && <p className="text-sm mt-1" style={{ color: 'var(--error)' }}>{errors.ipAddress}</p>}
          </div>

          {/* SSL and Port */}
          <div className="flex space-x-4">
            <div style={{ flex: 1 }}>
              <label htmlFor="edit-port" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Port
              </label>
              <input
                type="number"
                id="edit-port"
                name="port"
                value={formData.port}
                onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) || 443 })}
                min="1"
                max="65535"
                className="w-full"
                disabled={isSubmitting || isTesting}
              />
              {errors.port && <p className="text-sm mt-1" style={{ color: 'var(--error)' }}>{errors.port}</p>}
            </div>
            <div className="flex items-end">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  name="useSSL"
                  checked={formData.useSSL}
                  onChange={(e) => setFormData({ ...formData, useSSL: e.target.checked })}
                  className="w-4 h-4"
                  style={{ 
                    accentColor: 'var(--primary)',
                    borderColor: 'var(--border)'
                  }}
                  disabled={isSubmitting || isTesting}
                />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Use HTTPS</span>
              </label>
            </div>
          </div>

          {/* Username */}
          <div>
            <label htmlFor="edit-username" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Username *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
              </span>
              <input
                type="text"
                id="edit-username"
                name="username"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                className="w-full input-with-icon"
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="edit-password" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Password *
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                <svg className="w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
              </span>
              <input
                type="password"
                id="edit-password"
                name="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full input-with-icon"
                placeholder="Enter new password to update"
              />
            </div>
          </div>

          {/* Test Result */}
          {testResult && (
            <div 
              className="p-3 rounded border"
              style={{
                backgroundColor: testResult.success 
                  ? 'rgba(16, 185, 129, 0.1)' 
                  : 'rgba(239, 68, 68, 0.1)',
                borderColor: testResult.success 
                  ? 'var(--success)' 
                  : 'var(--error)'
              }}
            >
              <div className="flex items-center">
                {testResult.success ? (
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--success)' }}>
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--error)' }}>
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                <p 
                  className="text-sm"
                  style={{ 
                    color: testResult.success ? 'var(--success)' : 'var(--error)'
                  }}
                >
                  {testResult.message}
                </p>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div 
              className="p-3 rounded border"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                borderColor: 'var(--error)'
              }}
            >
              <div className="flex items-center">
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" style={{ color: 'var(--error)' }}>
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--error)' }}>{error}</p>
              </div>
            </div>
          )}
            {/* Test Connection Button */}
            <div>
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={isTesting || isSubmitting}
                className="btn w-full"
                style={{
                  backgroundColor: 'var(--primary-light)',
                  color: 'var(--text-on-primary)',
                  borderColor: 'var(--primary-light)',
                  opacity: (isTesting || isSubmitting) ? 0.5 : 1,
                  cursor: (isTesting || isSubmitting) ? 'not-allowed' : 'pointer'
                }}
              >
                {isTesting ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Testing Connection...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                    Test Connection
                  </>
                )}
              </button>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 pt-4">
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isTesting}
                className="btn btn-primary"
                style={{ 
                  flex: 1,
                  opacity: (isSubmitting || isTesting) ? 0.5 : 1,
                  cursor: (isSubmitting || isTesting) ? 'not-allowed' : 'pointer'
                }}
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Updating...
                  </>
                ) : (
                  'Update Device'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 