'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Search, ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Edit, Trash2, Download, Filter } from 'lucide-react';

interface Column {
  name: string;
  type: string;
  primaryKey: boolean;
  notNull: boolean;
}

interface TableData {
  columns: Column[];
  rows: Record<string, any>[];
  totalRows: number;
  currentPage: number;
  pageSize: number;
}

interface TableViewerProps {
  tableName: string;
  onEditRecord?: (record: Record<string, any>) => void;
  onDeleteRecord?: (recordId: string | number) => void;
  onExportData?: () => void;
}

export default function TableViewer({ 
  tableName, 
  onEditRecord, 
  onDeleteRecord, 
  onExportData 
}: TableViewerProps) {
  const [tableData, setTableData] = useState<TableData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);

  // Load table data
  useEffect(() => {
    loadTableData();
  }, [tableName, currentPage, pageSize, sortColumn, sortDirection, searchTerm, filters]);

  const loadTableData = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        ...(searchTerm && { search: searchTerm }),
        ...(sortColumn && { sortBy: sortColumn, sortDir: sortDirection }),
        ...Object.entries(filters).reduce((acc, [key, value]) => {
          if (value) acc[`filter_${key}`] = value;
          return acc;
        }, {} as Record<string, string>)
      });

      const response = await fetch(`/api/admin/database/tables/${tableName}/data?${params}`);
      if (!response.ok) {
        throw new Error(`Failed to load table data: ${response.statusText}`);
      }

      const data = await response.json();
      setTableData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table data');
    } finally {
      setLoading(false);
    }
  };

  // Handle sorting
  const handleSort = (columnName: string) => {
    if (sortColumn === columnName) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(columnName);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  // Handle row selection
  const handleRowSelect = (rowId: string, selected: boolean) => {
    const newSelected = new Set(selectedRows);
    if (selected) {
      newSelected.add(rowId);
    } else {
      newSelected.delete(rowId);
    }
    setSelectedRows(newSelected);
  };

  const handleSelectAll = (selected: boolean) => {
    if (selected && tableData) {
      const allIds = tableData.rows.map((_, index) => `${currentPage}-${index}`);
      setSelectedRows(new Set(allIds));
    } else {
      setSelectedRows(new Set());
    }
  };

  // Handle pagination
  const totalPages = tableData ? Math.ceil(tableData.totalRows / pageSize) : 0;
  
  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  // Format cell value for display
  const formatCellValue = (value: any, column: Column): string => {
    if (value === null || value === undefined) {
      return '';
    }
    
    if (column.type.toLowerCase().includes('datetime') || column.type.toLowerCase().includes('timestamp')) {
      return new Date(value).toLocaleString();
    }
    
    if (column.type.toLowerCase().includes('json')) {
      try {
        return JSON.stringify(JSON.parse(value), null, 2);
      } catch {
        return String(value);
      }
    }
    
    return String(value);
  };

  // Get primary key value for a row
  const getPrimaryKeyValue = (row: Record<string, any>): string | number => {
    if (!tableData) return '';
    const pkColumn = tableData.columns.find(col => col.primaryKey);
    return pkColumn ? row[pkColumn.name] : '';
  };

  if (loading) {
    return (
      <div className="table-viewer">
        <div className="loading-state">
          <div className="loading-spinner"></div>
          <p>Loading table data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="table-viewer">
        <div className="error-state">
          <p>Error: {error}</p>
          <button onClick={loadTableData} className="retry-button">
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!tableData) {
    return (
      <div className="table-viewer">
        <div className="empty-state">
          <p>No data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-viewer">
      {/* Header Controls */}
      <div className="table-controls">
        <div className="controls-left">
          <div className="search-container">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Search table data..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="search-input"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`filter-toggle ${showFilters ? 'active' : ''}`}
          >
            <Filter size={16} />
            Filters
          </button>
        </div>

        <div className="controls-right">
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="page-size-select"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
            <option value={100}>100 per page</option>
          </select>

          {onExportData && (
            <button onClick={onExportData} className="export-button">
              <Download size={16} />
              Export
            </button>
          )}
        </div>
      </div>

      {/* Column Filters */}
      {showFilters && (
        <div className="column-filters">
          {tableData.columns.map((column) => (
            <div key={column.name} className="filter-item">
              <label>{column.name}</label>
              <input
                type="text"
                placeholder={`Filter by ${column.name}...`}
                value={filters[column.name] || ''}
                onChange={(e) => {
                  setFilters(prev => ({
                    ...prev,
                    [column.name]: e.target.value
                  }));
                  setCurrentPage(1);
                }}
                className="filter-input"
              />
            </div>
          ))}
          
          <button
            onClick={() => {
              setFilters({});
              setCurrentPage(1);
            }}
            className="clear-filters-button"
          >
            Clear All
          </button>
        </div>
      )}

      {/* Data Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th className="select-column">
                <input
                  type="checkbox"
                  checked={selectedRows.size === tableData.rows.length && tableData.rows.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </th>
              {tableData.columns.map((column) => (
                <th
                  key={column.name}
                  className={`sortable-column ${sortColumn === column.name ? 'sorted' : ''}`}
                  onClick={() => handleSort(column.name)}
                >
                  <div className="column-header">
                    <span className="column-name">
                      {column.name}
                      {column.primaryKey && <span className="pk-indicator">PK</span>}
                      {column.notNull && <span className="nn-indicator">NN</span>}
                    </span>
                    <div className="sort-indicator">
                      {sortColumn === column.name ? (
                        sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                      ) : (
                        <ArrowUpDown size={14} />
                      )}
                    </div>
                  </div>
                  <div className="column-type">{column.type}</div>
                </th>
              ))}
              <th className="actions-column">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tableData.rows.map((row, index) => {
              const rowId = `${currentPage}-${index}`;
              const isSelected = selectedRows.has(rowId);
              
              return (
                <tr key={rowId} className={isSelected ? 'selected' : ''}>
                  <td className="select-cell">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleRowSelect(rowId, e.target.checked)}
                    />
                  </td>
                  {tableData.columns.map((column) => (
                    <td key={column.name} className="data-cell">
                      <div className="cell-content">
                        {formatCellValue(row[column.name], column)}
                      </div>
                    </td>
                  ))}
                  <td className="actions-cell">
                    <div className="row-actions">
                      {onEditRecord && (
                        <button
                          onClick={() => onEditRecord(row)}
                          className="edit-button"
                          title="Edit record"
                        >
                          <Edit size={14} />
                        </button>
                      )}
                      {onDeleteRecord && (
                        <button
                          onClick={() => onDeleteRecord(getPrimaryKeyValue(row))}
                          className="delete-button"
                          title="Delete record"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="pagination">
        <div className="pagination-info">
          Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, tableData.totalRows)} of {tableData.totalRows} records
          {selectedRows.size > 0 && (
            <span className="selection-info">({selectedRows.size} selected)</span>
          )}
        </div>

        <div className="pagination-controls">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="pagination-button"
          >
            <ChevronLeft size={16} />
            Previous
          </button>

          <div className="page-numbers">
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const pageNum = Math.max(1, currentPage - 2) + i;
              if (pageNum > totalPages) return null;
              
              return (
                <button
                  key={pageNum}
                  onClick={() => handlePageChange(pageNum)}
                  className={`page-number ${currentPage === pageNum ? 'active' : ''}`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="pagination-button"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <style jsx>{`
        .table-viewer {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          height: 100%;
        }

        .table-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4);
          background: rgba(var(--border-rgb), 0.3);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          backdrop-filter: blur(12px);
          border-radius: var(--space-3);
          gap: var(--space-4);
        }

        .controls-left,
        .controls-right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .search-container {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: var(--space-3);
          color: rgba(var(--foreground-rgb), 0.6);
          pointer-events: none;
        }

        .search-input {
          padding: var(--space-2) var(--space-2) var(--space-2) var(--space-8);
          background: rgba(var(--background-rgb), 0.5);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-2);
          color: rgb(var(--foreground-rgb));
          font-size: 14px;
          min-width: 300px;
        }

        .search-input:focus {
          outline: none;
          border-color: rgb(var(--primary-rgb));
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
        }

        .filter-toggle {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: rgba(var(--background-rgb), 0.5);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-2);
          color: rgb(var(--foreground-rgb));
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .filter-toggle:hover,
        .filter-toggle.active {
          background: rgba(var(--primary-rgb), 0.1);
          border-color: rgba(var(--primary-rgb), 0.5);
          color: rgb(var(--primary-rgb));
        }

        .page-size-select {
          padding: var(--space-2) var(--space-3);
          background: rgba(var(--background-rgb), 0.5);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-2);
          color: rgb(var(--foreground-rgb));
          font-size: 14px;
        }

        .export-button {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: rgba(var(--success-rgb), 0.1);
          border: 1px solid rgba(var(--success-rgb), 0.3);
          border-radius: var(--space-2);
          color: rgb(var(--success-rgb));
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .export-button:hover {
          background: rgba(var(--success-rgb), 0.2);
          border-color: rgba(var(--success-rgb), 0.5);
        }

        .column-filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--space-3);
          padding: var(--space-4);
          background: rgba(var(--border-rgb), 0.2);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          border-radius: var(--space-3);
          position: relative;
        }

        .filter-item {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .filter-item label {
          font-size: 12px;
          font-weight: 500;
          color: rgba(var(--foreground-rgb), 0.8);
        }

        .filter-input {
          padding: var(--space-2);
          background: rgba(var(--background-rgb), 0.5);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-2);
          color: rgb(var(--foreground-rgb));
          font-size: 14px;
        }

        .filter-input:focus {
          outline: none;
          border-color: rgb(var(--primary-rgb));
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
        }

        .clear-filters-button {
          grid-column: 1 / -1;
          justify-self: end;
          padding: var(--space-2) var(--space-4);
          background: rgba(var(--warning-rgb), 0.1);
          border: 1px solid rgba(var(--warning-rgb), 0.3);
          border-radius: var(--space-2);
          color: rgb(var(--warning-rgb));
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .clear-filters-button:hover {
          background: rgba(var(--warning-rgb), 0.2);
          border-color: rgba(var(--warning-rgb), 0.5);
        }

        .table-container {
          flex: 1;
          overflow: auto;
          background: rgba(var(--background-rgb), 0.3);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-3);
          backdrop-filter: blur(12px);
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
        }

        .data-table th,
        .data-table td {
          padding: var(--space-3);
          text-align: left;
          border-bottom: 1px solid rgba(var(--border-rgb), 0.3);
        }

        .data-table th {
          background: rgba(var(--border-rgb), 0.2);
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .sortable-column {
          cursor: pointer;
          user-select: none;
          transition: background-color 0.2s ease;
        }

        .sortable-column:hover {
          background: rgba(var(--border-rgb), 0.3);
        }

        .column-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: var(--space-2);
        }

        .column-name {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .pk-indicator,
        .nn-indicator {
          font-size: 10px;
          padding: 2px 4px;
          border-radius: 3px;
          font-weight: 600;
        }

        .pk-indicator {
          background: rgba(var(--primary-rgb), 0.2);
          color: rgb(var(--primary-rgb));
        }

        .nn-indicator {
          background: rgba(var(--warning-rgb), 0.2);
          color: rgb(var(--warning-rgb));
        }

        .column-type {
          font-size: 11px;
          color: rgba(var(--foreground-rgb), 0.6);
          margin-top: 2px;
        }

        .sort-indicator {
          opacity: 0.5;
          transition: opacity 0.2s ease;
        }

        .sorted .sort-indicator {
          opacity: 1;
          color: rgb(var(--primary-rgb));
        }

        .select-column,
        .actions-column {
          width: 60px;
        }

        .data-cell {
          max-width: 300px;
        }

        .cell-content {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .data-table tr:hover {
          background: rgba(var(--border-rgb), 0.1);
        }

        .data-table tr.selected {
          background: rgba(var(--primary-rgb), 0.1);
        }

        .row-actions {
          display: flex;
          gap: var(--space-2);
        }

        .edit-button,
        .delete-button {
          padding: var(--space-1);
          border: none;
          border-radius: var(--space-1);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .edit-button {
          background: rgba(var(--primary-rgb), 0.1);
          color: rgb(var(--primary-rgb));
        }

        .edit-button:hover {
          background: rgba(var(--primary-rgb), 0.2);
        }

        .delete-button {
          background: rgba(var(--error-rgb), 0.1);
          color: rgb(var(--error-rgb));
        }

        .delete-button:hover {
          background: rgba(var(--error-rgb), 0.2);
        }

        .pagination {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4);
          background: rgba(var(--border-rgb), 0.3);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          backdrop-filter: blur(12px);
          border-radius: var(--space-3);
        }

        .pagination-info {
          font-size: 14px;
          color: rgba(var(--foreground-rgb), 0.8);
        }

        .selection-info {
          margin-left: var(--space-2);
          color: rgb(var(--primary-rgb));
          font-weight: 500;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .pagination-button {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-2) var(--space-3);
          background: rgba(var(--background-rgb), 0.5);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-2);
          color: rgb(var(--foreground-rgb));
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 14px;
        }

        .pagination-button:hover:not(:disabled) {
          background: rgba(var(--primary-rgb), 0.1);
          border-color: rgba(var(--primary-rgb), 0.5);
          color: rgb(var(--primary-rgb));
        }

        .pagination-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .page-numbers {
          display: flex;
          gap: var(--space-1);
        }

        .page-number {
          padding: var(--space-2);
          background: rgba(var(--background-rgb), 0.5);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-2);
          color: rgb(var(--foreground-rgb));
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 36px;
          text-align: center;
        }

        .page-number:hover {
          background: rgba(var(--primary-rgb), 0.1);
          border-color: rgba(var(--primary-rgb), 0.5);
          color: rgb(var(--primary-rgb));
        }

        .page-number.active {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgb(var(--primary-rgb));
          color: rgb(var(--primary-rgb));
          font-weight: 600;
        }

        .loading-state,
        .error-state,
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: var(--space-8);
          text-align: center;
        }

        .loading-spinner {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(var(--border-rgb), 0.3);
          border-top: 3px solid rgb(var(--primary-rgb));
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-bottom: var(--space-4);
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .retry-button {
          margin-top: var(--space-4);
          padding: var(--space-2) var(--space-4);
          background: rgba(var(--primary-rgb), 0.1);
          border: 1px solid rgba(var(--primary-rgb), 0.3);
          border-radius: var(--space-2);
          color: rgb(var(--primary-rgb));
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .retry-button:hover {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgba(var(--primary-rgb), 0.5);
        }

        @media (max-width: 768px) {
          .table-controls {
            flex-direction: column;
            align-items: stretch;
            gap: var(--space-3);
          }

          .controls-left,
          .controls-right {
            justify-content: center;
          }

          .search-input {
            min-width: auto;
            width: 100%;
          }

          .column-filters {
            grid-template-columns: 1fr;
          }

          .pagination {
            flex-direction: column;
            gap: var(--space-3);
          }

          .page-numbers {
            order: -1;
          }
        }
      `}</style>
    </div>
  );
} 