/**
 * ImportProgress Component
 *
 * Displays import progress with status indicators and error handling.
 */

import React, { useMemo } from 'react';
import clsx from 'clsx';
import { OperationStatus } from '../types';
import { useDataSpecContext } from '../context/DataSpecContext';
import { ImportError } from '../types';

export interface ImportProgressProps {
  /** Optional class name */
  className?: string;
  /** Show detailed progress */
  showDetails?: boolean;
  /** Show error list */
  showErrors?: boolean;
  /** Maximum errors to display */
  maxErrors?: number;
  /** Show execution time */
  showExecutionTime?: boolean;
  /** Custom progress bar */
  renderProgressBar?: (progress: number) => React.ReactNode;
  /** Callback when import completes */
  onComplete?: () => void;
  /** Callback on error */
  onError?: (errors: ImportError[]) => void;
}

/**
 * Phase labels
 */
const PHASE_LABELS: Record<string, string> = {
  idle: 'Ready',
  validating: 'Validating data...',
  transforming: 'Transforming data...',
  importing: 'Importing records...',
  complete: 'Import complete',
  error: 'Import failed',
};

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Check icon
 */
function CheckCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22,4 12,14.01 9,11.01" />
    </svg>
  );
}

/**
 * Error icon
 */
function XCircleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  );
}

/**
 * Loading spinner
 */
function SpinnerIcon() {
  return (
    <svg
      className="dataspec-import-progress__spinner"
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="12" cy="12" r="10" opacity="0.25" />
      <path d="M12 2a10 10 0 0 1 10 10" />
    </svg>
  );
}

/**
 * ImportProgress Component
 */
