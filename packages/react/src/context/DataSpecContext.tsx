/**
 * DataSpec Context
 *
 * Provides global state management for DataSpec UI components.
 */

import React, { createContext, useContext, useReducer, useCallback, useMemo } from 'react';
import {
  DataSpecContext,
  DataSpecContextState,
  DataSpecProviderConfig,
  EntityDefinition,
  SpecDefinition,
  FileUploadState,
  PreviewResult,
  ImportProgress,
  ImportResult,
  ExportOptions,
  ExportResult,
  OperationStatus,
  hasEntityPermission,
} from '../types';

/**
 * Initial file upload state
 */
const initialFileUpload: FileUploadState = {
  file: null,
  fileName: '',
  fileSize: 0,
  fileType: '',
  uploadProgress: 0,
  status: 'idle',
};

/**
 * Initial import progress state
 */
const initialImportProgress: ImportProgress = {
  status: OperationStatus.PENDING,
  phase: 'idle',
  totalRows: 0,
  processedRows: 0,
  successfulRows: 0,
  failedRows: 0,
  currentBatch: 0,
  totalBatches: 0,
  errors: [],
};

/**
 * Create initial state
 */
const createInitialState = (config: DataSpecProviderConfig): DataSpecContextState => ({
  config,
  entities: [],
  specs: [],
  selectedEntity: null,
  selectedSpec: null,
  fileUpload: initialFileUpload,
  preview: null,
  isPreviewLoading: false,
  importProgress: initialImportProgress,
  importResult: null,
  userRoles: [],
  canUnmask: false,
  canViewSelected: false,
  canImportSelected: false,
  canExportSelected: false,
  isLoadingEntities: false,
  isLoadingSpecs: false,
  error: null,
});

/**
 * Compute permission flags for selected entity
 */
function computePermissions(
  entity: EntityDefinition | null,
  userRoles: string[]
): { canView: boolean; canImport: boolean; canExport: boolean } {
  if (!entity) {
    return { canView: false, canImport: false, canExport: false };
  }
  return {
    canView: hasEntityPermission(entity, 'view', userRoles),
    canImport: hasEntityPermission(entity, 'import', userRoles),
    canExport: hasEntityPermission(entity, 'export', userRoles),
  };
}

/**
 * Action types
 */
