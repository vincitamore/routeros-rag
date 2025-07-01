import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import styles from './CustomSelect.module.css';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  searchable?: boolean;
  allowCustom?: boolean;
  portal?: boolean; // Whether to render dropdown in a portal to avoid modal clipping
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Select an option...',
  disabled = false,
  className = '',
  style = {},
  searchable = false,
  allowCustom = false,
  portal = false
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const [searchTerm, setSearchTerm] = useState('');
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isInteracting, setIsInteracting] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find(option => option.value === value);
  
  // Filter options based on search term
  const filteredOptions = searchable && searchTerm 
    ? options.filter(option => 
        option.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        option.value.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : options;

  // Add custom option if allowCustom and searchTerm doesn't match any existing option
  const finalOptions = allowCustom && searchTerm && !options.some(opt => opt.value === searchTerm)
    ? [...filteredOptions, { value: searchTerm, label: `Add "${searchTerm}"`, disabled: false }]
    : filteredOptions;

  // Calculate dropdown position for portal
  const calculateDropdownPosition = () => {
    if (!selectRef.current) return null;
    
    const rect = selectRef.current.getBoundingClientRect();
    
    // For fixed positioning, we use viewport coordinates directly
    // No need to add scroll offset since fixed positioning is relative to viewport
    const top = rect.bottom + 4; // 4px gap
    const left = rect.left;
    
    // Ensure the dropdown doesn't go off-screen
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    
    // Adjust left position if dropdown would go off-screen horizontally
    const adjustedLeft = Math.max(8, Math.min(left, viewportWidth - rect.width - 8));
    
    // Check if dropdown would go off-screen vertically and position above if needed
    const dropdownHeight = 200; // Estimated max dropdown height
    const adjustedTop = (top + dropdownHeight > viewportHeight) 
      ? rect.top - dropdownHeight - 4 // Position above
      : top; // Position below
    
    return {
      top: adjustedTop,
      left: adjustedLeft,
      width: rect.width
    };
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      
      // Check if click is outside the select button
      if (selectRef.current && !selectRef.current.contains(target)) {
        // For portal dropdowns, also check if click is outside the dropdown content
        if (portal) {
          // If we can't find the dropdown in the DOM or click is outside it, close
          const dropdownElements = document.querySelectorAll(`.${styles.dropdown}`);
          let clickedInsideDropdown = false;
          
          dropdownElements.forEach(dropdown => {
            if (dropdown.contains(target)) {
              clickedInsideDropdown = true;
            }
          });
          
          if (!clickedInsideDropdown) {
            setIsOpen(false);
            setFocusedIndex(-1);
            setDropdownPosition(null);
            setIsInteracting(false);
            // Remove body class and restore scrolling
            document.body.classList.remove('dropdown-portal-open');
            document.body.style.overflow = '';
          }
        } else {
          setIsOpen(false);
          setFocusedIndex(-1);
          setIsInteracting(false);
          // Remove body class and restore scrolling
          document.body.classList.remove('dropdown-portal-open');
          document.body.style.overflow = '';
        }
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen, portal]);

  // Update dropdown position on scroll/resize when using portal
  useEffect(() => {
    if (!isOpen || !portal) return;

    const updatePosition = () => {
      // Use requestAnimationFrame for smooth position updates
      requestAnimationFrame(() => {
        const newPosition = calculateDropdownPosition();
        setDropdownPosition(newPosition);
      });
    };

    // Listen to all scroll events (including nested scrollable containers)
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    // Also listen to document scroll for better compatibility
    document.addEventListener('scroll', updatePosition, true);
    
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, portal]);

  // Cleanup body class and scrolling on unmount
  useEffect(() => {
    return () => {
      if (portal) {
        document.body.classList.remove('dropdown-portal-open');
        document.body.style.overflow = '';
      }
    };
  }, [portal]);

  // Handle keyboard navigation
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isOpen) return;

      // If searchable and user starts typing (not special keys), focus the search input
      if (searchable && !inputRef.current?.matches(':focus') && 
          event.key.length === 1 && !event.ctrlKey && !event.altKey && !event.metaKey) {
        inputRef.current?.focus();
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setFocusedIndex(prev => {
            const nextIndex = prev < finalOptions.length - 1 ? prev + 1 : 0;
            const nextOption = finalOptions[nextIndex];
            return nextOption?.disabled ? Math.min(nextIndex + 1, finalOptions.length - 1) : nextIndex;
          });
          break;
        case 'ArrowUp':
          event.preventDefault();
          setFocusedIndex(prev => {
            const nextIndex = prev > 0 ? prev - 1 : finalOptions.length - 1;
            const nextOption = finalOptions[nextIndex];
            return nextOption?.disabled ? Math.max(nextIndex - 1, 0) : nextIndex;
          });
          break;
        case 'Enter':
        case ' ':
          event.preventDefault();
          if (focusedIndex >= 0 && focusedIndex < finalOptions.length) {
            const focusedOption = finalOptions[focusedIndex];
            if (focusedOption && !focusedOption.disabled) {
              onChange(focusedOption.value);
              setIsOpen(false);
              setFocusedIndex(-1);
              setSearchTerm('');
              setDropdownPosition(null);
              setIsInteracting(false);
              // Remove body class and restore scrolling
              if (portal) {
                document.body.classList.remove('dropdown-portal-open');
                document.body.style.overflow = '';
              }
            }
          }
          break;
        case 'Escape':
          setIsOpen(false);
          setFocusedIndex(-1);
          setDropdownPosition(null);
          setIsInteracting(false);
          // Remove body class and restore scrolling
          if (portal) {
            document.body.classList.remove('dropdown-portal-open');
            document.body.style.overflow = '';
          }
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, focusedIndex, finalOptions, onChange]);

  // Scroll focused option into view
  useEffect(() => {
    if (isOpen && focusedIndex >= 0 && optionsRef.current) {
      const focusedElement = optionsRef.current.children[focusedIndex] as HTMLElement;
      if (focusedElement) {
        focusedElement.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [focusedIndex, isOpen]);

    const handleToggle = () => {
    if (disabled) return;
    
    if (!isOpen) {
      setIsOpen(true);
      setIsInteracting(true);
      
      // Calculate position AFTER opening with proper timing for portal
      if (portal) {
        // Add class to body to prevent hover state loss and prevent scrolling
        document.body.classList.add('dropdown-portal-open');
        document.body.style.overflow = 'hidden';
        
        // Use multiple RAF calls to ensure DOM is fully settled
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const position = calculateDropdownPosition();
            setDropdownPosition(position);
          });
        });
      }
      
      // Set focus to current selected option when opening
      const selectedIndex = finalOptions.findIndex(option => option.value === value);
      setFocusedIndex(selectedIndex >= 0 ? selectedIndex : 0);
      
      // Auto-focus search input for searchable selects
      if (searchable) {
        // Use requestAnimationFrame for better timing
        requestAnimationFrame(() => {
          setTimeout(() => {
            inputRef.current?.focus();
          }, 50);
        });
      }
    } else {
      setIsOpen(false);
      setSearchTerm('');
      setDropdownPosition(null);
      setIsInteracting(false);
      // Remove body class and restore scrolling
      if (portal) {
        document.body.classList.remove('dropdown-portal-open');
        document.body.style.overflow = '';
      }
    }
  };

  const handleOptionClick = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
    setFocusedIndex(-1);
    setSearchTerm('');
    setDropdownPosition(null);
    setIsInteracting(false);
    // Remove body class and restore scrolling
    if (portal) {
      document.body.classList.remove('dropdown-portal-open');
      document.body.style.overflow = '';
    }
  };

  return (
    <div 
      ref={selectRef}
      className={`${styles.customSelect} ${className} ${disabled ? styles.disabled : ''} ${isInteracting ? styles.interacting : ''}`}
      style={style}
      data-dropdown-open={isOpen && portal ? 'true' : 'false'}
    >
      {/* Select Button */}
      <button
        type="button"
        className={`${styles.selectButton} ${isOpen ? styles.open : ''}`}
        onClick={handleToggle}
        onMouseDown={(e) => {
          // Prevent the button from losing focus when clicking
          if (!isOpen) {
            e.preventDefault();
          }
        }}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-labelledby="select-label"
      >
        <span className={styles.selectValue}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <svg 
          className={`${styles.selectArrow} ${isOpen ? styles.rotated : ''}`}
          width="20" 
          height="20" 
          viewBox="0 0 20 20" 
          fill="none"
        >
          <path 
            stroke="currentColor" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth="1.5" 
            d="M6 8l4 4 4-4"
          />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (() => {
        const dropdownContent = (
          <div 
            className={styles.dropdown} 
            style={{ 
              zIndex: 9999,
              ...(portal && dropdownPosition ? {
                position: 'fixed',
                top: dropdownPosition.top,
                left: dropdownPosition.left,
                width: dropdownPosition.width,
                margin: 0
              } : {})
            }}
          >
            {searchable && (
              <div style={{ padding: 'var(--space-2)', borderBottom: '1px solid rgba(var(--border-rgb), 0.3)' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search options..."
                  style={{
                    width: '100%',
                    padding: 'var(--space-1) var(--space-2)',
                    backgroundColor: 'rgba(var(--border-rgb), 0.2)',
                    border: '1px solid rgba(var(--border-rgb), 0.4)',
                    borderRadius: 'var(--space-1)',
                    color: 'rgb(var(--foreground-rgb))',
                    fontSize: '0.875rem',
                    outline: 'none'
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
            <div 
              ref={optionsRef}
              className={styles.optionsList}
              role="listbox"
            >
              {finalOptions.length === 0 ? (
                <div className={styles.option} style={{ opacity: 0.6, cursor: 'default' }}>
                  No options found
                </div>
              ) : (
                finalOptions.map((option, index) => (
                  <div
                    key={`${option.value}-${index}`}
                    className={`${styles.option} ${
                      option.value === value ? styles.selected : ''
                    } ${
                      index === focusedIndex ? styles.focused : ''
                    } ${
                      option.disabled ? styles.optionDisabled : ''
                    }`}
                                      onMouseDown={(e) => {
                    // Prevent the search input from losing focus when clicking options
                    e.preventDefault();
                  }}
                  onClick={() => handleOptionClick(option)}
                  role="option"
                  aria-selected={option.value === value}
                  >
                    {option.label}
                  </div>
                ))
              )}
            </div>
          </div>
        );

        // Use portal if enabled and we have a position, otherwise render normally
        return portal && dropdownPosition && typeof document !== 'undefined'
          ? createPortal(dropdownContent, document.body)
          : dropdownContent;
      })()}
    </div>
  );
} 