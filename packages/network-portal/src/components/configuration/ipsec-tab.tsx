'use client';

import React, { useState } from 'react';

import { IPsecSetupWizard } from './ipsec-setup-wizard';
import { IPsecPoliciesTable } from './ipsec-policies-table';
import { IPsecPeersTable } from './ipsec-peers-table';
import { IPsecProfilesTable } from './ipsec-profiles-table';
import { IPsecActiveConnections } from './ipsec-active-connections';

interface IPsecTabProps {
  deviceId: string;
  policies: any[];
  peers: any[];
  profiles: any[];
  activePeers: any[];
  onRefresh: () => void;
}

export function IPsecTab({ deviceId, policies, peers, profiles, activePeers, onRefresh }: IPsecTabProps) {
  const [activeTab, setActiveTab] = useState<'policies' | 'peers' | 'profiles' | 'active'>('policies');
  const [isLoading, setIsLoading] = useState(false);
  const [showWizardModal, setShowWizardModal] = useState(false);

  return (
    <div className="ipsec-container">
      <div className="section-header">
        <div>
          <h2>IPsec VPN Configuration</h2>
          <p>Manage IPsec VPN tunnels, policies, and connections</p>
        </div>
        <div className="header-actions">
          <button 
            className="wizard-btn"
            onClick={() => setShowWizardModal(true)}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            Setup Wizard
          </button>
          <button 
            className="refresh-btn"
            onClick={onRefresh}
            disabled={isLoading}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      <div className="tab-navigation">
        <button 
          className={`tab-btn ${activeTab === 'policies' ? 'active' : ''}`}
          onClick={() => setActiveTab('policies')}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Policies ({policies.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'peers' ? 'active' : ''}`}
          onClick={() => setActiveTab('peers')}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          Peers ({peers.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'profiles' ? 'active' : ''}`}
          onClick={() => setActiveTab('profiles')}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          Profiles ({profiles.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
          onClick={() => setActiveTab('active')}
        >
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          Active ({activePeers.length})
        </button>
      </div>

      <div className="tab-content">
        {activeTab === 'policies' && (
          <IPsecPoliciesTable 
            deviceId={deviceId} 
            policies={policies} 
            onRefresh={onRefresh}
            isLoading={isLoading}
          />
        )}
        {activeTab === 'peers' && (
          <IPsecPeersTable 
            deviceId={deviceId} 
            peers={peers} 
            onRefresh={onRefresh}
            isLoading={isLoading}
          />
        )}
        {activeTab === 'profiles' && (
          <IPsecProfilesTable 
            deviceId={deviceId} 
            profiles={profiles} 
            onRefresh={onRefresh}
            isLoading={isLoading}
          />
        )}
        {activeTab === 'active' && (
          <IPsecActiveConnections 
            deviceId={deviceId} 
            connections={activePeers} 
            onRefresh={onRefresh}
            isLoading={isLoading}
          />
        )}
      </div>

      {/* Setup Wizard Modal */}
      {showWizardModal && (
        <div className="modal-overlay" onClick={() => setShowWizardModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>IPsec VPN Setup Wizard</h3>
              <button 
                className="modal-close"
                onClick={() => setShowWizardModal(false)}
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="modal-body">
              <IPsecSetupWizard 
                deviceId={deviceId} 
                onTunnelCreated={() => {
                  onRefresh();
                  setShowWizardModal(false);
                }} 
              />
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .ipsec-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          height: 100%;
        }

        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 16px;
        }

        .section-header h2 {
          margin: 0 0 8px 0;
          font-size: 24px;
          font-weight: 600;
          color: #ffffff;
        }

        .section-header p {
          margin: 0;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
        }

        .header-actions {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .wizard-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: rgba(139, 92, 246, 0.2);
          border: 1px solid rgba(139, 92, 246, 0.3);
          border-radius: 8px;
          color: #a78bfa;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .wizard-btn:hover {
          background: rgba(139, 92, 246, 0.3);
          border-color: rgba(139, 92, 246, 0.4);
        }

        .tab-navigation {
          display: flex;
          gap: 2px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 6px;
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: transparent;
          border: none;
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.7);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .tab-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }

        .tab-btn.active {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .refresh-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 16px;
          background: rgba(34, 197, 94, 0.1);
          border: 1px solid rgba(34, 197, 94, 0.2);
          border-radius: 8px;
          color: #4ade80;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .refresh-btn:hover:not(:disabled) {
          background: rgba(34, 197, 94, 0.2);
          border-color: rgba(34, 197, 94, 0.3);
        }

        .refresh-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .tab-content {
          flex: 1;
          min-height: 0;
        }

        /* Modal Styles */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-content {
          background: rgba(17, 24, 39, 0.95);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          width: 100%;
          max-width: 900px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        }

        .modal-header h3 {
          margin: 0;
          font-size: 20px;
          font-weight: 600;
          color: #ffffff;
        }

        .modal-close {
          background: transparent;
          border: none;
          color: rgba(255, 255, 255, 0.7);
          cursor: pointer;
          padding: 4px;
          border-radius: 4px;
          transition: all 0.2s ease;
        }

        .modal-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #ffffff;
        }

        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 24px;
        }

        @media (max-width: 768px) {
          .section-header {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }

          .header-actions {
            width: 100%;
            justify-content: flex-end;
          }

          .tab-navigation {
            overflow-x: auto;
            padding: 6px;
          }

          .tab-btn {
            min-width: fit-content;
            padding: 10px 16px;
          }

          .modal-content {
            margin: 10px;
            max-width: calc(100vw - 20px);
          }

          .modal-header,
          .modal-body {
            padding: 16px;
          }
        }
      `}</style>
    </div>
  );
} 