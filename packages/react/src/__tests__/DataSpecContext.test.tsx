/**
 * DataSpec Context Tests
 */

import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';
import { DataSpecProvider, useDataSpecContext } from '../context/DataSpecContext';
import { DataSpecProviderConfig } from '../types';

// Mock fetch
global.fetch = jest.fn();

const mockConfig: DataSpecProviderConfig = {
  api: {
    baseUrl: 'http://localhost:3000',
    headers: { Authorization: 'Bearer test-token' },
  },
};

// Test component that exposes context
function TestConsumer({ onContext }: { onContext: (ctx: ReturnType<typeof useDataSpecContext>) => void }) {
  const context = useDataSpecContext();
  React.useEffect(() => {
    onContext(context);
  }, [context, onContext]);
  return <div data-testid="consumer">Consumer</div>;
}

describe('DataSpecContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  describe('DataSpecProvider', () => {
    it('should render children', () => {
      render(
        <DataSpecProvider config={mockConfig}>
          <div data-testid="child">Child</div>
        </DataSpecProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should provide initial state', () => {
      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      expect(contextValue).not.toBeNull();
      expect(contextValue!.entities).toEqual([]);
      expect(contextValue!.specs).toEqual([]);
      expect(contextValue!.selectedEntity).toBeNull();
      expect(contextValue!.selectedSpec).toBeNull();
      expect(contextValue!.fileUpload.file).toBeNull();
      expect(contextValue!.preview).toBeNull();
      expect(contextValue!.error).toBeNull();
    });

    it('should set user roles on mount', () => {
      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig} userRoles={['admin', 'user']}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      expect(contextValue!.userRoles).toEqual(['admin', 'user']);
    });

    it('should set canUnmask true for admin roles', () => {
      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig} userRoles={['admin']}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      expect(contextValue!.canUnmask).toBe(true);
    });

    it('should set canUnmask false for non-admin roles', () => {
      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig} userRoles={['user', 'viewer']}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      expect(contextValue!.canUnmask).toBe(false);
    });
  });

  describe('loadEntities', () => {
    it('should fetch entities from API', async () => {
      const mockEntities = [
        { id: '1', name: 'Entity 1', table: 'table1' },
        { id: '2', name: 'Entity 2', table: 'table2' },
      ];

      // API returns { success: boolean, data: { entities: [...] } } format
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, data: { entities: mockEntities } }),
      });

      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      await act(async () => {
        await contextValue!.loadEntities();
      });

      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:3000/dataspec/entities',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        })
      );

      expect(contextValue!.entities).toEqual(mockEntities);
    });

    it('should handle API errors', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Not found' }),
      });

      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      await act(async () => {
        await contextValue!.loadEntities();
      });

      expect(contextValue!.error).toBe('Not found');
    });
  });

  describe('selectEntity', () => {
    it('should select an entity and clear related state', async () => {
      const mockEntity = { id: '1', name: 'Entity 1', table: 'table1' };
      const mockSpecs = [{ id: 's1', name: 'Spec 1', entity: '1', version: '1.0', createdAt: new Date(), updatedAt: new Date() }];

      // API returns { success: boolean, data: { specs: [...] } } format
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ success: true, data: { specs: mockSpecs } }),
        });

      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      await act(async () => {
        contextValue!.selectEntity(mockEntity);
      });

      await waitFor(() => {
        expect(contextValue!.selectedEntity).toEqual(mockEntity);
      });
    });

    it('should clear entity selection', async () => {
      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      await act(async () => {
        contextValue!.selectEntity(null);
      });

      expect(contextValue!.selectedEntity).toBeNull();
      expect(contextValue!.selectedSpec).toBeNull();
    });
  });

  describe('setFile', () => {
    it('should set file upload state', async () => {
      const mockFile = new File(['test content'], 'test.csv', { type: 'text/csv' });

      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      await act(async () => {
        contextValue!.setFile(mockFile);
      });

      expect(contextValue!.fileUpload.file).toBe(mockFile);
      expect(contextValue!.fileUpload.fileName).toBe('test.csv');
      expect(contextValue!.fileUpload.fileType).toBe('text/csv');
    });

    it('should clear file', async () => {
      const mockFile = new File(['test content'], 'test.csv', { type: 'text/csv' });

      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      await act(async () => {
        contextValue!.setFile(mockFile);
      });

      await act(async () => {
        contextValue!.clearFile();
      });

      expect(contextValue!.fileUpload.file).toBeNull();
      expect(contextValue!.fileUpload.fileName).toBe('');
    });
  });

  describe('reset', () => {
    it('should reset all state', async () => {
      const mockFile = new File(['test content'], 'test.csv', { type: 'text/csv' });

      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      await act(async () => {
        contextValue!.setFile(mockFile);
        contextValue!.setError('test error');
      });

      await act(async () => {
        contextValue!.reset();
      });

      expect(contextValue!.fileUpload.file).toBeNull();
      expect(contextValue!.error).toBeNull();
      expect(contextValue!.selectedEntity).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should set error', async () => {
      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      await act(async () => {
        contextValue!.setError('Test error');
      });

      expect(contextValue!.error).toBe('Test error');
    });

    it('should clear error', async () => {
      let contextValue: ReturnType<typeof useDataSpecContext> | null = null;

      render(
        <DataSpecProvider config={mockConfig}>
          <TestConsumer onContext={(ctx) => { contextValue = ctx; }} />
        </DataSpecProvider>
      );

      await act(async () => {
        contextValue!.setError('Test error');
      });

      await act(async () => {
        contextValue!.clearError();
      });

      expect(contextValue!.error).toBeNull();
    });
  });
});

describe('useDataSpecContext', () => {
  it('should throw error when used outside provider', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(<TestConsumer onContext={() => {}} />);
    }).toThrow('useDataSpecContext must be used within a DataSpecProvider');

    consoleError.mockRestore();
  });
});
