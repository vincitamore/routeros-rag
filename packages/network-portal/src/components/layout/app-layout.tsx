'use client';

import { Navigation } from './navigation';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      {/* Navigation sidebar */}
      <Navigation />
      
      {/* Main content area */}
      <div className="pt-20 px-4 pb-4 lg:pt-0 lg:px-0 lg:pb-0 lg:pl-64" style={{ minHeight: '100vh' }}>
        {children}
      </div>
    </div>
  );
} 