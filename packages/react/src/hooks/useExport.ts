/**
 * useExport Hook
 *
 * Hook for managing export operations.
 */

import { useCallback, useState, useMemo } from 'react';
import { useDataSpecContext } from '../context/DataSpecContext';
import { ExportOptions, ExportResult } from '../types';

export interface UseExportOptions {
  /** Default export format */
  defaultFormat?: 'csv' | 'json' | 'xlsx';
  /** Default apply masking setting */
  defaultApplyMasking?: boolean;
  /** Auto-download after export */
  autoDownload?: boolean;
  /** Callback when export completes */
  onExportComplete?: (result: ExportResult) => void;
  /** Callback on error */
  onError?: (error: string) => void;
}

/**
 * useExport hook
 *
 * Provides export-specific operations and state.
 */
export function useExport(options: UseExportOptions = {}) {
  const {
    selectedEntity,
    selectedSpec,
    canUnmask,
    error,
    executeExport,
    setError,
    clearError,
  } = useDataSpecContext();

  const [isExporting, setIsExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportResult | null>(null);
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: options.defaultFormat || 'csv',
    applyMasking: options.defaultApplyMasking ?? true,
    includeHeaders: true,
  });

  // Check if ready for export
  const isReady = useMemo(() => {
    return !!(selectedEntity && selectedSpec && !isExporting);
  }, [selectedEntity, selectedSpec, isExporting]);

  // Get MIME type for format (exported for external use)
  const getMimeType = useCallback((format: string) => {
    switch (format) {
      case 'csv':
        return 'text/csv';
      case 'json':
        return 'application/json';
      case 'xlsx':
        return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      default:
        return 'application/octet-stream';
    }
  }, []);

  // Download file helper
  const downloadFile = useCallback((data: Blob | string, fileName: string, mimeType: string) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  // Update export options
  const updateOptions = useCallback((updates: Partial<ExportOptions>) => {
    setExportOptions(prev => ({ ...prev, ...updates }));
  }, []);

  // Set format
  const setFormat = useCallback((format: 'csv' | 'json' | 'xlsx') => {
    updateOptions({ format });
  }, [updateOptions]);

  // Toggle masking
  const toggleMasking = useCallback(() => {
    setExportOptions(prev => ({ ...prev, applyMasking: !prev.applyMasking }));
  }, []);

  // Set filters
  const setFilters = useCallback((filters: Record<string, any>) => {
    updateOptions({ filters });
  }, [updateOptions]);

  // Set fields to export
  const setFields = useCallback((fields: string[]) => {
    updateOptions({ fields });
  }, [updateOptions]);

  // Execute export
  const startExport = useCallback(async (customOptions?: Partial<ExportOptions>) => {
    if (!isReady) {
      setError('Not ready for export');
      return null;
    }

    setIsExporting(true);
    clearError();

    const finalOptions: ExportOptions = {
      ...exportOptions,
      ...customOptions,
    };

    try {
      const result = await executeExport(finalOptions);

      if (result) {
        setLastExport(result);

        // Auto-download if enabled
        if (options.autoDownload !== false) {
          downloadFile(result.data, result.fileName, result.mimeType);
        }

        options.onExportComplete?.(result);
      }

      return result;
    } catch (err) {
      const errorMessage = (err as Error).message;
      setError(errorMessage);
      options.onError?.(errorMessage);
      return null;
    } finally {
      setIsExporting(false);
    }
  }, [
    isReady,
    exportOptions,
    executeExport,
    downloadFile,
    setError,
    clearError,
    options,
  ]);

  // Quick export functions
  const exportAsCsv = useCallback(async (customOptions?: Partial<ExportOptions>) => {
    return startExport({ ...customOptions, format: 'csv' });
  }, [startExport]);

  const exportAsJson = useCallback(async (customOptions?: Partial<ExportOptions>) => {
    return startExport({ ...customOptions, format: 'json' });
  }, [startExport]);

  const exportAsExcel = useCallback(async (customOptions?: Partial<ExportOptions>) => {
    return startExport({ ...customOptions, format: 'xlsx' });
  }, [startExport]);

  // Export with masking disabled (requires permission)
  const exportUnmasked = useCallback(async (customOptions?: Partial<ExportOptions>) => {
    if (!canUnmask) {
      setError('You do not have permission to export unmasked data');
      return null;
    }
    return startExport({ ...customOptions, applyMasking: false });
  }, [canUnmask, startExport, setError]);

  // Reset export state
  const reset = useCallback(() => {
    setIsExporting(false);
    setLastExport(null);
    setExportOptions({
      format: options.defaultFormat || 'csv',
      applyMasking: options.defaultApplyMasking ?? true,
      includeHeaders: true,
    });
    clearError();
  }, [clearError, options.defaultFormat, options.defaultApplyMasking]);

  return {
    // State
    entity: selectedEntity,
    spec: selectedSpec,
    options: exportOptions,
    lastExport,
    error,
    canUnmask,

    // Derived state
    isReady,
    isExporting,

    // Actions
    updateOptions,
    setFormat,
    toggleMasking,
    setFilters,
    setFields,
    startExport,
    exportAsCsv,
    exportAsJson,
    exportAsExcel,
    exportUnmasked,
    downloadFile,
    getMimeType,
    reset,
    clearError,
  };
}

export default useExport;