export function ImportProgress({
  className,
  showDetails = true,
  showErrors = true,
  maxErrors = 10,
  showExecutionTime = true,
  renderProgressBar,
}: ImportProgressProps) {
  const { importProgress, importResult, error, resetImport } = useDataSpecContext();

  // Calculate progress percentage
  const progressPercent = useMemo(() => {
    if (importProgress.totalRows === 0) return 0;
    return Math.round((importProgress.processedRows / importProgress.totalRows) * 100);
  }, [importProgress.processedRows, importProgress.totalRows]);

  // Calculate execution time
  const executionTime = useMemo(() => {
    if (!importProgress.startTime) return null;
    const endTime = importProgress.endTime || new Date();
    return endTime.getTime() - importProgress.startTime.getTime();
  }, [importProgress.startTime, importProgress.endTime]);

  // Get status icon
  const StatusIcon = useMemo(() => {
    switch (importProgress.status) {
      case OperationStatus.SUCCESS:
        return CheckCircleIcon;
      case OperationStatus.ERROR:
        return XCircleIcon;
      default:
        return SpinnerIcon;
    }
  }, [importProgress.status]);

  // Get status color
  const statusColor = useMemo(() => {
    switch (importProgress.status) {
      case OperationStatus.SUCCESS:
        return 'success';
      case OperationStatus.ERROR:
        return 'error';
      case OperationStatus.WARNING:
        return 'warning';
      case OperationStatus.IN_PROGRESS:
        return 'progress';
      default:
        return 'idle';
    }
  }, [importProgress.status]);

  // Idle state
  if (importProgress.phase === 'idle') {
    return (
      <div className={clsx('dataspec-import-progress', 'dataspec-import-progress--idle', className)}>
        <p>Ready to import. Click "Import" to begin.</p>
      </div>
    );
  }

  // Get errors to display
  const displayErrors = importProgress.errors.slice(0, maxErrors);
  const hasMoreErrors = importProgress.errors.length > maxErrors;

  return (
    <div
      className={clsx(
        'dataspec-import-progress',
        `dataspec-import-progress--${statusColor}`,
        className
      )}
    >
      {/* Header */}
      <div className="dataspec-import-progress__header">
        <div className="dataspec-import-progress__status">
          <StatusIcon />
          <span className="dataspec-import-progress__phase">
            {PHASE_LABELS[importProgress.phase]}
          </span>
        </div>
        {showExecutionTime && executionTime !== null && (
          <div className="dataspec-import-progress__time">
            {formatDuration(executionTime)}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="dataspec-import-progress__bar-container">
        {renderProgressBar ? (
          renderProgressBar(progressPercent)
        ) : (
          <div className="dataspec-import-progress__bar">
            <div
              className={clsx(
                'dataspec-import-progress__bar-fill',
                `dataspec-import-progress__bar-fill--${statusColor}`
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        )}
        <span className="dataspec-import-progress__percent">{progressPercent}%</span>
      </div>

      {/* Details */}
      {showDetails && (
        <div className="dataspec-import-progress__details">
          <div className="dataspec-import-progress__detail">
            <span className="dataspec-import-progress__detail-label">Processed:</span>
            <span className="dataspec-import-progress__detail-value">
              {importProgress.processedRows} / {importProgress.totalRows}
            </span>
          </div>
          <div className="dataspec-import-progress__detail dataspec-import-progress__detail--success">
            <span className="dataspec-import-progress__detail-label">Successful:</span>
            <span className="dataspec-import-progress__detail-value">
              {importProgress.successfulRows}
            </span>
          </div>
          <div className="dataspec-import-progress__detail dataspec-import-progress__detail--error">
            <span className="dataspec-import-progress__detail-label">Failed:</span>
            <span className="dataspec-import-progress__detail-value">
              {importProgress.failedRows}
            </span>
          </div>
          {importProgress.totalBatches > 1 && (
            <div className="dataspec-import-progress__detail">
              <span className="dataspec-import-progress__detail-label">Batch:</span>
              <span className="dataspec-import-progress__detail-value">
                {importProgress.currentBatch} / {importProgress.totalBatches}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Global error */}
      {error && (
        <div className="dataspec-import-progress__error-message">
          <strong>Error:</strong> {error}
        </div>
      )}

      {/* Error list */}
      {showErrors && displayErrors.length > 0 && (
        <div className="dataspec-import-progress__errors">
          <h4 className="dataspec-import-progress__errors-title">
            Errors ({importProgress.errors.length})
          </h4>
          <ul className="dataspec-import-progress__errors-list">
            {displayErrors.map((err, idx) => (
              <li key={idx} className="dataspec-import-progress__error-item">
                <span className="dataspec-import-progress__error-row">
                  Row {err.rowNumber}
                </span>
                {err.field && (
                  <span className="dataspec-import-progress__error-field">
                    [{err.field}]
                  </span>
                )}
                <span className="dataspec-import-progress__error-message">
                  {err.message}
                </span>
              </li>
            ))}
          </ul>
          {hasMoreErrors && (
            <p className="dataspec-import-progress__errors-more">
              ...and {importProgress.errors.length - maxErrors} more errors
            </p>
          )}
        </div>
      )}

      {/* Result summary */}
      {importResult && (
        <div className="dataspec-import-progress__result">
          <h4>Import {importResult.success ? 'Completed' : 'Failed'}</h4>
          <p>
            Successfully imported {importResult.successfulRows} of {importResult.totalRows} records
            in {formatDuration(importResult.executionTimeMs)}.
          </p>
          {importResult.failedRows > 0 && (
            <p className="dataspec-import-progress__result-warning">
              {importResult.failedRows} records failed to import.
            </p>
          )}
          <p className="dataspec-import-progress__result-id">
            Execution ID: <code>{importResult.executionId}</code>
          </p>
        </div>
      )}

      {/* Actions */}
      {(importProgress.phase === 'complete' || importProgress.phase === 'error') && (
        <div className="dataspec-import-progress__actions">
          <button
            type="button"
            className="dataspec-import-progress__reset"
            onClick={resetImport}
          >
            Start New Import
          </button>
        </div>
      )}
    </div>
  );
}

export default ImportProgress;
