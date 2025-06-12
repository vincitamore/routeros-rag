'use client';

import { useState, useEffect } from 'react';

export function useMobileDetection(breakpoint: number = 768) {
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < breakpoint);
    };

    // Initial check
    checkIsMobile();

    // Add event listener
    window.addEventListener('resize', checkIsMobile);

    // Cleanup
    return () => window.removeEventListener('resize', checkIsMobile);
  }, [breakpoint]);

  return { isMobile, isClient };
}

export function useNavigationState() {
  const [isNavigationOpen, setIsNavigationOpen] = useState(false);
  const { isMobile } = useMobileDetection();

  const toggleNavigation = () => {
    setIsNavigationOpen(!isNavigationOpen);
  };

  const closeNavigation = () => {
    setIsNavigationOpen(false);
  };

  const openNavigation = () => {
    setIsNavigationOpen(true);
  };

  // Auto-close navigation when switching to desktop
  useEffect(() => {
    if (!isMobile && isNavigationOpen) {
      setIsNavigationOpen(false);
    }
  }, [isMobile, isNavigationOpen]);

  // Close navigation on route change (mobile)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const handleRouteChange = () => {
        if (isMobile) {
          setIsNavigationOpen(false);
        }
      };

      // Listen for navigation events
      window.addEventListener('popstate', handleRouteChange);
      
      return () => {
        window.removeEventListener('popstate', handleRouteChange);
      };
    }
  }, [isMobile]);

  return {
    isNavigationOpen,
    toggleNavigation,
    closeNavigation,
    openNavigation,
    isMobile
  };
} 