type Action =
  | { type: 'SET_ENTITIES'; payload: EntityDefinition[] }
  | { type: 'SET_SPECS'; payload: SpecDefinition[] }
  | { type: 'SELECT_ENTITY'; payload: EntityDefinition | null }
  | { type: 'SELECT_SPEC'; payload: SpecDefinition | null }
  | { type: 'SET_FILE'; payload: File | null }
  | { type: 'SET_FILE_UPLOAD_STATE'; payload: Partial<FileUploadState> }
  | { type: 'SET_PREVIEW'; payload: PreviewResult | null }
  | { type: 'SET_PREVIEW_LOADING'; payload: boolean }
  | { type: 'SET_IMPORT_PROGRESS'; payload: Partial<ImportProgress> }
  | { type: 'SET_IMPORT_RESULT'; payload: ImportResult | null }
  | { type: 'SET_USER_ROLES'; payload: string[] }
  | { type: 'SET_LOADING_ENTITIES'; payload: boolean }
  | { type: 'SET_LOADING_SPECS'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

/**
 * Reducer
 */
function reducer(state: DataSpecContextState, action: Action): DataSpecContextState {
  switch (action.type) {
    case 'SET_ENTITIES':
      return { ...state, entities: action.payload };

    case 'SET_SPECS':
      return { ...state, specs: action.payload };

    case 'SELECT_ENTITY': {
      const perms = computePermissions(action.payload, state.userRoles);
      return {
        ...state,
        selectedEntity: action.payload,
        selectedSpec: null,
        specs: [],
        preview: null,
        fileUpload: initialFileUpload,
        canViewSelected: perms.canView,
        canImportSelected: perms.canImport,
        canExportSelected: perms.canExport,
      };
    }

    case 'SELECT_SPEC':
      return {
        ...state,
        selectedSpec: action.payload,
        preview: null,
      };

    case 'SET_FILE':
      if (!action.payload) {
        return { ...state, fileUpload: initialFileUpload };
      }
      return {
        ...state,
        fileUpload: {
          file: action.payload,
          fileName: action.payload.name,
          fileSize: action.payload.size,
          fileType: action.payload.type,
          uploadProgress: 0,
          status: 'idle',
        },
        preview: null,
      };

    case 'SET_FILE_UPLOAD_STATE':
      return {
        ...state,
        fileUpload: { ...state.fileUpload, ...action.payload },
      };

    case 'SET_PREVIEW':
      return { ...state, preview: action.payload };

    case 'SET_PREVIEW_LOADING':
      return { ...state, isPreviewLoading: action.payload };

    case 'SET_IMPORT_PROGRESS':
      return {
        ...state,
        importProgress: { ...state.importProgress, ...action.payload },
      };

    case 'SET_IMPORT_RESULT':
      return { ...state, importResult: action.payload };

    case 'SET_USER_ROLES': {
      const perms = computePermissions(state.selectedEntity, action.payload);
      return {
        ...state,
        userRoles: action.payload,
        canUnmask: action.payload.some(role =>
          ['admin', 'super_admin', 'data_manager'].includes(role)
        ),
        canViewSelected: perms.canView,
        canImportSelected: perms.canImport,
        canExportSelected: perms.canExport,
      };
    }

    case 'SET_LOADING_ENTITIES':
      return { ...state, isLoadingEntities: action.payload };

    case 'SET_LOADING_SPECS':
      return { ...state, isLoadingSpecs: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload };

    case 'RESET':
      return createInitialState(state.config);

    default:
      return state;
  }
}

/**
 * Context
 */
const Context = createContext<DataSpecContext | null>(null);

/**
 * Provider props
 */
export interface DataSpecProviderProps {
  config: DataSpecProviderConfig;
  userRoles?: string[];
  children: React.ReactNode;
}

/**
 * API helper
 */
async function apiRequest<T>(
  config: DataSpecProviderConfig,
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${config.api.baseUrl}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...config.api.headers,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Default empty roles array to avoid creating new reference on each render
const DEFAULT_USER_ROLES: string[] = [];

/**
 * DataSpec Provider Component
 */
export function DataSpecProvider({ config, userRoles, children }: DataSpecProviderProps) {
  const [state, dispatch] = useReducer(reducer, config, createInitialState);

  // Use stable reference for user roles
  const roles = userRoles ?? DEFAULT_USER_ROLES;
  const rolesRef = React.useRef<string[]>(DEFAULT_USER_ROLES);
  const isFirstMount = React.useRef(true);

  // Dispatch roles on mount and when they change
  React.useEffect(() => {
    const newRoles = roles;
    const prevRoles = rolesRef.current;

    // Always dispatch on first mount if roles are provided
    if (isFirstMount.current) {
      isFirstMount.current = false;
      if (newRoles.length > 0) {
        rolesRef.current = newRoles;
        dispatch({ type: 'SET_USER_ROLES', payload: newRoles });
      }
      return;
    }

    // Compare arrays by content on subsequent renders
    const rolesChanged =
      newRoles.length !== prevRoles.length ||
      newRoles.some((role, i) => role !== prevRoles[i]);

    if (rolesChanged) {
      rolesRef.current = newRoles;
      dispatch({ type: 'SET_USER_ROLES', payload: newRoles });
    }
  }, [roles]);

  // Load entities
  const loadEntities = useCallback(async () => {
    dispatch({ type: 'SET_LOADING_ENTITIES', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await apiRequest<{ success: boolean; data: { entities: EntityDefinition[] } }>(config, '/dataspec/entities');
      const entities = response.data?.entities || [];
      dispatch({ type: 'SET_ENTITIES', payload: entities });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING_ENTITIES', payload: false });
    }
  }, [config]);

  // Load specs for entity
  const loadSpecs = useCallback(async (entityId: string) => {
    dispatch({ type: 'SET_LOADING_SPECS', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await apiRequest<{ success: boolean; data: { specs: SpecDefinition[] } }>(
        config,
        `/dataspec/specs?entity=${entityId}`
      );
      const specs = response.data?.specs || [];
      dispatch({ type: 'SET_SPECS', payload: specs });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
    } finally {
      dispatch({ type: 'SET_LOADING_SPECS', payload: false });
    }
  }, [config]);

  // Select entity
  const selectEntity = useCallback((entity: EntityDefinition | null) => {
    dispatch({ type: 'SELECT_ENTITY', payload: entity });
    if (entity) {
      loadSpecs(entity.id);
    }
  }, [loadSpecs]);

  // Select spec
  const selectSpec = useCallback((spec: SpecDefinition | null) => {
    dispatch({ type: 'SELECT_SPEC', payload: spec });
  }, []);

  // Set file
  const setFile = useCallback((file: File | null) => {
    dispatch({ type: 'SET_FILE', payload: file });
  }, []);

  // Clear file
  const clearFile = useCallback(() => {
    dispatch({ type: 'SET_FILE', payload: null });
  }, []);

  // Generate preview
  const generatePreview = useCallback(async (): Promise<PreviewResult | null> => {
    if (!state.fileUpload.file || !state.selectedSpec) {
      return null;
    }

    dispatch({ type: 'SET_PREVIEW_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const formData = new FormData();
      formData.append('file', state.fileUpload.file);
      formData.append('specId', state.selectedSpec.id);

      const response = await fetch(`${config.api.baseUrl}/dataspec/import/preview`, {
        method: 'POST',
        headers: config.api.headers,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Preview failed' }));
        throw new Error(error.message);
      }

      const preview = await response.json() as PreviewResult;
      dispatch({ type: 'SET_PREVIEW', payload: preview });
      return preview;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      return null;
    } finally {
      dispatch({ type: 'SET_PREVIEW_LOADING', payload: false });
    }
  }, [config, state.fileUpload.file, state.selectedSpec]);

  // Clear preview
  const clearPreview = useCallback(() => {
    dispatch({ type: 'SET_PREVIEW', payload: null });
  }, []);

  // Execute import
  const executeImport = useCallback(async (): Promise<ImportResult | null> => {
    if (!state.fileUpload.file || !state.selectedSpec) {
      return null;
    }

    dispatch({
      type: 'SET_IMPORT_PROGRESS',
      payload: {
        status: OperationStatus.IN_PROGRESS,
        phase: 'validating',
        startTime: new Date(),
      },
    });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const formData = new FormData();
      formData.append('file', state.fileUpload.file);
      formData.append('specId', state.selectedSpec.id);

      const response = await fetch(`${config.api.baseUrl}/dataspec/import/execute`, {
        method: 'POST',
        headers: config.api.headers,
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Import failed' }));
        throw new Error(error.message);
      }

      const result = await response.json() as ImportResult;

      dispatch({
        type: 'SET_IMPORT_PROGRESS',
        payload: {
          status: result.success ? OperationStatus.SUCCESS : OperationStatus.ERROR,
          phase: 'complete',
          totalRows: result.totalRows,
          processedRows: result.totalRows,
          successfulRows: result.successfulRows,
          failedRows: result.failedRows,
          endTime: new Date(),
          errors: result.errors,
        },
      });
      dispatch({ type: 'SET_IMPORT_RESULT', payload: result });

      return result;
    } catch (error) {
      dispatch({
        type: 'SET_IMPORT_PROGRESS',
        payload: {
          status: OperationStatus.ERROR,
          phase: 'error',
          endTime: new Date(),
        },
      });
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      return null;
    }
  }, [config, state.fileUpload.file, state.selectedSpec]);

  // Cancel import
  const cancelImport = useCallback(() => {
    dispatch({
      type: 'SET_IMPORT_PROGRESS',
      payload: {
        status: OperationStatus.ERROR,
        phase: 'error',
        endTime: new Date(),
      },
    });
  }, []);

  // Reset import
  const resetImport = useCallback(() => {
    dispatch({ type: 'SET_IMPORT_PROGRESS', payload: initialImportProgress });
    dispatch({ type: 'SET_IMPORT_RESULT', payload: null });
  }, []);

  // Execute export
  const executeExport = useCallback(async (options: ExportOptions): Promise<ExportResult | null> => {
    if (!state.selectedEntity || !state.selectedSpec) {
      return null;
    }

    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await fetch(`${config.api.baseUrl}/dataspec/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...config.api.headers,
        },
        body: JSON.stringify({
          specId: state.selectedSpec.id,
          entityId: state.selectedEntity.id,
          ...options,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Export failed' }));
        throw new Error(error.message);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      const fileName = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `export.${options.format}`;

      return {
        success: true,
        data: blob,
        fileName,
        mimeType: blob.type,
        rowCount: parseInt(response.headers.get('X-Row-Count') || '0', 10),
        maskedFieldCount: parseInt(response.headers.get('X-Masked-Fields') || '0', 10),
      };
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      return null;
    }
  }, [config, state.selectedEntity, state.selectedSpec]);

  // Unmask field
  const unmaskField = useCallback(async (
    rowIndex: number,
    fieldName: string,
    reason?: string
  ): Promise<any> => {
    if (!state.canUnmask) {
      throw new Error('You do not have permission to unmask this field');
    }

    try {
      const response = await apiRequest<{ value: any }>(config, '/dataspec/unmask', {
        method: 'POST',
        body: JSON.stringify({
          rowIndex,
          fieldName,
          reason,
          specId: state.selectedSpec?.id,
        }),
      });

      return response.value;
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: (error as Error).message });
      throw error;
    }
  }, [config, state.canUnmask, state.selectedSpec]);

  // Set error
  const setError = useCallback((error: string | null) => {
    dispatch({ type: 'SET_ERROR', payload: error });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: 'SET_ERROR', payload: null });
  }, []);

  // Reset all
  const reset = useCallback(() => {
    dispatch({ type: 'RESET' });
  }, []);

  // Memoized context value
  const contextValue = useMemo<DataSpecContext>(() => ({
    ...state,
    selectEntity,
    selectSpec,
    loadEntities,
    loadSpecs,
    setFile,
    clearFile,
    generatePreview,
    clearPreview,
    executeImport,
    cancelImport,
    resetImport,
    executeExport,
    unmaskField,
    setError,
    clearError,
    reset,
  }), [
    state,
    selectEntity,
    selectSpec,
    loadEntities,
    loadSpecs,
    setFile,
    clearFile,
    generatePreview,
    clearPreview,
    executeImport,
    cancelImport,
    resetImport,
    executeExport,
    unmaskField,
    setError,
    clearError,
    reset,
  ]);

  return (
    <Context.Provider value={contextValue}>
      {children}
    </Context.Provider>
  );
}

/**
 * Hook to use DataSpec context
 */
export function useDataSpecContext(): DataSpecContext {
  const context = useContext(Context);
  if (!context) {
    throw new Error('useDataSpecContext must be used within a DataSpecProvider');
  }
  return context;
}

export default DataSpecProvider;
