'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import styles from './Navigation.module.css';

interface NavItemData {
  key: string;
  title: string;
  level: number;
  children: NavItemData[];
}

// Function to create a URL-friendly slug from a title
const slugify = (title: string) =>
  title
    .toLowerCase()
    .replace(/, /g, '-') // Handle commas
    .replace(/ /g, '-') // Handle spaces
    .replace(/[^\w-]+/g, '') // Remove all non-word chars except -
    .replace(/-+/g, '-'); // Collapse consecutive hyphens

// Recursive function to add `key` properties to the outline
function addKeysToOutline(nodes: any[], parentPath: string = ''): NavItemData[] {
  return nodes.map(node => {
    const currentPathSegment = slugify(node.title);
    const key = parentPath ? `${parentPath}/${currentPathSegment}` : currentPathSegment;

    const newNode: NavItemData = {
      ...node,
      key: key,
    };
    
    if (node.children && node.children.length > 0) {
      newNode.children = addKeysToOutline(node.children, key);
    }
    
    return newNode;
  });
}

function TopLevelSection({ item, onNavigate }: { item: NavItemData; onNavigate?: () => void }) {
  const [isOpen, setIsOpen] = useState(false); // Start collapsed
  const hasChildren = item.children && item.children.length > 0;

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <li className={styles.topLevelSection}>
      <div className={styles.topLevelHeader}>
        {hasChildren ? (
          <button onClick={handleToggle} className={styles.topLevelToggle}>
            {isOpen ? '−' : '+'}
          </button>
        ) : (
          <span className={styles.placeholder}></span>
        )}
        <span className={styles.topLevelTitle}>{item.title}</span>
      </div>
      {isOpen && hasChildren && (
        <ul className={styles.childList} style={{ marginTop: '0.125rem' }}>
          {item.children.map((child) => (
            <NavItem key={child.key} item={child} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}

function NavItem({ item, onNavigate }: { item: NavItemData; onNavigate?: () => void }) {
  const [isOpen, setIsOpen] = useState(false); // Start all sections collapsed
  const hasChildren = item.children && item.children.length > 0;

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleLinkClick = () => {
    if (onNavigate) {
      onNavigate();
    }
  };

  return (
    <li 
      className={styles.navItem} 
      style={{ paddingLeft: `${(item.level - 1) * 16}px` }} 
      key={item.key}
    >
      <div className={styles.itemContainer}>
        {hasChildren ? (
          <button onClick={handleToggle} className={styles.toggleButton}>
            {isOpen ? '−' : '+'}
          </button>
        ) : (
          <span className={styles.placeholder}></span> // Placeholder for alignment
        )}
        <Link href={`/docs/${item.key}`} className={styles.link} onClick={handleLinkClick}>
          {item.title}
        </Link>
      </div>
      {isOpen && hasChildren && (
        <ul className={styles.childList}>
          {item.children.map((child) => (
            <NavItem key={child.key} item={child} onNavigate={onNavigate} />
          ))}
        </ul>
      )}
    </li>
  );
}

interface NavigationProps {
  onNavigate?: () => void;
}

export default function Navigation({ onNavigate }: NavigationProps = {}) {
  const [outline, setOutline] = useState<NavItemData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOutline = async () => {
      try {
        const response = await fetch('/document_outline.json');
        if (!response.ok) {
          throw new Error('Failed to fetch outline');
        }
        const data = await response.json();
        const processedData = data.map((rootNode: any) => ({
            ...rootNode,
            children: rootNode.children ? addKeysToOutline(rootNode.children) : []
        }));
        setOutline(processedData);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchOutline();
  }, []);

  if (loading) {
    return <p>Loading navigation...</p>;
  }

  return (
    <nav>
      <ul className={styles.navList}>
        {outline.map((rootItem, index) => {
          // Skip the first "RouterOS" section since we have it as the header
          if (index === 0 && rootItem.title === "RouterOS") {
            // Render the children as collapsible top-level sections
            return rootItem.children && rootItem.children.length > 0 ? (
              rootItem.children.map((child) => (
                <TopLevelSection key={child.key} item={child} onNavigate={onNavigate} />
              ))
            ) : null;
          }
          
          // Render other root items as collapsible sections
          return (
            <TopLevelSection key={rootItem.title} item={rootItem} onNavigate={onNavigate} />
          );
        })}
      </ul>
    </nav>
  );
} 