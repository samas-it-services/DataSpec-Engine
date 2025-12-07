/**
 * MaskedFieldBadge Component
 *
 * Displays masked field values with unmask capability.
 */

import React, { useState, useCallback } from 'react';
import clsx from 'clsx';
import { SensitivityLevel } from '../types';

export interface MaskedFieldBadgeProps {
  /** Original (unmasked) value - only shown when unmasked */
  value?: any;
  /** Masked display value */
  maskedValue: string;
  /** Field name */
  fieldName: string;
  /** Sensitivity level */
  sensitivityLevel: SensitivityLevel;
  /** Whether user can unmask this field */
  canUnmask?: boolean;
  /** Whether the field is currently unmasked */
  isUnmasked?: boolean;
  /** Custom class name */
  className?: string;
  /** Callback when unmask is requested */
  onUnmask?: () => Promise<any>;
  /** Callback when mask is requested */
  onMask?: () => void;
  /** Show sensitivity level indicator */
  showSensitivity?: boolean;
  /** Require reason for unmasking */
  requireReason?: boolean;
}

/**
 * Sensitivity level colors
 */
const SENSITIVITY_COLORS: Record<SensitivityLevel, string> = {
  [SensitivityLevel.PUBLIC]: 'green',
  [SensitivityLevel.INTERNAL]: 'blue',
  [SensitivityLevel.CONFIDENTIAL]: 'yellow',
  [SensitivityLevel.SECRET]: 'orange',
  [SensitivityLevel.HIGHLY_RESTRICTED]: 'red',
};

/**
 * Sensitivity level labels
 */
const SENSITIVITY_LABELS: Record<SensitivityLevel, string> = {
  [SensitivityLevel.PUBLIC]: 'Public',
  [SensitivityLevel.INTERNAL]: 'Internal',
  [SensitivityLevel.CONFIDENTIAL]: 'Confidential',
  [SensitivityLevel.SECRET]: 'Secret',
  [SensitivityLevel.HIGHLY_RESTRICTED]: 'Highly Restricted',
};

/**
 * Eye icon (show)
 */
function EyeIcon() {
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
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/**
 * Eye-off icon (hide)
 */
function EyeOffIcon() {
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
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/**
 * Lock icon
 */
function LockIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

/**
 * MaskedFieldBadge Component
 */
export function MaskedFieldBadge({
  value,
  maskedValue,
  fieldName,
  sensitivityLevel,
  canUnmask = false,
  isUnmasked: initialUnmasked = false,
  className,
  onUnmask,
  onMask,
  showSensitivity = true,
  requireReason = false,
}: MaskedFieldBadgeProps) {
  const [isUnmasked, setIsUnmasked] = useState(initialUnmasked);
  const [unmaskedValue, setUnmaskedValue] = useState<any>(value);
  const [isLoading, setIsLoading] = useState(false);
  const [showReasonDialog, setShowReasonDialog] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sensitivityColor = SENSITIVITY_COLORS[sensitivityLevel];
  const sensitivityLabel = SENSITIVITY_LABELS[sensitivityLevel];

  // Handle unmask
  const handleUnmask = useCallback(async () => {
    if (!canUnmask || !onUnmask) return;

    if (requireReason && !reason) {
      setShowReasonDialog(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await onUnmask();
      setUnmaskedValue(result);
      setIsUnmasked(true);
      setShowReasonDialog(false);
      setReason('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [canUnmask, onUnmask, requireReason, reason]);

  // Handle mask
  const handleMask = useCallback(() => {
    setIsUnmasked(false);
    setUnmaskedValue(undefined);
    onMask?.();
  }, [onMask]);

  // Handle reason submit
  const handleReasonSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim()) {
      handleUnmask();
    }
  }, [reason, handleUnmask]);

  return (
    <div
      className={clsx(
        'dataspec-masked-badge',
        `dataspec-masked-badge--${sensitivityColor}`,
        isUnmasked && 'dataspec-masked-badge--unmasked',
        className
      )}
      data-field={fieldName}
      data-sensitivity={sensitivityLevel}
    >
      {/* Sensitivity indicator */}
      {showSensitivity && (
        <span
          className="dataspec-masked-badge__sensitivity"
          title={sensitivityLabel}
        >
          <LockIcon />
        </span>
      )}

      {/* Value display */}
      <span className="dataspec-masked-badge__value">
        {isUnmasked ? (
          <span className="dataspec-masked-badge__unmasked">
            {String(unmaskedValue ?? value ?? '')}
          </span>
        ) : (
          <span className="dataspec-masked-badge__masked">
            {maskedValue}
          </span>
        )}
      </span>

      {/* Toggle button */}
      {canUnmask && (
        <button
          type="button"
          className="dataspec-masked-badge__toggle"
          onClick={isUnmasked ? handleMask : handleUnmask}
          disabled={isLoading}
          title={isUnmasked ? 'Mask value' : 'Unmask value'}
          aria-label={isUnmasked ? 'Mask value' : 'Unmask value'}
        >
          {isLoading ? (
            <span className="dataspec-masked-badge__loading" />
          ) : isUnmasked ? (
            <EyeOffIcon />
          ) : (
            <EyeIcon />
          )}
        </button>
      )}

      {/* Error display */}
      {error && (
        <span className="dataspec-masked-badge__error" title={error}>
          !
        </span>
      )}

      {/* Reason dialog */}
      {showReasonDialog && (
        <div className="dataspec-masked-badge__dialog">
          <form onSubmit={handleReasonSubmit}>
            <label htmlFor={`reason-${fieldName}`}>
              Please provide a reason for unmasking this field:
            </label>
            <input
              id={`reason-${fieldName}`}
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter reason..."
              autoFocus
            />
            <div className="dataspec-masked-badge__dialog-actions">
              <button
                type="button"
                onClick={() => {
                  setShowReasonDialog(false);
                  setReason('');
                }}
              >
                Cancel
              </button>
              <button type="submit" disabled={!reason.trim()}>
                Unmask
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default MaskedFieldBadge;
