'use client';

import styles from './mobile-header.module.css';
import Link from 'next/link';
import { HomeIcon } from './icons';

interface MobileHeaderProps {
  title: string;
  onNavigationToggle: () => void;
  isNavigationOpen: boolean;
}

interface HamburgerButtonProps {
  isOpen: boolean;
  onClick: () => void;
  className?: string;
}

const HamburgerButton: React.FC<HamburgerButtonProps> = ({ isOpen, onClick, className }) => (
  <button 
    className={`${styles.hamburger} ${isOpen ? styles.open : ''} ${className || ''}`}
    onClick={onClick}
    aria-label={isOpen ? 'Close navigation' : 'Open navigation'}
    aria-expanded={isOpen}
  >
    <span className={styles.hamburgerLine}></span>
    <span className={styles.hamburgerLine}></span>
    <span className={styles.hamburgerLine}></span>
  </button>
);

const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  onNavigationToggle,
  isNavigationOpen,
}) => {
  return (
    <header className={styles.mobileHeader}>
      <HamburgerButton 
        isOpen={isNavigationOpen}
        onClick={onNavigationToggle}
        className={styles.headerHamburger}
      />
      <h1 className={styles.headerTitle}>{title}</h1>
      <Link 
        href="/" 
        className={styles.homeButton}
        aria-label="Go to home page"
      >
        <HomeIcon size={20} color="#e2e8f0" />
      </Link>
    </header>
  );
};

export default MobileHeader; 