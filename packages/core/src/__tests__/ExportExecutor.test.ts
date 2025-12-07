/**
 * ExportExecutor Unit Tests
 */

import { ExportExecutor } from '../executor/ExportExecutor';
import {
  DataSpecDefinition,
  DataType,
  SensitivityLevel,
  MaskingMode
} from '../types/spec.types';
import { DatabaseAdapter } from '../types/execution.types';

describe('ExportExecutor', () => {
  let mockDbAdapter: jest.Mocked<DatabaseAdapter>;
  let executor: ExportExecutor;

  const baseSpec: DataSpecDefinition = {
    version: '1.0',
    metadata: {
      name: 'Test Spec',
      entity: 'users'
    },
    database: {
      table: 'users',
      primaryKey: 'id'
    },
    columns: [
      {
        name: 'id',
        source: 'id',
        type: DataType.UUID,
        required: true,
        sensitivity: SensitivityLevel.INTERNAL
      },
      {
        name: 'name',
        source: 'name',
        type: DataType.STRING,
        required: true,
        sensitivity: SensitivityLevel.PUBLIC
      },
      {
        name: 'email',
        source: 'email',
        type: DataType.STRING,
        required: true,
        sensitivity: SensitivityLevel.CONFIDENTIAL,
        masking: {
          mode: MaskingMode.FULL
        }
      },
      {
        name: 'ssn',
        source: 'ssn',
        type: DataType.STRING,
        required: false,
        sensitivity: SensitivityLevel.SECRET,
        masking: {
          mode: MaskingMode.PARTIAL,
          partialStart: 0,
          partialEnd: 4
        }
      }
    ]
  };

  const sampleData = [
    { id: 'uuid-1', name: 'John Doe', email: 'john@example.com', ssn: '123-45-6789' },
    { id: 'uuid-2', name: 'Jane Smith', email: 'jane@example.com', ssn: '987-65-4321' }
  ];

  beforeEach(() => {
    mockDbAdapter = {
      find: jest.fn().mockResolvedValue(sampleData),
      findOne: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue({ insertedCount: 1, insertedIds: [] }),
      update: jest.fn().mockResolvedValue({ updatedCount: 1 }),
      delete: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      lookup: jest.fn().mockResolvedValue(null),
      transaction: jest.fn(),
      logOperation: jest.fn().mockResolvedValue(undefined),
      setUser: jest.fn()
    };

    executor = new ExportExecutor(mockDbAdapter);
  });

  describe('export()', () => {
    describe('CSV format', () => {
      it('should export data as CSV', async () => {
        const result = await executor.export(baseSpec, {
          format: 'csv',
          applyMasking: false,
          userRoles: ['admin']
        });

        expect(result.format).toBe('csv');
        expect(result.totalRows).toBe(2);
        expect(result.data).toContain('id,name,email,ssn');
        expect(result.data).toContain('John Doe');
      });

      it('should apply masking for non-admin users', async () => {
        const result = await executor.export(baseSpec, {
          format: 'csv',
          applyMasking: true,
          userRoles: ['user']
        });

        expect(result.maskingApplied).toBe(true);
        expect(result.data).toContain('****************'); // masked email
        expect(result.data).toContain('*******6789'); // partial masked SSN
      });

      it('should escape CSV special characters', async () => {
        mockDbAdapter.find.mockResolvedValue([
          { id: 'uuid-1', name: 'John "Johnny" Doe', email: 'john@example.com', ssn: '123-45-6789' }
        ]);

        const result = await executor.export(baseSpec, {
          format: 'csv',
          applyMasking: false,
          userRoles: ['admin']
        });

        expect(result.data).toContain('"John ""Johnny"" Doe"');
      });
    });

    describe('JSON format', () => {
      it('should export data as JSON', async () => {
        const result = await executor.export(baseSpec, {
          format: 'json',
          applyMasking: false,
          userRoles: ['admin']
        });

        expect(result.format).toBe('json');
        const data = JSON.parse(result.data);
        expect(data).toHaveLength(2);
        expect(data[0].name).toBe('John Doe');
      });

      it('should apply masking in JSON export', async () => {
        const result = await executor.export(baseSpec, {
          format: 'json',
          applyMasking: true,
          userRoles: ['user']
        });

        const data = JSON.parse(result.data);
        expect(data[0].email).toBe('****************');
      });
    });

    describe('Excel format', () => {
      it('should return Excel-compatible data structure', async () => {
        const result = await executor.export(baseSpec, {
          format: 'excel',
          applyMasking: false,
          userRoles: ['admin']
        });

        expect(result.format).toBe('excel');
        expect(result.data.headers).toEqual(['id', 'name', 'email', 'ssn']);
        expect(result.data.data).toHaveLength(2);
        expect(result.data.columnTypes).toHaveProperty('id', DataType.UUID);
      });
    });

    describe('filtering', () => {
      it('should pass filters to database query', async () => {
        await executor.export(baseSpec, {
          format: 'json',
          userRoles: ['admin'],
          filters: [
            { field: 'name', operator: 'LIKE', value: '%John%' }
          ]
        });

        expect(mockDbAdapter.find).toHaveBeenCalledWith(
          'users',
          expect.objectContaining({
            filters: [{ field: 'name', operator: 'LIKE', value: '%John%' }]
          })
        );
      });
    });

    describe('ordering', () => {
      it('should pass orderBy to database query', async () => {
        await executor.export(baseSpec, {
          format: 'json',
          userRoles: ['admin'],
          orderBy: [{ field: 'name', direction: 'asc' }]
        });

        expect(mockDbAdapter.find).toHaveBeenCalledWith(
          'users',
          expect.objectContaining({
            orderBy: [{ field: 'name', direction: 'asc' }]
          })
        );
      });
    });

    describe('pagination', () => {
      it('should apply limit and offset', async () => {
        await executor.export(baseSpec, {
          format: 'json',
          userRoles: ['admin'],
          limit: 10,
          offset: 20
        });

        expect(mockDbAdapter.find).toHaveBeenCalledWith(
          'users',
          expect.objectContaining({
            limit: 10,
            offset: 20
          })
        );
      });
    });

    describe('logging', () => {
      it('should log export operation', async () => {
        await executor.export(baseSpec, {
          format: 'json',
          userRoles: ['admin'],
          userId: 'user-123'
        });

        expect(mockDbAdapter.logOperation).toHaveBeenCalledWith(
          expect.objectContaining({
            operationType: 'export',
            entity: 'users',
            userId: 'user-123',
            totalRecords: 2
          })
        );
      });
    });
  });

  describe('preview()', () => {
    it('should preview first N rows', async () => {
      mockDbAdapter.find.mockResolvedValueOnce([{ count: 100 }]); // count query
      mockDbAdapter.find.mockResolvedValueOnce(sampleData.slice(0, 1)); // data query

      const result = await executor.preview(baseSpec, { format: 'json', userRoles: ['user'] }, 1);

      expect(result.rows).toHaveLength(1);
      expect(result.totalCount).toBe(100);
    });

    it('should identify columns that will be masked', async () => {
      mockDbAdapter.find.mockResolvedValueOnce([{ count: 10 }]);
      mockDbAdapter.find.mockResolvedValueOnce(sampleData);

      const result = await executor.preview(baseSpec, { format: 'json', userRoles: ['user'] }, 10);

      expect(result.columnsToMask).toContain('email');
      expect(result.columnsToMask).toContain('ssn');
      expect(result.columnsToMask).not.toContain('name');
    });
  });

  describe('getExportCount()', () => {
    it('should return total count of exportable records', async () => {
      mockDbAdapter.find.mockResolvedValue([{ count: 1000 }]);

      const count = await executor.getExportCount(baseSpec, { format: 'json', userRoles: ['admin'] });

      expect(count).toBe(1000);
    });

    it('should apply filters to count query', async () => {
      mockDbAdapter.find.mockResolvedValue([{ count: 50 }]);

      await executor.getExportCount(baseSpec, {
        format: 'json',
        userRoles: ['admin'],
        filters: [{ field: 'status', operator: '=', value: 'active' }]
      });

      expect(mockDbAdapter.find).toHaveBeenCalledWith(
        'users',
        expect.objectContaining({
          filters: [{ field: 'status', operator: '=', value: 'active' }]
        })
      );
    });
  });

  describe('exportStream()', () => {
    it('should stream CSV data', async () => {
      mockDbAdapter.find
        .mockResolvedValueOnce(sampleData)
        .mockResolvedValueOnce([]); // Empty batch to end stream

      const chunks: string[] = [];
      for await (const chunk of executor.exportStream(baseSpec, { format: 'csv', userRoles: ['admin'] }, 10)) {
        chunks.push(chunk);
      }

      expect(chunks[0]).toContain('id,name,email,ssn'); // headers
      expect(chunks.some(c => c.includes('John Doe'))).toBe(true);
    });

    it('should stream JSON data', async () => {
      mockDbAdapter.find
        .mockResolvedValueOnce(sampleData)
        .mockResolvedValueOnce([]);

      const chunks: string[] = [];
      for await (const chunk of executor.exportStream(baseSpec, { format: 'json', userRoles: ['admin'] }, 10)) {
        chunks.push(chunk);
      }

      const json = chunks.join('');
      expect(json.startsWith('[')).toBe(true);
      expect(json.endsWith(']')).toBe(true);
      const data = JSON.parse(json);
      expect(data).toHaveLength(2);
    });

    it('should apply masking in stream', async () => {
      mockDbAdapter.find
        .mockResolvedValueOnce(sampleData)
        .mockResolvedValueOnce([]);

      const chunks: string[] = [];
      for await (const chunk of executor.exportStream(
        baseSpec,
        { format: 'csv', applyMasking: true, userRoles: ['user'] },
        10
      )) {
        chunks.push(chunk);
      }

      const content = chunks.join('');
      expect(content).toContain('****************'); // masked email
    });

    it('should handle multiple batches', async () => {
      const batch1 = [{ id: 'uuid-1', name: 'User 1', email: 'u1@test.com', ssn: '111-11-1111' }];
      const batch2 = [{ id: 'uuid-2', name: 'User 2', email: 'u2@test.com', ssn: '222-22-2222' }];

      mockDbAdapter.find
        .mockResolvedValueOnce(batch1)
        .mockResolvedValueOnce(batch2)
        .mockResolvedValueOnce([]);

      const chunks: string[] = [];
      for await (const chunk of executor.exportStream(baseSpec, { format: 'csv', userRoles: ['admin'] }, 1)) {
        chunks.push(chunk);
      }

      const content = chunks.join('');
      expect(content).toContain('User 1');
      expect(content).toContain('User 2');
    });
  });

  describe('column selection', () => {
    it('should only include spec columns in export', async () => {
      mockDbAdapter.find.mockResolvedValue([
        { id: 'uuid-1', name: 'John', email: 'john@test.com', ssn: '123-45-6789', extra_field: 'ignored' }
      ]);

      const result = await executor.export(baseSpec, {
        format: 'json',
        userRoles: ['admin'],
        applyMasking: false
      });

      const data = JSON.parse(result.data);
      expect(data[0]).not.toHaveProperty('extra_field');
    });

    it('should include audit fields when requested', async () => {
      mockDbAdapter.find.mockResolvedValue([
        {
          id: 'uuid-1',
          name: 'John',
          email: 'john@test.com',
          ssn: '123-45-6789',
          created_at: '2023-01-01',
          updated_at: '2023-01-02'
        }
      ]);

      const result = await executor.export(baseSpec, {
        format: 'json',
        userRoles: ['admin'],
        includeAuditFields: true,
        applyMasking: false
      });

      const data = JSON.parse(result.data);
      expect(data[0]).toHaveProperty('created_at');
      expect(data[0]).toHaveProperty('updated_at');
    });
  });

  describe('masking behavior', () => {
    it('should not mask for admin users', async () => {
      const result = await executor.export(baseSpec, {
        format: 'json',
        applyMasking: true,
        userRoles: ['admin']
      });

      const data = JSON.parse(result.data);
      expect(data[0].email).toBe('john@example.com');
      expect(data[0].ssn).toBe('123-45-6789');
    });

    it('should not mask when applyMasking is false', async () => {
      const result = await executor.export(baseSpec, {
        format: 'json',
        applyMasking: false,
        userRoles: ['user']
      });

      const data = JSON.parse(result.data);
      expect(data[0].email).toBe('john@example.com');
    });

    it('should use spec exportOptions masking setting by default', async () => {
      const specWithExportOptions: DataSpecDefinition = {
        ...baseSpec,
        exportOptions: {
          applyMasking: true,
          includeAuditFields: false,
          format: 'csv'
        }
      };

      const result = await executor.export(specWithExportOptions, {
        format: 'json',
        userRoles: ['user']
        // applyMasking not specified - should use spec default
      });

      const data = JSON.parse(result.data);
      expect(data[0].email).toBe('****************');
    });
  });

  describe('getMaskingEngine()', () => {
    it('should return masking engine for configuration', () => {
      const maskingEngine = executor.getMaskingEngine();
      expect(maskingEngine).toBeDefined();
      expect(typeof maskingEngine.mask).toBe('function');
    });
  });

  describe('error handling', () => {
    it('should throw error for unsupported format', async () => {
      await expect(
        executor.export(baseSpec, {
          format: 'xml' as any,
          userRoles: ['admin']
        })
      ).rejects.toThrow('Unsupported export format');
    });
  });
});
