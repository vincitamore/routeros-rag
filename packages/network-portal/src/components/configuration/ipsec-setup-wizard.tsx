'use client';

import React, { useState } from 'react';

interface IPsecWizardConfig {
  remotePeerIP: string;
  localNetworks: string[];
  remoteNetworks: string[];
  psk: string;
  profileName: string;
  peerName: string;
  comment: string;
  encAlgorithm: string;
  hashAlgorithm: string;
  dhGroup: string;
  lifetime: string;
  natTraversal: boolean;
}

interface IPsecSetupWizardProps {
  deviceId: string;
  onTunnelCreated: () => void;
}

export function IPsecSetupWizard({ deviceId, onTunnelCreated }: IPsecSetupWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isDeploying, setIsDeploying] = useState(false);
  const [config, setConfig] = useState<IPsecWizardConfig>({
    remotePeerIP: '',
    localNetworks: [''],
    remoteNetworks: [''],
    psk: '',
    profileName: `site2site-${Date.now()}`,
    peerName: '',
    comment: '',
    encAlgorithm: 'aes-256',
    hashAlgorithm: 'sha256',
    dhGroup: 'modp2048',
    lifetime: '1h',
    natTraversal: true
  });

  const steps = [
    { number: 1, title: 'Connection Type', description: 'Choose VPN connection type' },
    { number: 2, title: 'Peer Information', description: 'Configure remote peer details' },
    { number: 3, title: 'Networks', description: 'Define local and remote networks' },
    { number: 4, title: 'Security Settings', description: 'Configure encryption and authentication' },
    { number: 5, title: 'Review & Deploy', description: 'Review and deploy configuration' }
  ];

  const updateConfig = (key: keyof IPsecWizardConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const addNetwork = (type: 'local' | 'remote') => {
    const key = type === 'local' ? 'localNetworks' : 'remoteNetworks';
    updateConfig(key, [...config[key], '']);
  };

  const removeNetwork = (type: 'local' | 'remote', index: number) => {
    const key = type === 'local' ? 'localNetworks' : 'remoteNetworks';
    const networks = [...config[key]];
    networks.splice(index, 1);
    updateConfig(key, networks);
  };

  const updateNetwork = (type: 'local' | 'remote', index: number, value: string) => {
    const key = type === 'local' ? 'localNetworks' : 'remoteNetworks';
    const networks = [...config[key]];
    networks[index] = value;
    updateConfig(key, networks);
  };

  const generateRandomPSK = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    let psk = '';
    for (let i = 0; i < 24; i++) {
      psk += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    updateConfig('psk', psk);
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return true; // Connection type is preset to site-to-site
      case 2:
        return config.remotePeerIP !== '' && config.psk !== '';
      case 3:
        return config.localNetworks.some(n => n !== '') && config.remoteNetworks.some(n => n !== '');
      case 4:
        return config.encAlgorithm !== '' && config.hashAlgorithm !== '' && config.dhGroup !== '';
      case 5:
        return true;
      default:
        return false;
    }
  };

  const deployTunnel = async () => {
    setIsDeploying(true);
    try {
      const response = await fetch(`/api/config/devices/${deviceId}/ipsec/site-to-site`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          remotePeerIP: config.remotePeerIP,
          localNetworks: config.localNetworks.filter(n => n !== ''),
          remoteNetworks: config.remoteNetworks.filter(n => n !== ''),
          psk: config.psk,
          profileName: config.profileName,
          peerName: config.peerName || config.remotePeerIP,
          comment: config.comment
        })
      });

      if (response.ok) {
        onTunnelCreated();
        // Reset wizard
        setCurrentStep(1);
        setConfig({
          remotePeerIP: '',
          localNetworks: [''],
          remoteNetworks: [''],
          psk: '',
          profileName: `site2site-${Date.now()}`,
          peerName: '',
          comment: '',
          encAlgorithm: 'aes-256',
          hashAlgorithm: 'sha256',
          dhGroup: 'modp2048',
          lifetime: '1h',
          natTraversal: true
        });
      } else {
        throw new Error('Failed to deploy tunnel');
      }
    } catch (error) {
      console.error('Error deploying tunnel:', error);
    } finally {
      setIsDeploying(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="step-content">
            <h3>Connection Type</h3>
            <p>This wizard will help you create a site-to-site IPsec VPN tunnel between your RouterOS device and a remote peer.</p>
            <div className="connection-type-card selected">
              <div className="connection-icon">
                <svg width="48" height="48" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                </svg>
              </div>
              <div>
                <h4>Site-to-Site VPN</h4>
                <p>Connect two networks securely over the internet</p>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="step-content">
            <h3>Peer Information</h3>
            <div className="form-group">
              <label>Remote Peer IP Address *</label>
              <input
                type="text"
                value={config.remotePeerIP}
                onChange={(e) => updateConfig('remotePeerIP', e.target.value)}
                placeholder="e.g., 203.0.113.10"
              />
            </div>
            <div className="form-group">
              <label>Peer Name (optional)</label>
              <input
                type="text"
                value={config.peerName}
                onChange={(e) => updateConfig('peerName', e.target.value)}
                placeholder="Leave empty to use IP address"
              />
            </div>
            <div className="form-group">
              <label>Pre-Shared Key *</label>
              <div className="psk-input">
                <input
                  type="password"
                  value={config.psk}
                  onChange={(e) => updateConfig('psk', e.target.value)}
                  placeholder="Enter or generate a secure pre-shared key"
                />
                <button type="button" onClick={generateRandomPSK} className="generate-psk-btn">
                  Generate
                </button>
              </div>
            </div>
            <div className="form-group">
              <label>Comment (optional)</label>
              <input
                type="text"
                value={config.comment}
                onChange={(e) => updateConfig('comment', e.target.value)}
                placeholder="Description for this tunnel"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="step-content">
            <h3>Network Configuration</h3>
            <div className="networks-section">
              <div className="network-group">
                <h4>Local Networks</h4>
                <p>Networks behind this RouterOS device</p>
                {config.localNetworks.map((network, index) => (
                  <div key={index} className="network-input">
                    <input
                      type="text"
                      value={network}
                      onChange={(e) => updateNetwork('local', index, e.target.value)}
                      placeholder="e.g., 192.168.1.0/24"
                    />
                    {config.localNetworks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeNetwork('local', index)}
                        className="remove-network-btn"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addNetwork('local')}
                  className="add-network-btn"
                >
                  + Add Local Network
                </button>
              </div>

              <div className="network-group">
                <h4>Remote Networks</h4>
                <p>Networks behind the remote peer</p>
                {config.remoteNetworks.map((network, index) => (
                  <div key={index} className="network-input">
                    <input
                      type="text"
                      value={network}
                      onChange={(e) => updateNetwork('remote', index, e.target.value)}
                      placeholder="e.g., 10.0.0.0/24"
                    />
                    {config.remoteNetworks.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeNetwork('remote', index)}
                        className="remove-network-btn"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addNetwork('remote')}
                  className="add-network-btn"
                >
                  + Add Remote Network
                </button>
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="step-content">
            <h3>Security Settings</h3>
            <div className="security-grid">
              <div className="form-group">
                <label>Encryption Algorithm</label>
                <select
                  value={config.encAlgorithm}
                  onChange={(e) => updateConfig('encAlgorithm', e.target.value)}
                >
                  <option value="aes-256">AES-256</option>
                  <option value="aes-192">AES-192</option>
                  <option value="aes-128">AES-128</option>
                  <option value="3des">3DES</option>
                </select>
              </div>
              <div className="form-group">
                <label>Hash Algorithm</label>
                <select
                  value={config.hashAlgorithm}
                  onChange={(e) => updateConfig('hashAlgorithm', e.target.value)}
                >
                  <option value="sha256">SHA256</option>
                  <option value="sha1">SHA1</option>
                  <option value="md5">MD5</option>
                </select>
              </div>
              <div className="form-group">
                <label>DH Group</label>
                <select
                  value={config.dhGroup}
                  onChange={(e) => updateConfig('dhGroup', e.target.value)}
                >
                  <option value="modp2048">MODP2048</option>
                  <option value="modp1536">MODP1536</option>
                  <option value="modp1024">MODP1024</option>
                </select>
              </div>
              <div className="form-group">
                <label>Lifetime</label>
                <select
                  value={config.lifetime}
                  onChange={(e) => updateConfig('lifetime', e.target.value)}
                >
                  <option value="1h">1 hour</option>
                  <option value="8h">8 hours</option>
                  <option value="1d">1 day</option>
                  <option value="7d">7 days</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={config.natTraversal}
                  onChange={(e) => updateConfig('natTraversal', e.target.checked)}
                />
                Enable NAT Traversal
              </label>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="step-content">
            <h3>Review Configuration</h3>
            <div className="review-section">
              <div className="review-group">
                <h4>Connection Details</h4>
                <div className="review-item">
                  <span>Remote Peer:</span>
                  <span>{config.remotePeerIP}</span>
                </div>
                <div className="review-item">
                  <span>Profile Name:</span>
                  <span>{config.profileName}</span>
                </div>
              </div>
              <div className="review-group">
                <h4>Networks</h4>
                <div className="review-item">
                  <span>Local Networks:</span>
                  <span>{config.localNetworks.filter(n => n !== '').join(', ')}</span>
                </div>
                <div className="review-item">
                  <span>Remote Networks:</span>
                  <span>{config.remoteNetworks.filter(n => n !== '').join(', ')}</span>
                </div>
              </div>
              <div className="review-group">
                <h4>Security</h4>
                <div className="review-item">
                  <span>Encryption:</span>
                  <span>{config.encAlgorithm.toUpperCase()}</span>
                </div>
                <div className="review-item">
                  <span>Hash:</span>
                  <span>{config.hashAlgorithm.toUpperCase()}</span>
                </div>
                <div className="review-item">
                  <span>DH Group:</span>
                  <span>{config.dhGroup.toUpperCase()}</span>
                </div>
                <div className="review-item">
                  <span>NAT Traversal:</span>
                  <span>{config.natTraversal ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="ipsec-wizard">
      <div className="wizard-header">
        <h2>IPsec VPN Setup Wizard</h2>
        <p>Configure a site-to-site IPsec VPN tunnel in just a few steps</p>
      </div>

      <div className="wizard-progress">
        {steps.map((step) => (
          <div
            key={step.number}
            className={`progress-step ${currentStep >= step.number ? 'completed' : ''} ${
              currentStep === step.number ? 'active' : ''
            }`}
          >
            <div className="step-number">{step.number}</div>
            <div className="step-info">
              <div className="step-title">{step.title}</div>
              <div className="step-description">{step.description}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="wizard-content">
        {renderStepContent()}
      </div>

      <div className="wizard-actions">
        <button
          className="btn-secondary"
          onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
          disabled={currentStep === 1 || isDeploying}
        >
          Previous
        </button>
        
        {currentStep < steps.length ? (
          <button
            className="btn-primary"
            onClick={() => setCurrentStep(currentStep + 1)}
            disabled={!validateStep(currentStep) || isDeploying}
          >
            Next
          </button>
        ) : (
          <button
            className="btn-success"
            onClick={deployTunnel}
            disabled={!validateStep(currentStep) || isDeploying}
          >
            {isDeploying ? 'Deploying...' : 'Deploy Tunnel'}
          </button>
        )}
      </div>

      <style jsx>{`
        .ipsec-wizard {
          display: flex;
          flex-direction: column;
          gap: 32px;
          height: 100%;
        }

        .wizard-header h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 600;
          color: #ffffff;
        }

        .wizard-header p {
          margin: 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
        }

        .wizard-progress {
          display: flex;
          gap: 16px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          overflow-x: auto;
        }

        .progress-step {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 200px;
          opacity: 0.5;
          transition: opacity 0.3s ease;
        }

        .progress-step.active {
          opacity: 1;
        }

        .progress-step.completed {
          opacity: 0.8;
        }

        .step-number {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid rgba(255, 255, 255, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
          transition: all 0.3s ease;
        }

        .progress-step.active .step-number {
          background: rgba(59, 130, 246, 0.2);
          border-color: #60a5fa;
          color: #60a5fa;
        }

        .progress-step.completed .step-number {
          background: rgba(34, 197, 94, 0.2);
          border-color: #4ade80;
          color: #4ade80;
        }

        .step-info {
          flex: 1;
        }

        .step-title {
          font-weight: 500;
          color: #ffffff;
          font-size: 14px;
          margin-bottom: 4px;
        }

        .step-description {
          font-size: 12px;
          color: rgba(255, 255, 255, 0.6);
        }

        .wizard-content {
          flex: 1;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(20px);
          padding: 32px;
          min-height: 400px;
        }

        .step-content h3 {
          margin: 0 0 16px 0;
          font-size: 20px;
          font-weight: 600;
          color: #ffffff;
        }

        .step-content p {
          margin: 0 0 24px 0;
          color: rgba(255, 255, 255, 0.7);
          line-height: 1.5;
        }

        .connection-type-card {
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 20px;
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .connection-type-card.selected {
          border-color: #60a5fa;
          background: rgba(59, 130, 246, 0.1);
        }

        .connection-icon {
          color: #60a5fa;
        }

        .connection-type-card h4 {
          margin: 0 0 4px 0;
          color: #ffffff;
          font-size: 16px;
        }

        .connection-type-card p {
          margin: 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
        }

        .form-group {
          margin-bottom: 24px;
        }

        .form-group label {
          display: block;
          margin-bottom: 8px;
          color: #ffffff;
          font-weight: 500;
          font-size: 14px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 12px 16px;
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          color: #ffffff;
          font-size: 14px;
          transition: all 0.2s ease;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #60a5fa;
          background: rgba(255, 255, 255, 0.08);
        }

        .form-group input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .psk-input {
          display: flex;
          gap: 8px;
        }

        .psk-input input {
          flex: 1;
        }

        .generate-psk-btn {
          padding: 12px 16px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 8px;
          color: #4ade80;
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .generate-psk-btn:hover {
          background: rgba(34, 197, 94, 0.2);
          border-color: rgba(34, 197, 94, 0.3);
        }

        .networks-section {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
        }

        .network-group h4 {
          margin: 0 0 8px 0;
          color: #ffffff;
          font-size: 16px;
        }

        .network-group p {
          margin: 0 0 16px 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
        }

        .network-input {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .network-input input {
          flex: 1;
        }

        .remove-network-btn {
          width: 40px;
          height: 40px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 8px;
          color: #f87171;
          font-size: 18px;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .remove-network-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .add-network-btn {
          padding: 8px 16px;
          background: transparent;
          border: 2px dashed rgba(255, 255, 255, 0.3);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          cursor: pointer;
          transition: all 0.2s ease;
          width: 100%;
        }

        .add-network-btn:hover {
          border-color: #60a5fa;
          color: #60a5fa;
        }

        .security-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }

        .checkbox-label {
          display: flex !important;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .checkbox-label input[type="checkbox"] {
          width: auto !important;
          margin: 0;
        }

        .review-section {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .review-group h4 {
          margin: 0 0 12px 0;
          color: #ffffff;
          font-size: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .review-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        }

        .review-item:last-child {
          border-bottom: none;
        }

        .review-item span:first-child {
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
        }

        .review-item span:last-child {
          color: #ffffff;
          font-weight: 500;
          font-size: 14px;
        }

        .wizard-actions {
          display: flex;
          justify-content: space-between;
          gap: 16px;
        }

        .btn-secondary,
        .btn-primary,
        .btn-success {
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          border: none;
        }

        .btn-secondary {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: rgba(255, 255, 255, 0.7);
        }

        .btn-secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }

        .btn-primary {
          background: rgba(59, 130, 246, 0.2);
          border: 1px solid rgba(59, 130, 246, 0.3);
          color: #60a5fa;
        }

        .btn-primary:hover:not(:disabled) {
          background: rgba(59, 130, 246, 0.3);
          border-color: rgba(59, 130, 246, 0.4);
        }

        .btn-success {
          background: rgba(34, 197, 94, 0.2);
          border: 1px solid rgba(34, 197, 94, 0.3);
          color: #4ade80;
        }

        .btn-success:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.3);
          border-color: rgba(34, 197, 94, 0.4);
        }

        .btn-secondary:disabled,
        .btn-primary:disabled,
        .btn-success:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        @media (max-width: 768px) {
          .networks-section {
            grid-template-columns: 1fr;
            gap: 24px;
          }

          .security-grid {
            grid-template-columns: 1fr;
          }

          .wizard-progress {
            flex-direction: column;
          }

          .progress-step {
            min-width: unset;
          }
        }
      `}</style>
    </div>
  );
} 