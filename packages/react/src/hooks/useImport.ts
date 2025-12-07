/**
 * useImport Hook
 *
 * Hook for managing import operations.
 */

import { useCallback, useMemo } from 'react';
import { OperationStatus } from '../types';
import { useDataSpecContext } from '../context/DataSpecContext';

export interface UseImportOptions {
  /** Auto-generate preview after file upload */
  autoPreview?: boolean;
  /** Callback when preview is ready */
  onPreviewReady?: () => void;
  /** Callback when import completes */
  onImportComplete?: () => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * useImport hook
 *
 * Provides import-specific operations and state.
 */
export function useImport(options: UseImportOptions = {}) {
  const {
    fileUpload,
    selectedEntity,
    selectedSpec,
    preview,
    importProgress,
    importResult,
    isPreviewLoading,
    error,
    setFile,
    clearFile,
    generatePreview,
    clearPreview,
    executeImport,
    cancelImport,
    resetImport,
    setError,
    clearError,
  } = useDataSpecContext();

  // Check if ready for various operations
  const isReady = useMemo(() => ({
    forUpload: !!selectedSpec,
    forPreview: !!(selectedSpec && fileUpload.file && !isPreviewLoading),
    forImport: !!(preview && preview.validRows > 0 && importProgress.phase === 'idle'),
  }), [selectedSpec, fileUpload.file, isPreviewLoading, preview, importProgress.phase]);

  // Current phase description
  const phaseDescription = useMemo(() => {
    if (importProgress.phase === 'idle') return 'Ready';
    if (importProgress.phase === 'validating') return 'Validating data...';
    if (importProgress.phase === 'transforming') return 'Applying transformations...';
    if (importProgress.phase === 'importing') return 'Writing to database...';
    if (importProgress.phase === 'complete') {
      return importProgress.status === OperationStatus.SUCCESS
        ? 'Import successful'
        : 'Import completed with errors';
    }
    if (importProgress.phase === 'error') return 'Import failed';
    return 'Unknown';
  }, [importProgress.phase, importProgress.status]);

  // Progress percentage
  const progressPercent = useMemo(() => {
    if (importProgress.totalRows === 0) return 0;
    return Math.round((importProgress.processedRows / importProgress.totalRows) * 100);
  }, [importProgress.processedRows, importProgress.totalRows]);

  // Is operation in progress
  const isInProgress = useMemo(() => {
    return ['validating', 'transforming', 'importing'].includes(importProgress.phase);
  }, [importProgress.phase]);

  // Upload file handler with auto-preview
  const uploadFile = useCallback(async (file: File) => {
    setFile(file);

    if (options.autoPreview) {
      try {
        await generatePreview();
        options.onPreviewReady?.();
      } catch (err) {
        setError((err as Error).message);
        options.onError?.((err as Error).message);
      }
    }
  }, [setFile, generatePreview, setError, options]);

  // Start import with callbacks
  const startImport = useCallback(async () => {
    if (!isReady.forImport) {
      setError('Not ready for import');
      return null;
    }

    clearError();

    try {
      const result = await executeImport();
      if (result) {
        options.onImportComplete?.();
      }
      return result;
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      options.onError?.(errorMessage);
      return null;
    }
  }, [isReady.forImport, executeImport, setError, clearError, options]);

  // Preview stats
  const previewStats = useMemo(() => {
    if (!preview) return null;
    return {
      total: preview.totalRows,
      valid: preview.validRows,
      invalid: preview.invalidRows,
      inserts: preview.insertCount,
      updates: preview.updateCount,
      skips: preview.skipCount,
      masked: preview.maskedFieldCount,
      validPercent: preview.totalRows > 0
        ? Math.round((preview.validRows / preview.totalRows) * 100)
        : 0,
    };
  }, [preview]);

  // Import result stats
  const resultStats = useMemo(() => {
    if (!importResult) return null;
    return {
      total: importResult.totalRows,
      successful: importResult.successfulRows,
      failed: importResult.failedRows,
      executionTimeMs: importResult.executionTimeMs,
      executionId: importResult.executionId,
      success: importResult.success,
      successPercent: importResult.totalRows > 0
        ? Math.round((importResult.successfulRows / importResult.totalRows) * 100)
        : 0,
    };
  }, [importResult]);

  return {
    // State
    file: fileUpload.file,
    fileName: fileUpload.fileName,
    fileSize: fileUpload.fileSize,
    fileType: fileUpload.fileType,
    entity: selectedEntity,
    spec: selectedSpec,
    preview,
    previewStats,
    importProgress,
    importResult,
    resultStats,
    error,

    // Derived state
    isReady,
    isPreviewLoading,
    isInProgress,
    phaseDescription,
    progressPercent,

    // Actions
    uploadFile,
    setFile,
    clearFile,
    generatePreview,
    clearPreview,
    startImport,
    cancelImport,
    resetImport,
    clearError,
  };
}

export default useImport;
