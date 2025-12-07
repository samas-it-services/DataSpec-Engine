/**
 * useDataSpec Hook
 *
 * Convenience hook for accessing DataSpec context and common operations.
 */

import { useCallback, useMemo } from 'react';
import { useDataSpecContext } from '../context/DataSpecContext';

/**
 * useDataSpec hook
 *
 * Provides easy access to DataSpec context with derived state.
 */
export function useDataSpec() {
  const context = useDataSpecContext();

  // Derived state: is ready to preview
  const canPreview = useMemo(() => {
    return !!(
      context.selectedEntity &&
      context.selectedSpec &&
      context.fileUpload.file &&
      !context.isPreviewLoading
    );
  }, [
    context.selectedEntity,
    context.selectedSpec,
    context.fileUpload.file,
    context.isPreviewLoading,
  ]);

  // Derived state: is ready to import
  const canImport = useMemo(() => {
    return !!(
      context.preview &&
      context.preview.validRows > 0 &&
      context.importProgress.phase === 'idle'
    );
  }, [context.preview, context.importProgress.phase]);

  // Derived state: is importing
  const isImporting = useMemo(() => {
    return ['validating', 'transforming', 'importing'].includes(
      context.importProgress.phase
    );
  }, [context.importProgress.phase]);

  // Derived state: has completed import
  const hasCompletedImport = useMemo(() => {
    return context.importProgress.phase === 'complete' ||
           context.importProgress.phase === 'error';
  }, [context.importProgress.phase]);

  // Derived state: workflow step
  const currentStep = useMemo(() => {
    if (!context.selectedEntity) return 'select-entity';
    if (!context.selectedSpec) return 'select-spec';
    if (!context.fileUpload.file) return 'upload-file';
    if (!context.preview) return 'preview';
    if (context.importProgress.phase !== 'idle') return 'import';
    return 'ready';
  }, [
    context.selectedEntity,
    context.selectedSpec,
    context.fileUpload.file,
    context.preview,
    context.importProgress.phase,
  ]);

  // Helper: start fresh workflow
  const startNewWorkflow = useCallback(() => {
    context.reset();
    context.loadEntities();
  }, [context]);

  // Helper: go back to previous step
  const goBack = useCallback(() => {
    switch (currentStep) {
      case 'select-spec':
        context.selectEntity(null);
        break;
      case 'upload-file':
        context.selectSpec(null);
        break;
      case 'preview':
      case 'ready':
        context.clearFile();
        break;
      case 'import':
        if (hasCompletedImport) {
          context.resetImport();
        }
        break;
    }
  }, [currentStep, context, hasCompletedImport]);

  return {
    // State
    ...context,

    // Derived state
    canPreview,
    canImport,
    isImporting,
    hasCompletedImport,
    currentStep,

    // Helpers
    startNewWorkflow,
    goBack,
  };
}

export default useDataSpec;
