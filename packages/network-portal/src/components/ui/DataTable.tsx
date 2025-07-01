import React, { useState, useMemo } from 'react';

interface Column<T> {
  key: keyof T | string;
  header: string;
  sortable?: boolean;
  searchable?: boolean;
  render?: (value: any, row: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  searchPlaceholder?: string;
  itemsPerPage?: number;
  showSearch?: boolean;
  showPagination?: boolean;
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T, index: number) => void;
  className?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  searchPlaceholder = "Search table...",
  itemsPerPage = 10,
  showSearch = true,
  showPagination = true,
  loading = false,
  emptyMessage = "No data available",
  onRowClick,
  className = ''
}: DataTableProps<T>) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: 'asc' | 'desc';
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Get searchable fields
  const searchableFields = useMemo(() => {
    return columns
      .filter(col => col.searchable !== false)
      .map(col => col.key as string);
  }, [columns]);

  // Filter data based on search term
  const filteredData = useMemo(() => {
    if (!searchTerm) return data;
    
    return data.filter(row => {
      return searchableFields.some(field => {
        const value = row[field];
        if (value === null || value === undefined) return false;
        return String(value).toLowerCase().includes(searchTerm.toLowerCase());
      });
    });
  }, [data, searchTerm, searchableFields]);

  // Sort filtered data
  const sortedData = useMemo(() => {
    if (!sortConfig) return filteredData;

    return [...filteredData].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      const aString = String(aValue).toLowerCase();
      const bString = String(bValue).toLowerCase();

      if (sortConfig.direction === 'asc') {
        return aString < bString ? -1 : aString > bString ? 1 : 0;
      } else {
        return aString > bString ? -1 : aString < bString ? 1 : 0;
      }
    });
  }, [filteredData, sortConfig]);

  // Paginate sorted data
  const paginatedData = useMemo(() => {
    if (!showPagination) return sortedData;
    
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage, showPagination]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);

  const handleSort = (key: string) => {
    const column = columns.find(col => col.key === key);
    if (!column?.sortable) return;

    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === 'asc' 
          ? { key, direction: 'desc' }
          : null;
      }
      return { key, direction: 'asc' };
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Reset page when search changes
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <div className={`data-table-container ${className}`}>
      {/* Search Bar */}
      {showSearch && (
        <div style={{ marginBottom: '16px' }}>
          <input
            type="text"
            placeholder={searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              maxWidth: '300px',
              padding: '8px 12px',
              backgroundColor: 'rgba(var(--border-rgb), 0.3)',
              border: '1px solid rgba(var(--border-rgb), 0.5)',
              borderRadius: '6px',
              color: 'rgb(var(--foreground-rgb))',
              fontSize: '0.875rem',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              outline: 'none',
              transition: 'all 0.2s ease-in-out'
            }}
            onFocus={(e) => {
              e.target.style.borderColor = 'rgba(var(--primary-rgb), 0.5)';
              e.target.style.boxShadow = '0 0 0 2px rgba(var(--primary-rgb), 0.1)';
            }}
            onBlur={(e) => {
              e.target.style.borderColor = 'rgba(var(--border-rgb), 0.5)';
              e.target.style.boxShadow = 'none';
            }}
          />
        </div>
      )}

      {/* Table */}
      <div 
        style={{
          backgroundColor: 'rgba(var(--border-rgb), 0.3)',
          border: '1px solid rgba(var(--border-rgb), 0.5)',
          borderRadius: '12px',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          overflow: 'hidden',
          boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.2)'
        }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ 
                backgroundColor: 'rgba(var(--border-rgb), 0.4)',
                borderBottom: '1px solid rgba(var(--border-rgb), 0.3)'
              }}>
                {columns.map((column, index) => (
                  <th
                    key={String(column.key)}
                    onClick={() => handleSort(String(column.key))}
                    style={{
                      padding: '12px 16px',
                      textAlign: column.align || 'left',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      color: 'rgb(var(--foreground-rgb))',
                      width: column.width,
                      cursor: column.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      position: 'relative',
                      transition: 'all 0.2s ease-in-out'
                    }}
                    onMouseEnter={(e) => {
                      if (column.sortable) {
                        e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.1)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: column.align === 'center' ? 'center' : column.align === 'right' ? 'flex-end' : 'flex-start',
                      gap: '4px'
                    }}>
                      {column.header}
                      {column.sortable && (
                        <span style={{
                          fontSize: '0.75rem',
                          opacity: sortConfig?.key === column.key ? 1 : 0.5,
                          color: 'rgb(var(--secondary-rgb))'
                        }}>
                          {sortConfig?.key === column.key 
                            ? (sortConfig.direction === 'asc' ? '↑' : '↓')
                            : '↕'
                          }
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td 
                    colSpan={columns.length}
                    style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: 'rgb(var(--secondary-rgb))',
                      fontSize: '0.875rem'
                    }}
                  >
                    Loading...
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td 
                    colSpan={columns.length}
                    style={{
                      padding: '32px',
                      textAlign: 'center',
                      color: 'rgb(var(--secondary-rgb))',
                      fontSize: '0.875rem'
                    }}
                  >
                    {emptyMessage}
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, rowIndex) => (
                  <tr
                    key={rowIndex}
                    onClick={() => onRowClick?.(row, rowIndex)}
                    style={{
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'all 0.2s ease-in-out',
                      borderBottom: rowIndex < paginatedData.length - 1 ? '1px solid rgba(var(--border-rgb), 0.2)' : 'none'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = 'rgba(var(--primary-rgb), 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {columns.map((column) => (
                      <td
                        key={String(column.key)}
                        style={{
                          padding: '12px 16px',
                          textAlign: column.align || 'left',
                          fontSize: '0.875rem',
                          color: 'rgb(var(--foreground-rgb))',
                          verticalAlign: 'middle'
                        }}
                      >
                        {column.render 
                          ? column.render(row[column.key as keyof T], row, rowIndex)
                          : String(row[column.key as keyof T] ?? '')
                        }
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '16px',
          fontSize: '0.875rem',
          color: 'rgb(var(--secondary-rgb))'
        }}>
          <div>
            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} entries
          </div>
          
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              style={{
                padding: '6px 12px',
                backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                border: '1px solid rgba(var(--border-rgb), 0.5)',
                borderRadius: '6px',
                color: 'rgb(var(--foreground-rgb))',
                fontSize: '0.875rem',
                cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                opacity: currentPage === 1 ? 0.5 : 1,
                transition: 'all 0.2s ease-in-out'
              }}
            >
              Previous
            </button>
            
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const page = i + 1;
              return (
                <button
                  key={page}
                  onClick={() => handlePageChange(page)}
                  style={{
                    padding: '6px 12px',
                    backgroundColor: currentPage === page 
                      ? 'rgb(var(--primary-rgb))' 
                      : 'rgba(var(--border-rgb), 0.3)',
                    border: '1px solid rgba(var(--border-rgb), 0.5)',
                    borderRadius: '6px',
                    color: currentPage === page 
                      ? 'white' 
                      : 'rgb(var(--foreground-rgb))',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease-in-out'
                  }}
                >
                  {page}
                </button>
              );
            })}
            
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              style={{
                padding: '6px 12px',
                backgroundColor: 'rgba(var(--border-rgb), 0.3)',
                border: '1px solid rgba(var(--border-rgb), 0.5)',
                borderRadius: '6px',
                color: 'rgb(var(--foreground-rgb))',
                fontSize: '0.875rem',
                cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                opacity: currentPage === totalPages ? 0.5 : 1,
                transition: 'all 0.2s ease-in-out'
              }}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DataTable; 