'use client';

import { ReactNode, useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Navigation from "@/components/navigation";
import Chat from "@/components/chat";
import MobileHeader from "@/components/mobile-header";
import DesktopHeader from "@/components/desktop-header";
import styles from '../app/Layout.module.css';
import Link from 'next/link';

interface LayoutClientProps {
  children: ReactNode;
}

function ConditionalChat() {
  const pathname = usePathname();
  
  // Hide chat on homepage since FullPageChat is used there
  if (pathname === '/') {
    return null;
  }
  
  return <Chat />;
}

export default function LayoutClient({ children }: LayoutClientProps) {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);

    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const toggleNavigation = () => {
    setIsNavigationOpen(!isNavigationOpen);
  };

  const closeNavigation = () => {
    setIsNavigationOpen(false);
  };

  return (
    <>
      {/* Mobile header - positioned outside main container for proper stacking */}
              <MobileHeader
          title="RouterOS Docs"
          onNavigationToggle={toggleNavigation}
          isNavigationOpen={isNavigationOpen}
        />
      
      {/* Desktop header - positioned outside main container for proper stacking */}
      <DesktopHeader 
        title="RouterOS Docs" 
        onNavigationToggle={toggleNavigation}
        isNavigationOpen={isNavigationOpen}
      />
      
      <div className={styles.mainContainer}>
        {/* Mobile navigation overlay */}
        <div 
          className={`${styles.mobileNavOverlay} ${isNavigationOpen ? styles.active : ''}`}
          onClick={closeNavigation}
        />
        
        {/* Sidebar navigation */}
        <aside className={`${styles.sidebar} ${isNavigationOpen ? styles.open : ''}`}>
          <h1 className={styles.sidebarHeader}>RouterOS Docs</h1>
          <Navigation onNavigate={isMobile ? closeNavigation : undefined} />
        </aside>
        
        {/* Main content */}
        <main className={styles.content}>
          {children}
        </main>
      </div>
      
      {/* Chat component - hide on homepage since FullPageChat is used there */}
      <ConditionalChat />
    </>
  );
} 