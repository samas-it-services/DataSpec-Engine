/**
 * PreviewTable Component
 *
 * Displays import preview data with masking indicators and validation errors.
 */

import React, { useMemo, useState } from 'react';
import clsx from 'clsx';
import { SensitivityLevel } from '../types';
import { useDataSpecContext } from '../context/DataSpecContext';
import { PreviewRow, ValidationError } from '../types';
import MaskedFieldBadge from './MaskedFieldBadge';

export interface PreviewTableProps {
  /** Optional class name */
  className?: string;
  /** Maximum rows to display */
  maxRows?: number;
  /** Show row numbers */
  showRowNumbers?: boolean;
  /** Show operation type column */
  showOperation?: boolean;
  /** Show validation errors inline */
  showInlineErrors?: boolean;
  /** Show masking indicators */
  showMaskingIndicators?: boolean;
  /** Columns to display (if not specified, all columns are shown) */
  columns?: string[];
  /** Custom cell renderer */
  renderCell?: (value: any, row: PreviewRow, column: string) => React.ReactNode;
  /** Callback when row is clicked */
  onRowClick?: (row: PreviewRow) => void;
}

/**
 * Operation badge colors
 */
const OPERATION_COLORS: Record<string, string> = {
  insert: 'green',
  update: 'blue',
  skip: 'gray',
};

/**
 * Operation labels
 */
const OPERATION_LABELS: Record<string, string> = {
  insert: 'Insert',
  update: 'Update',
  skip: 'Skip',
};

/**
 * Check icon
 */
function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

/**
 * Warning icon
 */
function WarningIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

/**
 * Error icon
 */
function ErrorIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
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
 * PreviewTable Component
 */
