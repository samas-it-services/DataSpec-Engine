/**
 * ImportExecutor Unit Tests
 */

import { ImportExecutor } from '../executor/ImportExecutor';
import {
  DataSpecDefinition,
  DataType,
  SensitivityLevel,
  ValidationType,
  TransformationType,
  LookupFallback,
  DuplicateStrategy
} from '../types/spec.types';
import { OperationStatus, RowOperation, DatabaseAdapter } from '../types/execution.types';

describe('ImportExecutor', () => {
  let mockDbAdapter: jest.Mocked<DatabaseAdapter>;
  let executor: ImportExecutor;

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
        validation: [
          { type: ValidationType.EMAIL }
        ]
      }
    ]
  };

  beforeEach(() => {
    mockDbAdapter = {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      insert: jest.fn().mockResolvedValue({ insertedCount: 1, insertedIds: ['new-id'] }),
      update: jest.fn().mockResolvedValue({ updatedCount: 1 }),
      delete: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      lookup: jest.fn().mockResolvedValue(null),
      transaction: jest.fn(),
      logOperation: jest.fn().mockResolvedValue(undefined),
      setUser: jest.fn()
    };

    executor = new ImportExecutor(mockDbAdapter);
  });

  describe('preview()', () => {
    it('should preview import without database writes', async () => {
      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John', email: 'john@example.com' },
        { id: '550e8400-e29b-41d4-a716-446655440001', name: 'Jane', email: 'jane@example.com' }
      ];

      const result = await executor.preview(baseSpec, rows, {});

      expect(result.totalRows).toBe(2);
      expect(result.summary.valid).toBe(2);
      expect(result.summary.invalid).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(mockDbAdapter.insert).not.toHaveBeenCalled();
    });

    it('should detect validation errors', async () => {
      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John', email: 'invalid-email' }
      ];

      const result = await executor.preview(baseSpec, rows, {});

      expect(result.summary.invalid).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].rule).toBe('email');
    });

    it('should detect missing required fields', async () => {
      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', email: 'john@example.com' } // missing name
      ];

      const result = await executor.preview(baseSpec, rows, {});

      expect(result.summary.invalid).toBe(1);
      expect(result.errors.some(e => e.rule === 'required')).toBe(true);
    });
  });

  describe('import()', () => {
    it('should insert new records', async () => {
      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John', email: 'john@example.com' }
      ];

      const result = await executor.import(baseSpec, rows, {});

      expect(result.summary.successful).toBe(1);
      expect(result.summary.inserts).toBe(1);
      expect(mockDbAdapter.insert).toHaveBeenCalled();
      expect(mockDbAdapter.logOperation).toHaveBeenCalled();
    });

    it('should handle duplicate strategy SKIP', async () => {
      mockDbAdapter.findOne.mockResolvedValue({ id: 'existing-id', name: 'Existing' });

      const spec = {
        ...baseSpec,
        importOptions: {
          duplicateStrategy: DuplicateStrategy.SKIP,
          batchSize: 100,
          validateForeignKeys: false,
          autoGenerateIds: false
        }
      };

      const rows = [
        { id: 'existing-id', name: 'John', email: 'john@example.com' }
      ];

      const result = await executor.import(spec, rows, {});

      expect(result.summary.skipped).toBe(1);
      expect(result.summary.inserts).toBe(0);
    });

    it('should handle duplicate strategy UPDATE', async () => {
      mockDbAdapter.findOne.mockResolvedValue({ id: 'existing-id', name: 'Old Name' });

      const spec = {
        ...baseSpec,
        importOptions: {
          duplicateStrategy: DuplicateStrategy.UPDATE,
          batchSize: 100,
          validateForeignKeys: false,
          autoGenerateIds: false
        }
      };

      const rows = [
        { id: 'existing-id', name: 'New Name', email: 'new@example.com' }
      ];

      const result = await executor.import(spec, rows, {});

      expect(result.summary.updates).toBe(1);
      expect(mockDbAdapter.update).toHaveBeenCalled();
    });

    it('should handle duplicate strategy ERROR', async () => {
      mockDbAdapter.findOne.mockResolvedValue({ id: 'existing-id', name: 'Existing' });

      const spec = {
        ...baseSpec,
        importOptions: {
          duplicateStrategy: DuplicateStrategy.ERROR,
          batchSize: 100,
          validateForeignKeys: false,
          autoGenerateIds: false
        }
      };

      const rows = [
        { id: 'existing-id', name: 'John', email: 'john@example.com' }
      ];

      const result = await executor.import(spec, rows, {});

      expect(result.errors.some(e => e.rule === 'duplicate')).toBe(true);
    });
  });

  describe('transformations', () => {
    it('should apply field transformations', async () => {
      const specWithTransform: DataSpecDefinition = {
        ...baseSpec,
        columns: [
          ...baseSpec.columns,
          {
            name: 'normalized_name',
            source: 'name',
            type: DataType.STRING,
            required: false,
            sensitivity: SensitivityLevel.PUBLIC,
            transform: [
              { type: TransformationType.TRIM },
              { type: TransformationType.UPPERCASE }
            ]
          }
        ]
      };

      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: '  john  ', email: 'john@example.com' }
      ];

      const result = await executor.preview(specWithTransform, rows, {});

      expect(result.processedRows[0].transformedRow?.normalized_name).toBe('JOHN');
    });

    it('should apply default values', async () => {
      const specWithDefault: DataSpecDefinition = {
        ...baseSpec,
        columns: [
          ...baseSpec.columns,
          {
            name: 'status',
            source: 'status',
            type: DataType.STRING,
            required: false,
            sensitivity: SensitivityLevel.PUBLIC,
            default: 'active'
          }
        ]
      };

      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John', email: 'john@example.com' }
      ];

      const result = await executor.preview(specWithDefault, rows, {});

      expect(result.processedRows[0].transformedRow?.status).toBe('active');
    });
  });

  describe('lookups', () => {
    it('should resolve lookup fields', async () => {
      mockDbAdapter.lookup.mockResolvedValue({ id: 'dept-123', name: 'Engineering' });

      const specWithLookup: DataSpecDefinition = {
        ...baseSpec,
        columns: [
          ...baseSpec.columns,
          {
            name: 'department_id',
            source: 'department_name',
            type: DataType.UUID,
            required: false,
            sensitivity: SensitivityLevel.INTERNAL,
            lookup: {
              table: 'departments',
              key: 'name',
              fallback: LookupFallback.NULL
            }
          }
        ]
      };

      const rows = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
          department_name: 'Engineering'
        }
      ];

      const result = await executor.preview(specWithLookup, rows, {});

      expect(result.processedRows[0].lookupResults).toBeDefined();
      expect(result.processedRows[0].lookupResults?.length).toBeGreaterThan(0);
    });

    it('should handle failed lookups with ERROR fallback', async () => {
      mockDbAdapter.lookup.mockResolvedValue(null);

      const specWithLookup: DataSpecDefinition = {
        ...baseSpec,
        columns: [
          ...baseSpec.columns,
          {
            name: 'department_id',
            source: 'department_name',
            type: DataType.UUID,
            required: false,
            sensitivity: SensitivityLevel.INTERNAL,
            lookup: {
              table: 'departments',
              key: 'name',
              fallback: LookupFallback.ERROR
            }
          }
        ]
      };

      const rows = [
        {
          id: '550e8400-e29b-41d4-a716-446655440000',
          name: 'John',
          email: 'john@example.com',
          department_name: 'NonExistent'
        }
      ];

      const result = await executor.preview(specWithLookup, rows, {});

      expect(result.processedRows[0].status).toBe(OperationStatus.ERROR);
    });
  });

  describe('hooks', () => {
    it('should execute beforeValidateRow hooks', async () => {
      const specWithHooks: DataSpecDefinition = {
        ...baseSpec,
        hooks: {
          beforeValidateRow: [
            {
              name: 'addField',
              script: 'return { success: true, modifiedValue: { ...row, added: "hook-value" } };'
            }
          ]
        }
      };

      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John', email: 'john@example.com' }
      ];

      const result = await executor.preview(specWithHooks, rows, {});

      expect(result.summary.valid).toBe(1);
    });

    it('should skip row when hook sets stopProcessing', async () => {
      const specWithHooks: DataSpecDefinition = {
        ...baseSpec,
        hooks: {
          beforeValidateRow: [
            {
              name: 'skipper',
              script: 'return { success: true, stopProcessing: true };'
            }
          ]
        }
      };

      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John', email: 'john@example.com' }
      ];

      const result = await executor.preview(specWithHooks, rows, {});

      expect(result.processedRows[0].operation).toBe(RowOperation.SKIP);
    });
  });

  describe('validation rules', () => {
    it('should validate UUID format', async () => {
      const specWithUuid: DataSpecDefinition = {
        ...baseSpec,
        columns: baseSpec.columns.map(c =>
          c.name === 'id'
            ? { ...c, validation: [{ type: ValidationType.UUID }] }
            : c
        )
      };

      const rows = [
        { id: 'invalid-uuid', name: 'John', email: 'john@example.com' }
      ];

      const result = await executor.preview(specWithUuid, rows, {});

      expect(result.summary.invalid).toBe(1);
      expect(result.errors.some(e => e.rule === 'uuid')).toBe(true);
    });

    it('should validate range', async () => {
      const specWithRange: DataSpecDefinition = {
        ...baseSpec,
        columns: [
          ...baseSpec.columns,
          {
            name: 'age',
            source: 'age',
            type: DataType.INTEGER,
            required: false,
            sensitivity: SensitivityLevel.PUBLIC,
            validation: [
              { type: ValidationType.RANGE, min: 0, max: 120 }
            ]
          }
        ]
      };

      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John', email: 'john@example.com', age: 150 }
      ];

      const result = await executor.preview(specWithRange, rows, {});

      expect(result.errors.some(e => e.rule === 'range')).toBe(true);
    });

    it('should validate length', async () => {
      const specWithLength: DataSpecDefinition = {
        ...baseSpec,
        columns: baseSpec.columns.map(c =>
          c.name === 'name'
            ? {
                ...c,
                validation: [{ type: ValidationType.LENGTH, min: 2, max: 50 }]
              }
            : c
        )
      };

      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'J', email: 'john@example.com' }
      ];

      const result = await executor.preview(specWithLength, rows, {});

      expect(result.errors.some(e => e.rule === 'length')).toBe(true);
    });

    it('should validate enum values', async () => {
      const specWithEnum: DataSpecDefinition = {
        ...baseSpec,
        columns: [
          ...baseSpec.columns,
          {
            name: 'status',
            source: 'status',
            type: DataType.STRING,
            required: false,
            sensitivity: SensitivityLevel.PUBLIC,
            validation: [
              { type: ValidationType.ENUM, values: ['active', 'inactive', 'pending'] }
            ]
          }
        ]
      };

      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John', email: 'john@example.com', status: 'invalid' }
      ];

      const result = await executor.preview(specWithEnum, rows, {});

      expect(result.errors.some(e => e.rule === 'enum')).toBe(true);
    });

    it('should validate regex pattern', async () => {
      const specWithRegex: DataSpecDefinition = {
        ...baseSpec,
        columns: [
          ...baseSpec.columns,
          {
            name: 'phone',
            source: 'phone',
            type: DataType.STRING,
            required: false,
            sensitivity: SensitivityLevel.CONFIDENTIAL,
            validation: [
              { type: ValidationType.REGEX, pattern: '^\\d{3}-\\d{3}-\\d{4}$' }
            ]
          }
        ]
      };

      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John', email: 'john@example.com', phone: '123456' }
      ];

      const result = await executor.preview(specWithRegex, rows, {});

      expect(result.errors.some(e => e.rule === 'regex')).toBe(true);
    });
  });

  describe('batching', () => {
    it('should process rows in batches', async () => {
      const rows = Array.from({ length: 250 }, (_, i) => ({
        id: `550e8400-e29b-41d4-a716-4466554400${String(i).padStart(2, '0')}`,
        name: `User ${i}`,
        email: `user${i}@example.com`
      }));

      const result = await executor.preview(baseSpec, rows, { batchSize: 50 });

      expect(result.totalRows).toBe(250);
      expect(result.processedRows).toHaveLength(250);
    });
  });

  describe('statistics', () => {
    it('should return lookup statistics', async () => {
      const stats = executor.getLookupStats();
      expect(stats).toHaveProperty('totalLookups');
      expect(stats).toHaveProperty('cacheHits');
    });

    it('should return hook statistics', async () => {
      const stats = executor.getHookStats();
      expect(stats).toHaveProperty('totalExecutions');
    });

    it('should clear caches', () => {
      expect(() => executor.clearCaches()).not.toThrow();
    });

    it('should reset statistics', () => {
      expect(() => executor.resetStats()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDbAdapter.insert.mockRejectedValue(new Error('Database error'));

      const rows = [
        { id: '550e8400-e29b-41d4-a716-446655440000', name: 'John', email: 'john@example.com' }
      ];

      const result = await executor.import(baseSpec, rows, {});

      expect(result.summary.failed).toBe(1);
      expect(result.processedRows[0].status).toBe(OperationStatus.ERROR);
    });
  });
});
