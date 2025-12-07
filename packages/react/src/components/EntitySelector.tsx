/**
 * EntitySelector Component
 *
 * Dropdown/list component for selecting an entity to import/export.
 */

import React, { useEffect } from 'react';
import clsx from 'clsx';
import { useDataSpecContext } from '../context/DataSpecContext';
import { EntityDefinition } from '../types';

export interface EntitySelectorProps {
  /** Optional class name */
  className?: string;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Display mode */
  mode?: 'dropdown' | 'list' | 'cards';
  /** Show entity description */
  showDescription?: boolean;
  /** Show spec count badge */
  showSpecCount?: boolean;
  /** Custom render function for entity item */
  renderEntity?: (entity: EntityDefinition, isSelected: boolean) => React.ReactNode;
  /** Callback when entity is selected */
  onSelect?: (entity: EntityDefinition | null) => void;
  /** Auto-load entities on mount */
  autoLoad?: boolean;
}

/**
 * Default entity icon
 */
function DefaultEntityIcon() {
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
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
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
 * EntitySelector Component
 */
export function EntitySelector({
  className,
  placeholder = 'Select an entity...',
  disabled = false,
  mode = 'dropdown',
  showDescription = true,
  showSpecCount = true,
  renderEntity,
  onSelect,
  autoLoad = true,
}: EntitySelectorProps) {
  const {
    entities,
    selectedEntity,
    isLoadingEntities,
    error,
    loadEntities,
    selectEntity,
  } = useDataSpecContext();

  // Auto-load entities on mount
  useEffect(() => {
    if (autoLoad && entities.length === 0 && !isLoadingEntities) {
      loadEntities();
    }
  }, [autoLoad, entities.length, isLoadingEntities, loadEntities]);

  // Handle selection
  const handleSelect = (entity: EntityDefinition | null) => {
    selectEntity(entity);
    onSelect?.(entity);
  };

  // Render dropdown mode
  if (mode === 'dropdown') {
    return (
      <div className={clsx('dataspec-entity-selector', 'dataspec-entity-selector--dropdown', className)}>
        <select
          className="dataspec-entity-selector__select"
          value={selectedEntity?.id || ''}
          onChange={(e) => {
            const entity = entities.find(ent => ent.id === e.target.value) || null;
            handleSelect(entity);
          }}
          disabled={disabled || isLoadingEntities}
        >
          <option value="">{isLoadingEntities ? 'Loading...' : placeholder}</option>
          {entities.map((entity) => (
            <option key={entity.id} value={entity.id}>
              {entity.name}
              {showSpecCount && entity.specCount !== undefined && ` (${entity.specCount} specs)`}
            </option>
          ))}
        </select>
        {isLoadingEntities && (
          <div className="dataspec-entity-selector__loading">
            <LoadingSpinner />
          </div>
        )}
      </div>
    );
  }

  // Render list mode
  if (mode === 'list') {
    return (
      <div className={clsx('dataspec-entity-selector', 'dataspec-entity-selector--list', className)}>
        {isLoadingEntities ? (
          <div className="dataspec-entity-selector__loading-container">
            <LoadingSpinner />
            <span>Loading entities...</span>
          </div>
        ) : error ? (
          <div className="dataspec-entity-selector__error">
            {error}
            <button onClick={() => loadEntities()}>Retry</button>
          </div>
        ) : entities.length === 0 ? (
          <div className="dataspec-entity-selector__empty">
            No entities available
          </div>
        ) : (
          <ul className="dataspec-entity-selector__list">
            {entities.map((entity) => {
              const isSelected = selectedEntity?.id === entity.id;
              return (
                <li key={entity.id}>
                  {renderEntity ? (
                    <div onClick={() => !disabled && handleSelect(entity)}>
                      {renderEntity(entity, isSelected)}
                    </div>
                  ) : (
                    <button
                      className={clsx(
                        'dataspec-entity-selector__item',
                        isSelected && 'dataspec-entity-selector__item--selected'
                      )}
                      onClick={() => handleSelect(entity)}
                      disabled={disabled}
                      type="button"
                    >
                      <span className="dataspec-entity-selector__icon">
                        <DefaultEntityIcon />
                      </span>
                      <span className="dataspec-entity-selector__content">
                        <span className="dataspec-entity-selector__name">{entity.name}</span>
                        {showDescription && entity.description && (
                          <span className="dataspec-entity-selector__description">
                            {entity.description}
                          </span>
                        )}
                      </span>
                      {showSpecCount && entity.specCount !== undefined && (
                        <span className="dataspec-entity-selector__badge">
                          {entity.specCount}
                        </span>
                      )}
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
    <div className={clsx('dataspec-entity-selector', 'dataspec-entity-selector--cards', className)}>
      {isLoadingEntities ? (
        <div className="dataspec-entity-selector__loading-container">
          <LoadingSpinner />
          <span>Loading entities...</span>
        </div>
      ) : error ? (
        <div className="dataspec-entity-selector__error">
          {error}
          <button onClick={() => loadEntities()}>Retry</button>
        </div>
      ) : entities.length === 0 ? (
        <div className="dataspec-entity-selector__empty">
          No entities available
        </div>
      ) : (
        <div className="dataspec-entity-selector__grid">
          {entities.map((entity) => {
            const isSelected = selectedEntity?.id === entity.id;
            return renderEntity ? (
              <div key={entity.id} onClick={() => !disabled && handleSelect(entity)}>
                {renderEntity(entity, isSelected)}
              </div>
            ) : (
              <button
                key={entity.id}
                className={clsx(
                  'dataspec-entity-selector__card',
                  isSelected && 'dataspec-entity-selector__card--selected'
                )}
                onClick={() => handleSelect(entity)}
                disabled={disabled}
                type="button"
              >
                <div className="dataspec-entity-selector__card-icon">
                  <DefaultEntityIcon />
                </div>
                <div className="dataspec-entity-selector__card-content">
                  <h3 className="dataspec-entity-selector__card-name">{entity.name}</h3>
                  {showDescription && entity.description && (
                    <p className="dataspec-entity-selector__card-description">
                      {entity.description}
                    </p>
                  )}
                </div>
                {showSpecCount && entity.specCount !== undefined && (
                  <div className="dataspec-entity-selector__card-badge">
                    {entity.specCount} specs
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default EntitySelector;