export function PreviewTable({
  className,
  maxRows = 100,
  showRowNumbers = true,
  showOperation = true,
  showInlineErrors = true,
  showMaskingIndicators = true,
  columns,
  renderCell,
  onRowClick,
}: PreviewTableProps) {
  const { preview, isPreviewLoading, canUnmask, unmaskField } = useDataSpecContext();
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  // Get columns to display
  const displayColumns = useMemo(() => {
    if (!preview || preview.rows.length === 0) return [];
    if (columns) return columns;

    // Get all unique keys from data
    const allKeys = new Set<string>();
    preview.rows.forEach(row => {
      Object.keys(row.data).forEach(key => allKeys.add(key));
    });
    return Array.from(allKeys);
  }, [preview, columns]);

  // Get masked fields from spec
  const maskedFields = useMemo(() => {
    if (!preview?.spec?.columns) return new Set<string>();
    return new Set(
      preview.spec.columns
        .filter(col => col.masking)
        .map(col => col.name)
    );
  }, [preview]);

  // Get sensitivity levels from spec
  const fieldSensitivity = useMemo(() => {
    if (!preview?.spec?.columns) return new Map<string, SensitivityLevel>();
    const map = new Map<string, SensitivityLevel>();
    preview.spec.columns.forEach(col => {
      if (col.sensitivity) {
        map.set(col.name, col.sensitivity as SensitivityLevel);
      }
    });
    return map;
  }, [preview]);

  // Toggle row expansion
  const toggleRow = (rowNumber: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowNumber)) {
        next.delete(rowNumber);
      } else {
        next.add(rowNumber);
      }
      return next;
    });
  };

  // Handle unmask
  const handleUnmask = async (rowIndex: number, fieldName: string) => {
    return unmaskField(rowIndex, fieldName);
  };

  // Render cell value
  const renderCellValue = (value: any, row: PreviewRow, column: string) => {
    if (renderCell) {
      return renderCell(value, row, column);
    }

    // Check if field is masked
    const isMasked = maskedFields.has(column) || row.maskedFields.includes(column);
    const sensitivity = fieldSensitivity.get(column) || SensitivityLevel.INTERNAL;

    if (isMasked && showMaskingIndicators) {
      return (
        <MaskedFieldBadge
          value={value}
          maskedValue={String(value)}
          fieldName={column}
          sensitivityLevel={sensitivity}
          canUnmask={canUnmask}
          onUnmask={() => handleUnmask(row.rowNumber, column)}
        />
      );
    }

    // Render value based on type
    if (value === null || value === undefined) {
      return <span className="dataspec-preview__null">null</span>;
    }

    if (typeof value === 'boolean') {
      return <span className="dataspec-preview__boolean">{value ? 'true' : 'false'}</span>;
    }

    if (typeof value === 'number') {
      return <span className="dataspec-preview__number">{value}</span>;
    }

    if (value instanceof Date) {
      return <span className="dataspec-preview__date">{value.toISOString()}</span>;
    }

    return <span className="dataspec-preview__text">{String(value)}</span>;
  };

  // Get row validation status
  const getRowStatus = (row: PreviewRow): 'valid' | 'warning' | 'error' => {
    if (row.validationErrors.length === 0) return 'valid';
    if (row.validationErrors.some(e => e.severity === 'error')) return 'error';
    return 'warning';
  };

  // Loading state
  if (isPreviewLoading) {
    return (
      <div className={clsx('dataspec-preview', 'dataspec-preview--loading', className)}>
        <div className="dataspec-preview__spinner" />
        <p>Generating preview...</p>
      </div>
    );
  }

  // No preview data
  if (!preview) {
    return (
      <div className={clsx('dataspec-preview', 'dataspec-preview--empty', className)}>
        <p>No preview data available</p>
        <p className="dataspec-preview__hint">Upload a file to see the preview</p>
      </div>
    );
  }

  // Get rows to display
  const displayRows = preview.rows.slice(0, maxRows);
  const hasMoreRows = preview.rows.length > maxRows;

  return (
    <div className={clsx('dataspec-preview', className)}>
      {/* Summary */}
      <div className="dataspec-preview__summary">
        <div className="dataspec-preview__stat">
          <span className="dataspec-preview__stat-value">{preview.totalRows}</span>
          <span className="dataspec-preview__stat-label">Total Rows</span>
        </div>
        <div className="dataspec-preview__stat dataspec-preview__stat--success">
          <span className="dataspec-preview__stat-value">{preview.validRows}</span>
          <span className="dataspec-preview__stat-label">Valid</span>
        </div>
        <div className="dataspec-preview__stat dataspec-preview__stat--error">
          <span className="dataspec-preview__stat-value">{preview.invalidRows}</span>
          <span className="dataspec-preview__stat-label">Invalid</span>
        </div>
        <div className="dataspec-preview__stat dataspec-preview__stat--insert">
          <span className="dataspec-preview__stat-value">{preview.insertCount}</span>
          <span className="dataspec-preview__stat-label">Inserts</span>
        </div>
        <div className="dataspec-preview__stat dataspec-preview__stat--update">
          <span className="dataspec-preview__stat-value">{preview.updateCount}</span>
          <span className="dataspec-preview__stat-label">Updates</span>
        </div>
        <div className="dataspec-preview__stat dataspec-preview__stat--skip">
          <span className="dataspec-preview__stat-value">{preview.skipCount}</span>
          <span className="dataspec-preview__stat-label">Skipped</span>
        </div>
      </div>

      {/* Table */}
      <div className="dataspec-preview__table-container">
        <table className="dataspec-preview__table">
          <thead>
            <tr>
              {showRowNumbers && <th className="dataspec-preview__th--row">#</th>}
              {showOperation && <th className="dataspec-preview__th--operation">Operation</th>}
              <th className="dataspec-preview__th--status">Status</th>
              {displayColumns.map(col => (
                <th key={col} className="dataspec-preview__th--data">
                  {col}
                  {maskedFields.has(col) && showMaskingIndicators && (
                    <span className="dataspec-preview__masked-indicator" title="Masked field">
                      🔒
                    </span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {displayRows.map((row) => {
              const status = getRowStatus(row);
              const isExpanded = expandedRows.has(row.rowNumber);
              const hasErrors = row.validationErrors.length > 0;

              return (
                <React.Fragment key={row.rowNumber}>
                  <tr
                    className={clsx(
                      'dataspec-preview__row',
                      `dataspec-preview__row--${status}`,
                      `dataspec-preview__row--${row.operation}`,
                      hasErrors && 'dataspec-preview__row--has-errors',
                      isExpanded && 'dataspec-preview__row--expanded',
                      onRowClick && 'dataspec-preview__row--clickable'
                    )}
                    onClick={() => {
                      if (hasErrors) toggleRow(row.rowNumber);
                      onRowClick?.(row);
                    }}
                  >
                    {showRowNumbers && (
                      <td className="dataspec-preview__td--row">{row.rowNumber}</td>
                    )}
                    {showOperation && (
                      <td className="dataspec-preview__td--operation">
                        <span
                          className={clsx(
                            'dataspec-preview__operation',
                            `dataspec-preview__operation--${OPERATION_COLORS[row.operation]}`
                          )}
                        >
                          {OPERATION_LABELS[row.operation]}
                        </span>
                      </td>
                    )}
                    <td className="dataspec-preview__td--status">
                      <span
                        className={clsx(
                          'dataspec-preview__status',
                          `dataspec-preview__status--${status}`
                        )}
                        title={
                          hasErrors
                            ? `${row.validationErrors.length} validation issue(s)`
                            : 'Valid'
                        }
                      >
                        {status === 'valid' && <CheckIcon />}
                        {status === 'warning' && <WarningIcon />}
                        {status === 'error' && <ErrorIcon />}
                      </span>
                    </td>
                    {displayColumns.map(col => (
                      <td key={col} className="dataspec-preview__td--data">
                        {renderCellValue(row.data[col], row, col)}
                      </td>
                    ))}
                  </tr>

                  {/* Expanded error details */}
                  {showInlineErrors && isExpanded && hasErrors && (
                    <tr className="dataspec-preview__errors-row">
                      <td colSpan={displayColumns.length + (showRowNumbers ? 1 : 0) + (showOperation ? 1 : 0) + 1}>
                        <div className="dataspec-preview__errors">
                          <h4>Validation Issues</h4>
                          <ul>
                            {row.validationErrors.map((error: ValidationError, idx: number) => (
                              <li
                                key={idx}
                                className={clsx(
                                  'dataspec-preview__error',
                                  `dataspec-preview__error--${error.severity}`
                                )}
                              >
                                <strong>{error.field}:</strong> {error.message}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* More rows indicator */}
      {hasMoreRows && (
        <div className="dataspec-preview__more">
          Showing {maxRows} of {preview.totalRows} rows.
          <span className="dataspec-preview__more-hint">
            Only the first {maxRows} rows are displayed in preview.
          </span>
        </div>
      )}
    </div>
  );
}

export default PreviewTable;
