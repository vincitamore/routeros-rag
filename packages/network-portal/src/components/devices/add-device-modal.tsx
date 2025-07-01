'use client';

import { useState } from 'react';
import { DeviceCreateInput } from '../../types/device';

interface AddDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeviceAdded: () => void;
  onHTTPSSetupRequired?: (deviceData: any, recommendation: any) => void;
}

export function AddDeviceModal({ isOpen, onClose, onDeviceAdded, onHTTPSSetupRequired }: AddDeviceModalProps) {
  const [formData, setFormData] = useState<DeviceCreateInput>({
    name: '',
    ipAddress: '',
    port: 443,
    username: 'admin',
    password: '',
    useSSL: true,
    comment: ''
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [hasTestedConnection, setHasTestedConnection] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
    setError(null);
    setTestResult(null);
    setHasTestedConnection(false); // Reset test status when form changes
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const port = parseInt(e.target.value) || 443;
    setFormData(prev => ({ ...prev, port }));
    setHasTestedConnection(false); // Reset test status when port changes
  };

  const handleSSLChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const useSSL = e.target.checked;
    setFormData(prev => ({
      ...prev,
      useSSL,
      port: useSSL ? 443 : 80  // Auto-adjust port based on SSL
    }));
    setHasTestedConnection(false); // Reset test status when SSL changes
  };

  const validateForm = (): boolean => {
    if (!formData.name.trim()) {
      setError('Device name is required');
      return false;
    }
    if (!formData.ipAddress.trim()) {
      setError('IP address is required');
      return false;
    }
    if (!formData.username.trim()) {
      setError('Username is required');
      return false;
    }
    if (!formData.password.trim()) {
      setError('Password is required');
      return false;
    }
    if (formData.port < 1 || formData.port > 65535) {
      setError('Port must be between 1 and 65535');
      return false;
    }
    return true;
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
      
      console.log('🔍 Add-device test connection result:', result);
      
      if (response.ok) {
        setTestResult({ success: true, message: result.message });
        setHasTestedConnection(true); // Mark connection as successfully tested
        
        // Always show HTTPS setup modal for HTTP connections to provide diagnostics
        if (result.httpsRecommendation && !formData.useSSL && onHTTPSSetupRequired) {
          console.log('🔐 HTTPS setup modal available, calling onHTTPSSetupRequired');
          onHTTPSSetupRequired(formData, result.httpsRecommendation);
        }
      } else {
        setTestResult({ success: false, message: result.error || 'Connection test failed' });
        setHasTestedConnection(false); // Mark connection test as failed
      }
    } catch (err) {
      setTestResult({ 
        success: false, 
        message: err instanceof Error ? err.message : 'Connection test failed' 
      });
      setHasTestedConnection(false); // Mark connection test as failed
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/devices', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        onDeviceAdded();
        handleClose();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add device');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add device');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      ipAddress: '',
      port: 443,
      username: 'admin',
      password: '',
      useSSL: true,
      comment: ''
    });
    setError(null);
    setTestResult(null);
    setHasTestedConnection(false);
    onClose();
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
              Add RouterOS Device
            </h3>
            <button
              type="button"
              className="transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              onClick={handleClose}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Device Requirements Info */}
          <div className="mb-6 p-4 rounded-lg" style={{ 
            backgroundColor: 'rgba(var(--primary-rgb), 0.1)', 
            border: '1px solid rgba(var(--primary-rgb), 0.2)' 
          }}>
            <div className="flex items-start space-x-3">
              <svg className="w-5 h-5 mt-0.5 flex-shrink-0" style={{ color: 'var(--primary)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
              <div>
                <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--primary)' }}>
                  Device Requirements for HTTPS Setup
                </h4>
                <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                  For automatic HTTPS setup, ensure your RouterOS device has these services enabled:
                </p>
                <ul className="text-xs space-y-1" style={{ color: 'var(--text-secondary)', lineHeight: '1.3' }}>
                  <li>• <strong>HTTP</strong> (port 80) - Initial connection and testing</li>
                  <li>• <strong>SSH</strong> (port 22) - Certificate generation and security configuration</li>
                  <li>• <strong>FTP</strong> (port 21) - SSH key upload (temporarily enabled during setup)</li>
                </ul>
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)', lineHeight: '1.3' }}>
                  After HTTPS setup, HTTP and FTP will be automatically disabled for security.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Device Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Device Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className="w-full"
                placeholder="e.g., Main Router"
                required
              />
            </div>

            {/* IP Address */}
            <div>
              <label htmlFor="ipAddress" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                IP Address *
              </label>
              <input
                type="text"
                id="ipAddress"
                name="ipAddress"
                value={formData.ipAddress}
                onChange={handleInputChange}
                className="w-full"
                placeholder="192.168.1.1"
                required
              />
            </div>

            {/* SSL and Port */}
            <div className="flex space-x-4">
              <div style={{ flex: 1 }}>
                <label htmlFor="port" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  Port
                </label>
                <input
                  type="number"
                  id="port"
                  name="port"
                  value={formData.port}
                  onChange={handlePortChange}
                  min="1"
                  max="65535"
                  className="w-full"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    name="useSSL"
                    checked={formData.useSSL}
                    onChange={handleSSLChange}
                    className="w-4 h-4"
                    style={{ 
                      accentColor: 'var(--primary)',
                      borderColor: 'var(--border)'
                    }}
                  />
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Use HTTPS</span>
                </label>
              </div>
            </div>

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Username *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                </span>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleInputChange}
                  className="w-full input-with-icon"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Password *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                  <svg className="w-5 h-5" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                </span>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full input-with-icon"
                  required
                />
              </div>
            </div>

            {/* Comment */}
            <div>
              <label htmlFor="comment" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                Comment (Optional)
              </label>
              <textarea
                id="comment"
                name="comment"
                value={formData.comment}
                onChange={handleInputChange}
                rows={2}
                className="w-full"
                placeholder="Optional description"
              />
            </div>

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
                disabled={isSubmitting || isTesting || !hasTestedConnection}
                className="btn btn-primary"
                style={{ 
                  flex: 1,
                  opacity: (isSubmitting || isTesting || !hasTestedConnection) ? 0.5 : 1,
                  cursor: (isSubmitting || isTesting || !hasTestedConnection) ? 'not-allowed' : 'pointer'
                }}
                title={!hasTestedConnection ? 'Please test the connection first' : ''}
              >
                {isSubmitting ? (
                  <>
                    <svg className="w-4 h-4 mr-2 animate-spin" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Adding...
                  </>
                ) : (
                  'Add Device'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
} 