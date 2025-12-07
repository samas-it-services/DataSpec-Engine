/**
 * MaskingEngine Unit Tests
 */

import { MaskingEngine, MaskingError } from '../masking/MaskingEngine';
import { MaskingMode, SensitivityLevel, DataType, ColumnMapping } from '../types/spec.types';

describe('MaskingEngine', () => {
  let engine: MaskingEngine;

  beforeEach(() => {
    engine = new MaskingEngine();
  });

  describe('mask()', () => {
    describe('full masking', () => {
      it('should mask entire value', () => {
        const result = engine.mask(
          'secret',
          { mode: MaskingMode.FULL },
          'test'
        );
        expect(result).toBe('******');
      });

      it('should use custom replacement character', () => {
        const result = engine.mask(
          'secret',
          { mode: MaskingMode.FULL, replacement: '#' },
          'test'
        );
        expect(result).toBe('######');
      });

      it('should handle numbers', () => {
        const result = engine.mask(
          12345,
          { mode: MaskingMode.FULL },
          'test'
        );
        expect(result).toBe('*****');
      });
    });

    describe('partial masking', () => {
      it('should mask middle portion by default', () => {
        const result = engine.mask(
          '1234567890',
          { mode: MaskingMode.PARTIAL, partialStart: 0, partialEnd: 4 },
          'test'
        );
        expect(result).toBe('******7890');
      });

      it('should show first and last characters', () => {
        const result = engine.mask(
          '1234567890',
          { mode: MaskingMode.PARTIAL, partialStart: 2, partialEnd: 2 },
          'test'
        );
        expect(result).toBe('12******90');
      });

      it('should apply full masking if start+end >= length', () => {
        const result = engine.mask(
          'short',
          { mode: MaskingMode.PARTIAL, partialStart: 3, partialEnd: 3 },
          'test'
        );
        expect(result).toBe('*****');
      });

      it('should handle credit card numbers', () => {
        const result = engine.mask(
          '4111111111111111',
          { mode: MaskingMode.PARTIAL, partialStart: 0, partialEnd: 4 },
          'card'
        );
        expect(result).toBe('************1111');
      });
    });

    describe('regex masking', () => {
      it('should mask matched portions', () => {
        const result = engine.mask(
          'test@example.com',
          { mode: MaskingMode.REGEX, regexPattern: '[a-z]+(?=@)' },
          'email'
        );
        expect(result).toBe('****@example.com');
      });

      it('should throw error without regex pattern', () => {
        expect(() => {
          engine.mask(
            'test',
            { mode: MaskingMode.REGEX },
            'test'
          );
        }).toThrow(MaskingError);
      });
    });

    describe('custom masking', () => {
      it('should execute custom script', () => {
        const result = engine.mask(
          'hello',
          {
            mode: MaskingMode.CUSTOM,
            customScript: 'return value.charAt(0) + maskChar.repeat(value.length - 1);'
          },
          'test'
        );
        expect(result).toBe('h****');
      });

      it('should throw error without custom script', () => {
        expect(() => {
          engine.mask(
            'test',
            { mode: MaskingMode.CUSTOM },
            'test'
          );
        }).toThrow(MaskingError);
      });

      it('should throw error for invalid script', () => {
        expect(() => {
          engine.mask(
            'test',
            { mode: MaskingMode.CUSTOM, customScript: 'invalid {' },
            'test'
          );
        }).toThrow(MaskingError);
      });
    });

    describe('null handling', () => {
      it('should return null for null input', () => {
        const result = engine.mask(
          null,
          { mode: MaskingMode.FULL },
          'test'
        );
        expect(result).toBeNull();
      });

      it('should return undefined for undefined input', () => {
        const result = engine.mask(
          undefined,
          { mode: MaskingMode.FULL },
          'test'
        );
        expect(result).toBeUndefined();
      });
    });
  });

  describe('canAccess()', () => {
    it('should allow admin access to all levels', () => {
      expect(engine.canAccess(['admin'], SensitivityLevel.PUBLIC)).toBe(true);
      expect(engine.canAccess(['admin'], SensitivityLevel.INTERNAL)).toBe(true);
      expect(engine.canAccess(['admin'], SensitivityLevel.CONFIDENTIAL)).toBe(true);
      expect(engine.canAccess(['admin'], SensitivityLevel.SECRET)).toBe(true);
      expect(engine.canAccess(['admin'], SensitivityLevel.HIGHLY_RESTRICTED)).toBe(true);
    });

    it('should limit user access to public and internal', () => {
      expect(engine.canAccess(['user'], SensitivityLevel.PUBLIC)).toBe(true);
      expect(engine.canAccess(['user'], SensitivityLevel.INTERNAL)).toBe(true);
      expect(engine.canAccess(['user'], SensitivityLevel.CONFIDENTIAL)).toBe(false);
      expect(engine.canAccess(['user'], SensitivityLevel.SECRET)).toBe(false);
    });

    it('should limit guest access to public only', () => {
      expect(engine.canAccess(['guest'], SensitivityLevel.PUBLIC)).toBe(true);
      expect(engine.canAccess(['guest'], SensitivityLevel.INTERNAL)).toBe(false);
    });

    it('should check multiple roles', () => {
      expect(engine.canAccess(['guest', 'user'], SensitivityLevel.INTERNAL)).toBe(true);
    });

    it('should return false for unknown roles', () => {
      expect(engine.canAccess(['unknown'], SensitivityLevel.PUBLIC)).toBe(false);
    });
  });

  describe('canUnmask()', () => {
    const createColumn = (overrides: Partial<ColumnMapping> = {}): ColumnMapping => ({
      name: 'test',
      source: 'test',
      type: DataType.STRING,
      required: false,
      sensitivity: SensitivityLevel.CONFIDENTIAL,
      masking: { mode: MaskingMode.FULL },
      ...overrides
    });

    it('should allow unmask without masking config', () => {
      const column = createColumn({ masking: undefined });
      expect(engine.canUnmask(['user'], column)).toBe(true);
    });

    it('should check unmaskPermissions if specified', () => {
      const column = createColumn({ unmaskPermissions: ['special_role'] });
      expect(engine.canUnmask(['user'], column)).toBe(false);
      expect(engine.canUnmask(['special_role'], column)).toBe(true);
    });

    it('should fall back to sensitivity check if no unmaskPermissions', () => {
      const column = createColumn({ sensitivity: SensitivityLevel.INTERNAL });
      expect(engine.canUnmask(['user'], column)).toBe(true);

      const secretColumn = createColumn({ sensitivity: SensitivityLevel.SECRET });
      expect(engine.canUnmask(['user'], secretColumn)).toBe(false);
    });
  });

  describe('maskField()', () => {
    const createColumn = (overrides: Partial<ColumnMapping> = {}): ColumnMapping => ({
      name: 'test',
      source: 'test',
      type: DataType.STRING,
      required: false,
      sensitivity: SensitivityLevel.CONFIDENTIAL,
      masking: { mode: MaskingMode.FULL },
      ...overrides
    });

    it('should mask field for users without access', () => {
      const column = createColumn();
      const result = engine.maskField('secret', column, ['user']);

      expect(result.wasMasked).toBe(true);
      expect(result.maskedValue).toBe('******');
      expect(result.originalValue).toBe('secret');
    });

    it('should not mask field for users with access', () => {
      const column = createColumn();
      const result = engine.maskField('secret', column, ['admin']);

      expect(result.wasMasked).toBe(false);
      expect(result.maskedValue).toBe('secret');
    });

    it('should not mask field without masking config', () => {
      const column = createColumn({ masking: undefined });
      const result = engine.maskField('secret', column, ['user']);

      expect(result.wasMasked).toBe(false);
      expect(result.maskedValue).toBe('secret');
    });
  });

  describe('maskRow()', () => {
    it('should mask multiple fields in a row', () => {
      const columns: ColumnMapping[] = [
        {
          name: 'name',
          source: 'name',
          type: DataType.STRING,
          required: true,
          sensitivity: SensitivityLevel.PUBLIC
        },
        {
          name: 'ssn',
          source: 'ssn',
          type: DataType.STRING,
          required: false,
          sensitivity: SensitivityLevel.SECRET,
          masking: { mode: MaskingMode.PARTIAL, partialStart: 0, partialEnd: 4 }
        },
        {
          name: 'email',
          source: 'email',
          type: DataType.STRING,
          required: false,
          sensitivity: SensitivityLevel.CONFIDENTIAL,
          masking: { mode: MaskingMode.FULL }
        }
      ];

      const row = {
        name: 'John Doe',
        ssn: '123-45-6789',
        email: 'john@example.com'
      };

      const { maskedRow, results } = engine.maskRow(row, columns, ['user']);

      expect(maskedRow.name).toBe('John Doe'); // Public - not masked
      expect(maskedRow.ssn).toBe('*******6789'); // Secret - masked
      expect(maskedRow.email).toBe('****************'); // Confidential - masked

      expect(results.filter(r => r.wasMasked)).toHaveLength(2);
    });
  });

  describe('maskDataset()', () => {
    it('should mask all rows in dataset', () => {
      const columns: ColumnMapping[] = [
        {
          name: 'name',
          source: 'name',
          type: DataType.STRING,
          required: true,
          sensitivity: SensitivityLevel.CONFIDENTIAL,
          masking: { mode: MaskingMode.FULL }
        }
      ];

      const rows = [
        { name: 'John' },
        { name: 'Jane' },
        { name: 'Bob' }
      ];

      const { maskedRows, totalMasked } = engine.maskDataset(rows, columns, ['user']);

      expect(maskedRows).toHaveLength(3);
      expect(maskedRows[0].name).toBe('****');
      expect(maskedRows[1].name).toBe('****');
      expect(maskedRows[2].name).toBe('***');
      expect(totalMasked).toBe(3);
    });
  });

  describe('unmask()', () => {
    const createColumn = (overrides: Partial<ColumnMapping> = {}): ColumnMapping => ({
      name: 'test',
      source: 'test',
      type: DataType.STRING,
      required: false,
      sensitivity: SensitivityLevel.CONFIDENTIAL,
      masking: { mode: MaskingMode.FULL },
      ...overrides
    });

    it('should unmask if original value provided and user has permission', () => {
      const column = createColumn();
      const result = engine.unmask(
        { field: 'test', maskedValue: '******', column },
        ['admin'],
        'secret'
      );

      expect(result.success).toBe(true);
      expect(result.value).toBe('secret');
    });

    it('should fail if user lacks permission', () => {
      const column = createColumn();
      const result = engine.unmask(
        { field: 'test', maskedValue: '******', column },
        ['user'],
        'secret'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient permissions');
    });

    it('should fail if original value not provided', () => {
      const column = createColumn();
      const result = engine.unmask(
        { field: 'test', maskedValue: '******', column },
        ['admin']
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Original value not available');
    });
  });

  describe('getFieldsToMask()', () => {
    it('should return fields that need masking for given roles', () => {
      const columns: ColumnMapping[] = [
        {
          name: 'public_field',
          source: 'public_field',
          type: DataType.STRING,
          required: false,
          sensitivity: SensitivityLevel.PUBLIC
        },
        {
          name: 'confidential_field',
          source: 'confidential_field',
          type: DataType.STRING,
          required: false,
          sensitivity: SensitivityLevel.CONFIDENTIAL,
          masking: { mode: MaskingMode.FULL }
        },
        {
          name: 'secret_field',
          source: 'secret_field',
          type: DataType.STRING,
          required: false,
          sensitivity: SensitivityLevel.SECRET,
          masking: { mode: MaskingMode.FULL }
        }
      ];

      const fieldsToMask = engine.getFieldsToMask(columns, ['user']);

      expect(fieldsToMask).toHaveLength(2);
      expect(fieldsToMask.map(f => f.name)).toContain('confidential_field');
      expect(fieldsToMask.map(f => f.name)).toContain('secret_field');
    });
  });

  describe('role configuration', () => {
    it('should allow custom role configuration', () => {
      const customEngine = new MaskingEngine({
        roleConfig: {
          viewer: [SensitivityLevel.PUBLIC],
          editor: [SensitivityLevel.PUBLIC, SensitivityLevel.INTERNAL, SensitivityLevel.CONFIDENTIAL]
        }
      });

      expect(customEngine.canAccess(['viewer'], SensitivityLevel.INTERNAL)).toBe(false);
      expect(customEngine.canAccess(['editor'], SensitivityLevel.CONFIDENTIAL)).toBe(true);
    });

    it('should allow updating role config', () => {
      engine.setRoleConfig({
        custom: [SensitivityLevel.SECRET]
      });

      expect(engine.canAccess(['custom'], SensitivityLevel.SECRET)).toBe(true);
      expect(engine.canAccess(['admin'], SensitivityLevel.PUBLIC)).toBe(false);
    });

    it('should allow setting single role access', () => {
      engine.setRoleAccess('special', [
        SensitivityLevel.PUBLIC,
        SensitivityLevel.HIGHLY_RESTRICTED
      ]);

      expect(engine.canAccess(['special'], SensitivityLevel.HIGHLY_RESTRICTED)).toBe(true);
      expect(engine.getRoleAccess('special')).toContain(SensitivityLevel.HIGHLY_RESTRICTED);
    });
  });

  describe('createMaskingConfig()', () => {
    it('should create email masking config', () => {
      const config = MaskingEngine.createMaskingConfig('email');
      expect(config.mode).toBe(MaskingMode.REGEX);
      expect(config.regexPattern).toBeDefined();
    });

    it('should create phone masking config', () => {
      const config = MaskingEngine.createMaskingConfig('phone');
      expect(config.mode).toBe(MaskingMode.PARTIAL);
      expect(config.partialEnd).toBe(4);
    });

    it('should create SSN masking config', () => {
      const config = MaskingEngine.createMaskingConfig('ssn');
      expect(config.mode).toBe(MaskingMode.PARTIAL);
      expect(config.partialEnd).toBe(4);
    });

    it('should create credit card masking config', () => {
      const config = MaskingEngine.createMaskingConfig('creditCard');
      expect(config.mode).toBe(MaskingMode.PARTIAL);
      expect(config.partialEnd).toBe(4);
    });

    it('should create name masking config', () => {
      const config = MaskingEngine.createMaskingConfig('name');
      expect(config.mode).toBe(MaskingMode.PARTIAL);
      expect(config.partialStart).toBe(1);
    });
  });
});
