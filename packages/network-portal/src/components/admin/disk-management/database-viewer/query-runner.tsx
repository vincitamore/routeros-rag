'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Play, History, Download, Save, Trash2, Clock, Database, AlertCircle, CheckCircle } from 'lucide-react';

interface QueryResult {
  columns: string[];
  rows: any[][];
  rowCount: number;
  executionTime: number;
}

interface QueryHistoryItem {
  id: string;
  query: string;
  timestamp: Date;
  executionTime?: number;
  rowCount?: number;
  success: boolean;
  error?: string;
}

interface QueryRunnerProps {
  tableName?: string;
}

export default function QueryRunner({ tableName }: QueryRunnerProps) {
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<QueryHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [savedQueries, setSavedQueries] = useState<Record<string, string>>({});
  const [queryName, setQueryName] = useState('');
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultContainerRef = useRef<HTMLDivElement>(null);

  // Load saved queries and history from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('database-saved-queries');
    if (saved) {
      try {
        setSavedQueries(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved queries:', e);
      }
    }

    const historyData = localStorage.getItem('database-query-history');
    if (historyData) {
      try {
        const parsed = JSON.parse(historyData);
        setHistory(parsed.map((item: any) => ({
          ...item,
          timestamp: new Date(item.timestamp)
        })));
      } catch (e) {
        console.error('Failed to load query history:', e);
      }
    }
  }, []);

  // Set initial query if tableName is provided
  useEffect(() => {
    if (tableName && !query) {
      setQuery(`SELECT * FROM ${tableName} LIMIT 100;`);
    }
  }, [tableName, query]);

  // Save queries and history to localStorage
  useEffect(() => {
    localStorage.setItem('database-saved-queries', JSON.stringify(savedQueries));
  }, [savedQueries]);

  useEffect(() => {
    localStorage.setItem('database-query-history', JSON.stringify(history));
  }, [history]);

  // Execute query
  const executeQuery = async () => {
    if (!query.trim()) {
      setError('Please enter a query');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    const startTime = Date.now();

    try {
      const response = await fetch('/api/admin/database/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: query.trim() }),
      });

      const data = await response.json();
      const executionTime = Date.now() - startTime;

      if (!response.ok) {
        throw new Error(data.error || 'Query execution failed');
      }

      setResult({
        ...data,
        executionTime
      });

      // Add to history
      const historyItem: QueryHistoryItem = {
        id: Date.now().toString(),
        query: query.trim(),
        timestamp: new Date(),
        executionTime,
        rowCount: data.rowCount,
        success: true
      };

      setHistory(prev => [historyItem, ...prev.slice(0, 49)]); // Keep last 50 queries

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Query execution failed';
      setError(errorMessage);

      // Add failed query to history
      const historyItem: QueryHistoryItem = {
        id: Date.now().toString(),
        query: query.trim(),
        timestamp: new Date(),
        success: false,
        error: errorMessage
      };

      setHistory(prev => [historyItem, ...prev.slice(0, 49)]);
    } finally {
      setLoading(false);
    }
  };

  // Handle keyboard shortcuts
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      executeQuery();
    }
  };

  // Load query from history
  const loadFromHistory = (historyItem: QueryHistoryItem) => {
    setQuery(historyItem.query);
    setShowHistory(false);
  };

  // Save current query
  const saveQuery = () => {
    if (!queryName.trim() || !query.trim()) {
      return;
    }

    setSavedQueries(prev => ({
      ...prev,
      [queryName]: query.trim()
    }));

    setQueryName('');
    setShowSaveDialog(false);
  };

  // Load saved query
  const loadSavedQuery = (name: string) => {
    setQuery(savedQueries[name]);
  };

  // Delete saved query
  const deleteSavedQuery = (name: string) => {
    setSavedQueries(prev => {
      const newSaved = { ...prev };
      delete newSaved[name];
      return newSaved;
    });
  };

  // Export results as CSV
  const exportResults = () => {
    if (!result) return;

    const csvContent = [
      result.columns.join(','),
      ...result.rows.map(row => 
        row.map(cell => 
          typeof cell === 'string' && cell.includes(',') 
            ? `"${cell.replace(/"/g, '""')}"` 
            : String(cell ?? '')
        ).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `query_results_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Clear history
  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('database-query-history');
  };

  // Format execution time
  const formatTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  return (
    <div className="query-runner">
      {/* Header */}
      <div className="runner-header">
        <div className="header-left">
          <Database size={20} />
          <h3>SQL Query Runner</h3>
          {tableName && <span className="table-context">Table: {tableName}</span>}
        </div>
        
        <div className="header-right">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className={`history-button ${showHistory ? 'active' : ''}`}
          >
            <History size={16} />
            History
          </button>
        </div>
      </div>

      {/* Query Input */}
      <div className="query-section">
        <div className="query-controls">
          <div className="controls-left">
            <button
              onClick={executeQuery}
              disabled={loading || !query.trim()}
              className="execute-button"
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Executing...
                </>
              ) : (
                <>
                  <Play size={16} />
                  Execute (Ctrl+Enter)
                </>
              )}
            </button>

            <select
              value=""
              onChange={(e) => {
                if (e.target.value) {
                  loadSavedQuery(e.target.value);
                }
              }}
              className="saved-queries-select"
            >
              <option value="">Load Saved Query...</option>
              {Object.keys(savedQueries).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>

          <div className="controls-right">
            <button
              onClick={() => setShowSaveDialog(true)}
              disabled={!query.trim()}
              className="save-button"
            >
              <Save size={16} />
              Save Query
            </button>
          </div>
        </div>

        <textarea
          ref={textareaRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter your SQL query here..."
          className="query-textarea"
          rows={8}
        />

        <div className="query-help">
          <p>
            <strong>Tip:</strong> Use Ctrl+Enter to execute the query. 
            Start with SELECT queries and avoid destructive operations without proper confirmation.
          </p>
        </div>
      </div>

      {/* History Panel */}
      {showHistory && (
        <div className="history-panel">
          <div className="history-header">
            <h4>Query History</h4>
            <div className="history-actions">
              <button onClick={clearHistory} className="clear-history-button">
                <Trash2 size={14} />
                Clear All
              </button>
            </div>
          </div>

          <div className="history-list">
            {history.length === 0 ? (
              <div className="empty-history">No query history</div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className={`history-item ${item.success ? 'success' : 'error'}`}
                  onClick={() => loadFromHistory(item)}
                >
                  <div className="history-query">{item.query}</div>
                  <div className="history-meta">
                    <span className="history-time">
                      <Clock size={12} />
                      {item.timestamp.toLocaleString()}
                    </span>
                    {item.success ? (
                      <span className="history-stats">
                        <CheckCircle size={12} />
                        {item.rowCount} rows in {formatTime(item.executionTime || 0)}
                      </span>
                    ) : (
                      <span className="history-error">
                        <AlertCircle size={12} />
                        Error: {item.error}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Results */}
      {error && (
        <div className="error-panel">
          <AlertCircle size={20} />
          <div>
            <h4>Query Error</h4>
            <p>{error}</p>
          </div>
        </div>
      )}

      {result && (
        <div className="results-panel">
          <div className="results-header">
            <div className="results-stats">
              <span>{result.rowCount} rows returned</span>
              <span>Executed in {formatTime(result.executionTime)}</span>
            </div>
            <button onClick={exportResults} className="export-results-button">
              <Download size={16} />
              Export CSV
            </button>
          </div>

          <div className="results-container" ref={resultContainerRef}>
            <table className="results-table">
              <thead>
                <tr>
                  {result.columns.map((column, index) => (
                    <th key={index}>{column}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex}>
                        {cell === null ? (
                          <span className="null-value">NULL</span>
                        ) : (
                          String(cell)
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Save Query Dialog */}
      {showSaveDialog && (
        <div className="dialog-overlay">
          <div className="save-dialog">
            <h3>Save Query</h3>
            <input
              type="text"
              value={queryName}
              onChange={(e) => setQueryName(e.target.value)}
              placeholder="Enter query name..."
              className="query-name-input"
              autoFocus
            />
            <div className="dialog-actions">
              <button
                onClick={() => setShowSaveDialog(false)}
                className="cancel-button"
              >
                Cancel
              </button>
              <button
                onClick={saveQuery}
                disabled={!queryName.trim()}
                className="confirm-button"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Saved Queries Management */}
      {Object.keys(savedQueries).length > 0 && (
        <div className="saved-queries-panel">
          <h4>Saved Queries</h4>
          <div className="saved-queries-list">
            {Object.entries(savedQueries).map(([name, savedQuery]) => (
              <div key={name} className="saved-query-item">
                <div className="saved-query-info">
                  <span className="saved-query-name">{name}</span>
                  <span className="saved-query-preview">
                    {savedQuery.slice(0, 60)}...
                  </span>
                </div>
                <div className="saved-query-actions">
                  <button
                    onClick={() => loadSavedQuery(name)}
                    className="load-query-button"
                  >
                    Load
                  </button>
                  <button
                    onClick={() => deleteSavedQuery(name)}
                    className="delete-query-button"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style jsx>{`
        .query-runner {
          display: flex;
          flex-direction: column;
          gap: var(--space-4);
          height: 100%;
        }

        .runner-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4);
          background: rgba(var(--border-rgb), 0.3);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          backdrop-filter: blur(12px);
          border-radius: var(--space-3);
        }

        .header-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .header-left h3 {
          margin: 0;
          color: rgb(var(--foreground-rgb));
        }

        .table-context {
          padding: var(--space-1) var(--space-2);
          background: rgba(var(--primary-rgb), 0.1);
          border-radius: var(--space-1);
          color: rgb(var(--primary-rgb));
          font-size: 12px;
        }

        .history-button {
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

        .history-button:hover,
        .history-button.active {
          background: rgba(var(--primary-rgb), 0.1);
          border-color: rgba(var(--primary-rgb), 0.5);
          color: rgb(var(--primary-rgb));
        }

        .query-section {
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .query-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: var(--space-3);
        }

        .controls-left,
        .controls-right {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .execute-button {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-4);
          background: rgba(var(--success-rgb), 0.1);
          border: 1px solid rgba(var(--success-rgb), 0.3);
          border-radius: var(--space-2);
          color: rgb(var(--success-rgb));
          cursor: pointer;
          transition: all 0.2s ease;
          font-weight: 500;
        }

        .execute-button:hover:not(:disabled) {
          background: rgba(var(--success-rgb), 0.2);
          border-color: rgba(var(--success-rgb), 0.5);
        }

        .execute-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .saved-queries-select {
          padding: var(--space-2) var(--space-3);
          background: rgba(var(--background-rgb), 0.5);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-2);
          color: rgb(var(--foreground-rgb));
          min-width: 200px;
        }

        .save-button {
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-2) var(--space-3);
          background: rgba(var(--primary-rgb), 0.1);
          border: 1px solid rgba(var(--primary-rgb), 0.3);
          border-radius: var(--space-2);
          color: rgb(var(--primary-rgb));
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .save-button:hover:not(:disabled) {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgba(var(--primary-rgb), 0.5);
        }

        .save-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .query-textarea {
          width: 100%;
          padding: var(--space-4);
          background: rgba(var(--background-rgb), 0.3);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-3);
          color: rgb(var(--foreground-rgb));
          font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
          font-size: 14px;
          line-height: 1.5;
          resize: vertical;
          backdrop-filter: blur(12px);
        }

        .query-textarea:focus {
          outline: none;
          border-color: rgb(var(--primary-rgb));
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
        }

        .query-help {
          padding: var(--space-3);
          background: rgba(var(--border-rgb), 0.2);
          border-radius: var(--space-2);
          font-size: 13px;
          color: rgba(var(--foreground-rgb), 0.7);
        }

        .history-panel {
          background: rgba(var(--background-rgb), 0.3);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-3);
          backdrop-filter: blur(12px);
          max-height: 300px;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .history-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4);
          border-bottom: 1px solid rgba(var(--border-rgb), 0.3);
        }

        .history-header h4 {
          margin: 0;
          color: rgb(var(--foreground-rgb));
        }

        .clear-history-button {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          padding: var(--space-1) var(--space-2);
          background: rgba(var(--error-rgb), 0.1);
          border: 1px solid rgba(var(--error-rgb), 0.3);
          border-radius: var(--space-1);
          color: rgb(var(--error-rgb));
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s ease;
        }

        .clear-history-button:hover {
          background: rgba(var(--error-rgb), 0.2);
          border-color: rgba(var(--error-rgb), 0.5);
        }

        .history-list {
          flex: 1;
          overflow-y: auto;
          padding: var(--space-2);
        }

        .empty-history {
          padding: var(--space-4);
          text-align: center;
          color: rgba(var(--foreground-rgb), 0.6);
        }

        .history-item {
          padding: var(--space-3);
          margin-bottom: var(--space-2);
          background: rgba(var(--border-rgb), 0.2);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          border-radius: var(--space-2);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .history-item:hover {
          background: rgba(var(--border-rgb), 0.3);
          border-color: rgba(var(--border-rgb), 0.5);
        }

        .history-item.success {
          border-left: 3px solid rgb(var(--success-rgb));
        }

        .history-item.error {
          border-left: 3px solid rgb(var(--error-rgb));
        }

        .history-query {
          font-family: 'Fira Code', 'Monaco', 'Consolas', monospace;
          font-size: 13px;
          color: rgb(var(--foreground-rgb));
          margin-bottom: var(--space-2);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .history-meta {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 11px;
          color: rgba(var(--foreground-rgb), 0.6);
        }

        .history-time,
        .history-stats,
        .history-error {
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        .history-stats {
          color: rgb(var(--success-rgb));
        }

        .history-error {
          color: rgb(var(--error-rgb));
        }

        .error-panel {
          display: flex;
          align-items: flex-start;
          gap: var(--space-3);
          padding: var(--space-4);
          background: rgba(var(--error-rgb), 0.1);
          border: 1px solid rgba(var(--error-rgb), 0.3);
          border-radius: var(--space-3);
          color: rgb(var(--error-rgb));
        }

        .error-panel h4 {
          margin: 0 0 var(--space-1) 0;
        }

        .error-panel p {
          margin: 0;
          font-size: 14px;
        }

        .results-panel {
          background: rgba(var(--background-rgb), 0.3);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-3);
          backdrop-filter: blur(12px);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .results-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-4);
          border-bottom: 1px solid rgba(var(--border-rgb), 0.3);
        }

        .results-stats {
          display: flex;
          gap: var(--space-4);
          font-size: 14px;
          color: rgba(var(--foreground-rgb), 0.8);
        }

        .export-results-button {
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

        .export-results-button:hover {
          background: rgba(var(--success-rgb), 0.2);
          border-color: rgba(var(--success-rgb), 0.5);
        }

        .results-container {
          flex: 1;
          overflow: auto;
          max-height: 400px;
        }

        .results-table {
          width: 100%;
          border-collapse: collapse;
        }

        .results-table th,
        .results-table td {
          padding: var(--space-3);
          text-align: left;
          border-bottom: 1px solid rgba(var(--border-rgb), 0.3);
          font-size: 13px;
        }

        .results-table th {
          background: rgba(var(--border-rgb), 0.2);
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 1;
        }

        .results-table td {
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .null-value {
          color: rgba(var(--foreground-rgb), 0.5);
          font-style: italic;
        }

        .dialog-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .save-dialog {
          background: rgba(var(--background-rgb), 0.9);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          backdrop-filter: blur(12px);
          border-radius: var(--space-3);
          padding: var(--space-6);
          min-width: 400px;
        }

        .save-dialog h3 {
          margin: 0 0 var(--space-4) 0;
          color: rgb(var(--foreground-rgb));
        }

        .query-name-input {
          width: 100%;
          padding: var(--space-3);
          background: rgba(var(--background-rgb), 0.5);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-2);
          color: rgb(var(--foreground-rgb));
          margin-bottom: var(--space-4);
        }

        .query-name-input:focus {
          outline: none;
          border-color: rgb(var(--primary-rgb));
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.2);
        }

        .dialog-actions {
          display: flex;
          gap: var(--space-3);
          justify-content: flex-end;
        }

        .cancel-button,
        .confirm-button {
          padding: var(--space-2) var(--space-4);
          border-radius: var(--space-2);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-button {
          background: rgba(var(--border-rgb), 0.2);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          color: rgba(var(--foreground-rgb), 0.8);
        }

        .cancel-button:hover {
          background: rgba(var(--border-rgb), 0.3);
        }

        .confirm-button {
          background: rgba(var(--primary-rgb), 0.1);
          border: 1px solid rgba(var(--primary-rgb), 0.3);
          color: rgb(var(--primary-rgb));
        }

        .confirm-button:hover:not(:disabled) {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgba(var(--primary-rgb), 0.5);
        }

        .confirm-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .saved-queries-panel {
          background: rgba(var(--background-rgb), 0.3);
          border: 1px solid rgba(var(--border-rgb), 0.5);
          border-radius: var(--space-3);
          padding: var(--space-4);
          backdrop-filter: blur(12px);
        }

        .saved-queries-panel h4 {
          margin: 0 0 var(--space-3) 0;
          color: rgb(var(--foreground-rgb));
        }

        .saved-queries-list {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .saved-query-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--space-3);
          background: rgba(var(--border-rgb), 0.2);
          border: 1px solid rgba(var(--border-rgb), 0.3);
          border-radius: var(--space-2);
        }

        .saved-query-info {
          flex: 1;
          min-width: 0;
        }

        .saved-query-name {
          display: block;
          font-weight: 500;
          color: rgb(var(--foreground-rgb));
          margin-bottom: var(--space-1);
        }

        .saved-query-preview {
          display: block;
          font-size: 12px;
          color: rgba(var(--foreground-rgb), 0.6);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .saved-query-actions {
          display: flex;
          gap: var(--space-2);
        }

        .load-query-button,
        .delete-query-button {
          padding: var(--space-1) var(--space-2);
          border-radius: var(--space-1);
          cursor: pointer;
          transition: all 0.2s ease;
          font-size: 12px;
        }

        .load-query-button {
          background: rgba(var(--primary-rgb), 0.1);
          border: 1px solid rgba(var(--primary-rgb), 0.3);
          color: rgb(var(--primary-rgb));
        }

        .load-query-button:hover {
          background: rgba(var(--primary-rgb), 0.2);
          border-color: rgba(var(--primary-rgb), 0.5);
        }

        .delete-query-button {
          background: rgba(var(--error-rgb), 0.1);
          border: 1px solid rgba(var(--error-rgb), 0.3);
          color: rgb(var(--error-rgb));
        }

        .delete-query-button:hover {
          background: rgba(var(--error-rgb), 0.2);
          border-color: rgba(var(--error-rgb), 0.5);
        }

        .spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(var(--success-rgb), 0.3);
          border-top: 2px solid rgb(var(--success-rgb));
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .query-controls {
            flex-direction: column;
            align-items: stretch;
            gap: var(--space-3);
          }

          .controls-left,
          .controls-right {
            justify-content: center;
          }

          .saved-queries-select {
            min-width: auto;
          }

          .saved-query-item {
            flex-direction: column;
            gap: var(--space-2);
            align-items: stretch;
          }

          .saved-query-actions {
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
} 