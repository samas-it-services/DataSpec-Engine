/**
 * SpecSelector Component
 *
 * Dropdown/list component for selecting a data spec for import/export.
 */

import React from 'react';
import clsx from 'clsx';
import { useDataSpecContext } from '../context/DataSpecContext';
import { SpecDefinition } from '../types';

export interface SpecSelectorProps {
  /** Optional class name */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Display mode */
  mode?: 'dropdown' | 'list' | 'cards';
  /** Show spec description */
  showDescription?: boolean;
  /** Show version badge */
  showVersion?: boolean;
  /** Show tags */
  showTags?: boolean;
  /** Custom render function for spec item */
  renderSpec?: (spec: SpecDefinition, isSelected: boolean) => React.ReactNode;
  /** Callback when spec is selected */
  onSelect?: (spec: SpecDefinition | null) => void;
}

/**
 * Format date for display
 */
function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString();
}

/**
 * Default spec icon
 */
function DefaultSpecIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10,9 9,9 8,9" />
    </svg>
  );
}

/**
 * Loading spinner
 */
function LoadingSpinner() {
  return (
    <svg
      className="dataspec-spinner"
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
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
 * SpecSelector Component
 */
export function SpecSelector({
  className,
  placeholder = 'Select a specification...',
  disabled = false,
  mode = 'dropdown',
  showDescription = true,
  showVersion = true,
  showTags = true,
  renderSpec,
  onSelect,
}: SpecSelectorProps) {
  const {
    specs,
    selectedSpec,
    selectedEntity,
    isLoadingSpecs,
    error,
    selectSpec,
  } = useDataSpecContext();

  // Handle selection
  const handleSelect = (spec: SpecDefinition | null) => {
    selectSpec(spec);
    onSelect?.(spec);
  };

  // No entity selected
  if (!selectedEntity) {
    return (
      <div className={clsx('dataspec-spec-selector', 'dataspec-spec-selector--disabled', className)}>
        <div className="dataspec-spec-selector__message">
          Please select an entity first
        </div>
      </div>
    );
  }

  // Render dropdown mode
  if (mode === 'dropdown') {
    return (
      <div className={clsx('dataspec-spec-selector', 'dataspec-spec-selector--dropdown', className)}>
        <select
          className="dataspec-spec-selector__select"
          value={selectedSpec?.id || ''}
          onChange={(e) => {
            const spec = specs.find(s => s.id === e.target.value) || null;
            handleSelect(spec);
          }}
          disabled={disabled || isLoadingSpecs}
        >
          <option value="">{isLoadingSpecs ? 'Loading...' : placeholder}</option>
          {specs.map((spec) => (
            <option key={spec.id} value={spec.id}>
              {spec.name}
              {showVersion && ` (v${spec.version})`}
            </option>
          ))}
        </select>
        {isLoadingSpecs && (
          <div className="dataspec-spec-selector__loading">
            <LoadingSpinner />
          </div>
        )}
      </div>
    );
  }

  // Render list mode
  if (mode === 'list') {
    return (
      <div className={clsx('dataspec-spec-selector', 'dataspec-spec-selector--list', className)}>
        {isLoadingSpecs ? (
          <div className="dataspec-spec-selector__loading-container">
            <LoadingSpinner />
            <span>Loading specifications...</span>
          </div>
        ) : error ? (
          <div className="dataspec-spec-selector__error">
            {error}
          </div>
        ) : specs.length === 0 ? (
          <div className="dataspec-spec-selector__empty">
            No specifications available for {selectedEntity.name}
          </div>
        ) : (
          <ul className="dataspec-spec-selector__list">
            {specs.map((spec) => {
              const isSelected = selectedSpec?.id === spec.id;
              return (
                <li key={spec.id}>
                  {renderSpec ? (
                    <div onClick={() => !disabled && handleSelect(spec)}>
                      {renderSpec(spec, isSelected)}
                    </div>
                  ) : (
                    <button
                      className={clsx(
                        'dataspec-spec-selector__item',
                        isSelected && 'dataspec-spec-selector__item--selected'
                      )}
                      onClick={() => handleSelect(spec)}
                      disabled={disabled}
                      type="button"
                    >
                      <span className="dataspec-spec-selector__icon">
                        <DefaultSpecIcon />
                      </span>
                      <span className="dataspec-spec-selector__content">
                        <span className="dataspec-spec-selector__name">
                          {spec.name}
                          {showVersion && (
                            <span className="dataspec-spec-selector__version">v{spec.version}</span>
                          )}
                        </span>
                        {showDescription && spec.description && (
                          <span className="dataspec-spec-selector__description">
                            {spec.description}
                          </span>
                        )}
                        {showTags && spec.tags && spec.tags.length > 0 && (
                          <span className="dataspec-spec-selector__tags">
                            {spec.tags.map(tag => (
                              <span key={tag} className="dataspec-spec-selector__tag">{tag}</span>
                            ))}
                          </span>
                        )}
                      </span>
                      <span className="dataspec-spec-selector__meta">
                        {formatDate(spec.updatedAt)}
                      </span>
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // Render cards mode
  return (
    <div className={clsx('dataspec-spec-selector', 'dataspec-spec-selector--cards', className)}>
      {isLoadingSpecs ? (
        <div className="dataspec-spec-selector__loading-container">
          <LoadingSpinner />
          <span>Loading specifications...</span>
        </div>
      ) : error ? (
        <div className="dataspec-spec-selector__error">
          {error}
        </div>
      ) : specs.length === 0 ? (
        <div className="dataspec-spec-selector__empty">
          No specifications available for {selectedEntity.name}
        </div>
      ) : (
        <div className="dataspec-spec-selector__grid">
          {specs.map((spec) => {
            const isSelected = selectedSpec?.id === spec.id;
            return renderSpec ? (
              <div key={spec.id} onClick={() => !disabled && handleSelect(spec)}>
                {renderSpec(spec, isSelected)}
              </div>
            ) : (
              <button
                key={spec.id}
                className={clsx(
                  'dataspec-spec-selector__card',
                  isSelected && 'dataspec-spec-selector__card--selected'
                )}
                onClick={() => handleSelect(spec)}
                disabled={disabled}
                type="button"
              >
                <div className="dataspec-spec-selector__card-header">
                  <div className="dataspec-spec-selector__card-icon">
                    <DefaultSpecIcon />
                  </div>
                  {showVersion && (
                    <span className="dataspec-spec-selector__card-version">v{spec.version}</span>
                  )}
                </div>
                <div className="dataspec-spec-selector__card-content">
                  <h3 className="dataspec-spec-selector__card-name">{spec.name}</h3>
                  {showDescription && spec.description && (
                    <p className="dataspec-spec-selector__card-description">
                      {spec.description}
                    </p>
                  )}
                </div>
                {showTags && spec.tags && spec.tags.length > 0 && (
                  <div className="dataspec-spec-selector__card-tags">
                    {spec.tags.map(tag => (
                      <span key={tag} className="dataspec-spec-selector__tag">{tag}</span>
                    ))}
                  </div>
                )}
                <div className="dataspec-spec-selector__card-footer">
                  <span className="dataspec-spec-selector__card-date">
                    Updated: {formatDate(spec.updatedAt)}
                  </span>
                  {spec.author && (
                    <span className="dataspec-spec-selector__card-author">
                      By: {spec.author}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default SpecSelector;
