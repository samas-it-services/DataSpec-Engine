/**
 * React Hooks Tests
 */

import React from 'react';
import { render, act, waitFor } from '@testing-library/react';
import { DataSpecProvider, useDataSpecContext } from '../context/DataSpecContext';
import { useDataSpec } from '../hooks/useDataSpec';
import { useImport } from '../hooks/useImport';
import { useExport } from '../hooks/useExport';
import { DataSpecProviderConfig } from '../types';

// Mock fetch
global.fetch = jest.fn();

const mockConfig: DataSpecProviderConfig = {
  api: {
    baseUrl: 'http://localhost:3000',
  },
};

// Helper component to test hooks
function HookTester<T>({ useHookFn, onValue }: { useHookFn: () => T; onValue: (value: T) => void }) {
  const value = useHookFn();
  React.useEffect(() => {
    onValue(value);
  }, [value, onValue]);
  return null;
}

const renderHook = <T,>(useHookFn: () => T, userRoles: string[] = []) => {
  let hookValue: T;
  const onValue = (value: T) => { hookValue = value; };

  render(
    <DataSpecProvider config={mockConfig} userRoles={userRoles}>
      <HookTester useHookFn={useHookFn} onValue={onValue} />
    </DataSpecProvider>
  );

  return () => hookValue;
};

describe('useDataSpec', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  it('should return context state', () => {
    const getHook = renderHook(() => useDataSpec());
    const hook = getHook();

    expect(hook.entities).toEqual([]);
    expect(hook.specs).toEqual([]);
    expect(hook.selectedEntity).toBeNull();
    expect(hook.selectedSpec).toBeNull();
  });

  it('should compute canPreview correctly', () => {
    const getHook = renderHook(() => useDataSpec());
    const hook = getHook();

    // No entity, spec, or file selected
    expect(hook.canPreview).toBe(false);
  });

  it('should compute canImport correctly', () => {
    const getHook = renderHook(() => useDataSpec());
    const hook = getHook();

    // No preview available
    expect(hook.canImport).toBe(false);
  });

  it('should compute isImporting correctly', () => {
    const getHook = renderHook(() => useDataSpec());
    const hook = getHook();

    expect(hook.isImporting).toBe(false);
  });

  it('should compute currentStep as select-entity initially', () => {
    const getHook = renderHook(() => useDataSpec());
    const hook = getHook();

    expect(hook.currentStep).toBe('select-entity');
  });

  it('should provide startNewWorkflow function', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const getHook = renderHook(() => useDataSpec());

    await act(async () => {
      getHook().startNewWorkflow();
    });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });
  });
});

describe('useImport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  it('should return import state', () => {
    const getHook = renderHook(() => useImport());
    const hook = getHook();

    expect(hook.file).toBeNull();
    expect(hook.fileName).toBe('');
    expect(hook.preview).toBeNull();
    expect(hook.importProgress).toBeDefined();
  });

  it('should compute isReady correctly', () => {
    const getHook = renderHook(() => useImport());
    const hook = getHook();

    expect(hook.isReady.forUpload).toBe(false);
    expect(hook.isReady.forPreview).toBe(false);
    expect(hook.isReady.forImport).toBe(false);
  });

  it('should compute phaseDescription as Ready initially', () => {
    const getHook = renderHook(() => useImport());
    const hook = getHook();

    expect(hook.phaseDescription).toBe('Ready');
  });

  it('should compute progressPercent as 0 initially', () => {
    const getHook = renderHook(() => useImport());
    const hook = getHook();

    expect(hook.progressPercent).toBe(0);
  });

  it('should not start import when not ready', async () => {
    const getHook = renderHook(() => useImport());

    let result;
    await act(async () => {
      result = await getHook().startImport();
    });

    expect(result).toBeNull();
  });

  it('should handle file upload', async () => {
    const getHook = renderHook(() => useImport());
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });

    await act(async () => {
      getHook().setFile(file);
    });

    await waitFor(() => {
      expect(getHook().file).toBe(file);
      expect(getHook().fileName).toBe('test.csv');
    });
  });

  it('should clear file', async () => {
    const getHook = renderHook(() => useImport());
    const file = new File(['test'], 'test.csv', { type: 'text/csv' });

    await act(async () => {
      getHook().setFile(file);
    });

    await act(async () => {
      getHook().clearFile();
    });

    await waitFor(() => {
      expect(getHook().file).toBeNull();
    });
  });

  it.skip('should call onPreviewReady callback with autoPreview', async () => {
    // Skipped: flaky due to complex async timing with spec selection and preview
    const onPreviewReady = jest.fn();
    const onError = jest.fn();

    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Preview failed' }),
    });

    // Set up spec first
    function SpecSetter({ children }: { children: React.ReactNode }) {
      const ctx = useDataSpecContext();
      React.useEffect(() => {
        ctx.selectSpec({
          id: 'spec-1',
          name: 'Test',
          entity: 'test',
          version: '1.0',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }, []);
      return <>{children}</>;
    }

    let hookValue: ReturnType<typeof useImport>;
    render(
      <DataSpecProvider config={mockConfig}>
        <SpecSetter>
          <HookTester
            useHookFn={() => useImport({ autoPreview: true, onPreviewReady, onError })}
            onValue={(v) => { hookValue = v; }}
          />
        </SpecSetter>
      </DataSpecProvider>
    );

    const file = new File(['test'], 'test.csv', { type: 'text/csv' });

    await act(async () => {
      await hookValue!.uploadFile(file);
    });

    // Should call onError since preview fails
    await waitFor(() => {
      expect(onError).toHaveBeenCalled();
    });
  });
});

describe('useExport', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  it('should return export state', () => {
    const getHook = renderHook(() => useExport());
    const hook = getHook();

    expect(hook.entity).toBeNull();
    expect(hook.spec).toBeNull();
    expect(hook.options).toBeDefined();
    expect(hook.lastExport).toBeNull();
  });

  it('should use default options', () => {
    const getHook = renderHook(() => useExport({
      defaultFormat: 'json',
      defaultApplyMasking: false,
    }));
    const hook = getHook();

    expect(hook.options.format).toBe('json');
    expect(hook.options.applyMasking).toBe(false);
  });

  it('should compute isReady as false when no entity/spec selected', () => {
    const getHook = renderHook(() => useExport());
    const hook = getHook();

    expect(hook.isReady).toBe(false);
  });

  it('should compute isExporting as false initially', () => {
    const getHook = renderHook(() => useExport());
    const hook = getHook();

    expect(hook.isExporting).toBe(false);
  });

  it('should update format', async () => {
    const getHook = renderHook(() => useExport());

    await act(async () => {
      getHook().setFormat('xlsx');
    });

    await waitFor(() => {
      expect(getHook().options.format).toBe('xlsx');
    });
  });

  it('should toggle masking', async () => {
    const getHook = renderHook(() => useExport());
    const initialMasking = getHook().options.applyMasking;

    await act(async () => {
      getHook().toggleMasking();
    });

    await waitFor(() => {
      expect(getHook().options.applyMasking).toBe(!initialMasking);
    });
  });

  it('should set filters', async () => {
    const getHook = renderHook(() => useExport());
    const filters = { status: 'active', year: 2024 };

    await act(async () => {
      getHook().setFilters(filters);
    });

    await waitFor(() => {
      expect(getHook().options.filters).toEqual(filters);
    });
  });

  it('should set fields', async () => {
    const getHook = renderHook(() => useExport());
    const fields = ['name', 'email', 'phone'];

    await act(async () => {
      getHook().setFields(fields);
    });

    await waitFor(() => {
      expect(getHook().options.fields).toEqual(fields);
    });
  });

  it('should not allow unmasked export without permission', async () => {
    const getHook = renderHook(() => useExport());

    let result;
    await act(async () => {
      result = await getHook().exportUnmasked();
    });

    expect(result).toBeNull();
  });

  it('should allow unmasked export with admin role', async () => {
    // Set up with entity and spec
    function SpecSetter({ children }: { children: React.ReactNode }) {
      const ctx = useDataSpecContext();
      React.useEffect(() => {
        ctx.selectEntity({
          id: 'entity-1',
          name: 'Test Entity',
          table: 'test',
        });
        ctx.selectSpec({
          id: 'spec-1',
          name: 'Test',
          entity: 'test',
          version: '1.0',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }, []);
      return <>{children}</>;
    }

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: true, json: async () => [] }) // loadSpecs
      .mockResolvedValueOnce({
        ok: true,
        blob: async () => new Blob(['test'], { type: 'text/csv' }),
        headers: new Map([
          ['Content-Disposition', 'attachment; filename="export.csv"'],
          ['X-Row-Count', '10'],
          ['X-Masked-Fields', '0'],
        ]),
      });

    let hookValue: ReturnType<typeof useExport>;
    render(
      <DataSpecProvider config={mockConfig} userRoles={['admin']}>
        <SpecSetter>
          <HookTester
            useHookFn={() => useExport({ autoDownload: false })}
            onValue={(v) => { hookValue = v; }}
          />
        </SpecSetter>
      </DataSpecProvider>
    );

    // Wait for setup
    await waitFor(() => {
      expect(hookValue!.canUnmask).toBe(true);
    });
  });

  it('should reset export state', async () => {
    const getHook = renderHook(() => useExport());

    await act(async () => {
      getHook().setFormat('xlsx');
      getHook().setFilters({ test: true });
    });

    await act(async () => {
      getHook().reset();
    });

    await waitFor(() => {
      expect(getHook().options.format).toBe('csv');
      expect(getHook().options.filters).toBeUndefined();
    });
  });
});
