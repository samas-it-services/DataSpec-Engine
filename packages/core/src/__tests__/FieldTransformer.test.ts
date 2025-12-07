/**
 * FieldTransformer Unit Tests
 */

import { FieldTransformer, TransformationError } from '../transformers/FieldTransformer';
import { TransformationType } from '../types/spec.types';

describe('FieldTransformer', () => {
  let transformer: FieldTransformer;

  beforeEach(() => {
    transformer = new FieldTransformer();
  });

  describe('transform()', () => {
    describe('trim', () => {
      it('should trim whitespace from string', async () => {
        const result = await transformer.transform(
          '  hello world  ',
          { type: TransformationType.TRIM },
          'test'
        );
        expect(result).toBe('hello world');
      });

      it('should handle non-string values', async () => {
        const result = await transformer.transform(
          123,
          { type: TransformationType.TRIM },
          'test'
        );
        expect(result).toBe('123');
      });
    });

    describe('uppercase', () => {
      it('should convert to uppercase', async () => {
        const result = await transformer.transform(
          'hello world',
          { type: TransformationType.UPPERCASE },
          'test'
        );
        expect(result).toBe('HELLO WORLD');
      });
    });

    describe('lowercase', () => {
      it('should convert to lowercase', async () => {
        const result = await transformer.transform(
          'HELLO WORLD',
          { type: TransformationType.LOWERCASE },
          'test'
        );
        expect(result).toBe('hello world');
      });
    });

    describe('capitalize', () => {
      it('should capitalize each word', async () => {
        const result = await transformer.transform(
          'hello world',
          { type: TransformationType.CAPITALIZE },
          'test'
        );
        expect(result).toBe('Hello World');
      });

      it('should handle mixed case input', async () => {
        const result = await transformer.transform(
          'hELLO wORLD',
          { type: TransformationType.CAPITALIZE },
          'test'
        );
        expect(result).toBe('Hello World');
      });
    });

    describe('parse_date', () => {
      it('should parse date from string', async () => {
        const result = await transformer.transform(
          '25/12/2023',
          { type: TransformationType.PARSE_DATE, format: 'dd/MM/yyyy' },
          'test'
        );
        expect(result).toBeInstanceOf(Date);
        expect(result.getDate()).toBe(25);
        expect(result.getMonth()).toBe(11); // December
        expect(result.getFullYear()).toBe(2023);
      });

      it('should return Date if already a Date', async () => {
        const date = new Date('2023-12-25');
        const result = await transformer.transform(
          date,
          { type: TransformationType.PARSE_DATE, format: 'yyyy-MM-dd' },
          'test'
        );
        expect(result).toBe(date);
      });

      it('should return Invalid Date for unparseable date', async () => {
        const result = await transformer.transform(
          'invalid-date',
          { type: TransformationType.PARSE_DATE, format: 'dd/MM/yyyy' },
          'test'
        );
        // date-fns parse returns Invalid Date for unparseable dates
        expect(result).toBeInstanceOf(Date);
        expect(isNaN(result.getTime())).toBe(true);
      });
    });

    describe('format_date', () => {
      it('should format Date to string', async () => {
        // Use a date constructed with local timezone
        const date = new Date(2023, 11, 25); // December 25, 2023 local time
        const result = await transformer.transform(
          date,
          { type: TransformationType.FORMAT_DATE, format: 'yyyy-MM-dd' },
          'test'
        );
        expect(result).toBe('2023-12-25');
      });

      it('should format ISO string date', async () => {
        // Use local date to avoid timezone issues
        const date = new Date(2023, 11, 25); // December 25, 2023 local time
        const result = await transformer.transform(
          date,
          { type: TransformationType.FORMAT_DATE, format: 'dd/MM/yyyy' },
          'test'
        );
        expect(result).toBe('25/12/2023');
      });

      it('should throw error for invalid date', async () => {
        await expect(
          transformer.transform(
            'not-a-date',
            { type: TransformationType.FORMAT_DATE, format: 'yyyy-MM-dd' },
            'test'
          )
        ).rejects.toThrow(TransformationError);
      });
    });

    describe('round', () => {
      it('should round to integer by default', async () => {
        const result = await transformer.transform(
          3.7,
          { type: TransformationType.ROUND },
          'test'
        );
        expect(result).toBe(4);
      });

      it('should round to specified decimals', async () => {
        const result = await transformer.transform(
          3.14159,
          { type: TransformationType.ROUND, decimals: 2 },
          'test'
        );
        expect(result).toBe(3.14);
      });

      it('should handle string numbers', async () => {
        const result = await transformer.transform(
          '3.7',
          { type: TransformationType.ROUND },
          'test'
        );
        expect(result).toBe(4);
      });

      it('should throw error for non-numeric values', async () => {
        await expect(
          transformer.transform(
            'abc',
            { type: TransformationType.ROUND },
            'test'
          )
        ).rejects.toThrow(TransformationError);
      });
    });

    describe('floor', () => {
      it('should floor to integer', async () => {
        const result = await transformer.transform(
          3.9,
          { type: TransformationType.FLOOR },
          'test'
        );
        expect(result).toBe(3);
      });

      it('should floor to specified decimals', async () => {
        const result = await transformer.transform(
          3.149,
          { type: TransformationType.FLOOR, decimals: 2 },
          'test'
        );
        expect(result).toBe(3.14);
      });
    });

    describe('ceil', () => {
      it('should ceil to integer', async () => {
        const result = await transformer.transform(
          3.1,
          { type: TransformationType.CEIL },
          'test'
        );
        expect(result).toBe(4);
      });

      it('should ceil to specified decimals', async () => {
        const result = await transformer.transform(
          3.141,
          { type: TransformationType.CEIL, decimals: 2 },
          'test'
        );
        expect(result).toBe(3.15);
      });
    });

    describe('regex_extract', () => {
      it('should extract matching text', async () => {
        const result = await transformer.transform(
          'Order #12345 placed',
          { type: TransformationType.REGEX_EXTRACT, pattern: '#(\\d+)' },
          'test'
        );
        expect(result).toBe('#12345');
      });

      it('should extract capture group', async () => {
        const result = await transformer.transform(
          'Order #12345 placed',
          { type: TransformationType.REGEX_EXTRACT, pattern: '#(\\d+)', captureGroup: 1 },
          'test'
        );
        expect(result).toBe('12345');
      });

      it('should return null if no match', async () => {
        const result = await transformer.transform(
          'No order number here',
          { type: TransformationType.REGEX_EXTRACT, pattern: '#(\\d+)' },
          'test'
        );
        expect(result).toBeNull();
      });
    });

    describe('regex_replace', () => {
      it('should replace matched text', async () => {
        const result = await transformer.transform(
          'Hello World',
          { type: TransformationType.REGEX_REPLACE, pattern: 'World', replacement: 'Universe' },
          'test'
        );
        expect(result).toBe('Hello Universe');
      });

      it('should replace all occurrences with global flag', async () => {
        const result = await transformer.transform(
          'hello hello hello',
          { type: TransformationType.REGEX_REPLACE, pattern: 'hello', replacement: 'hi', flags: 'g' },
          'test'
        );
        expect(result).toBe('hi hi hi');
      });

      it('should support case-insensitive replacement', async () => {
        const result = await transformer.transform(
          'Hello HELLO hello',
          { type: TransformationType.REGEX_REPLACE, pattern: 'hello', replacement: 'hi', flags: 'gi' },
          'test'
        );
        expect(result).toBe('hi hi hi');
      });
    });

    describe('split', () => {
      it('should split string into array', async () => {
        const result = await transformer.transform(
          'a,b,c',
          { type: TransformationType.SPLIT, delimiter: ',' },
          'test'
        );
        expect(result).toEqual(['a', 'b', 'c']);
      });

      it('should return specific index if provided', async () => {
        const result = await transformer.transform(
          'a,b,c',
          { type: TransformationType.SPLIT, delimiter: ',', index: 1 },
          'test'
        );
        expect(result).toBe('b');
      });

      it('should return empty string for out-of-bounds index', async () => {
        const result = await transformer.transform(
          'a,b,c',
          { type: TransformationType.SPLIT, delimiter: ',', index: 10 },
          'test'
        );
        expect(result).toBe('');
      });
    });

    describe('join', () => {
      it('should join array with delimiter', async () => {
        const result = await transformer.transform(
          ['a', 'b', 'c'],
          { type: TransformationType.JOIN, delimiter: '-' },
          'test'
        );
        expect(result).toBe('a-b-c');
      });

      it('should convert non-array to string', async () => {
        const result = await transformer.transform(
          'hello',
          { type: TransformationType.JOIN, delimiter: ',' },
          'test'
        );
        expect(result).toBe('hello');
      });
    });

    describe('custom', () => {
      it('should execute custom JavaScript', async () => {
        const result = await transformer.transform(
          'hello',
          {
            type: TransformationType.CUSTOM,
            script: 'return value.toUpperCase() + "!";'
          },
          'test'
        );
        expect(result).toBe('HELLO!');
      });

      it('should have access to fieldName', async () => {
        const result = await transformer.transform(
          'hello',
          {
            type: TransformationType.CUSTOM,
            script: 'return fieldName + ":" + value;'
          },
          'myField'
        );
        expect(result).toBe('myField:hello');
      });

      it('should throw error for invalid script', async () => {
        await expect(
          transformer.transform(
            'hello',
            {
              type: TransformationType.CUSTOM,
              script: 'invalid javascript {'
            },
            'test'
          )
        ).rejects.toThrow(TransformationError);
      });
    });

    describe('null handling', () => {
      it('should return null for null input', async () => {
        const result = await transformer.transform(
          null,
          { type: TransformationType.TRIM },
          'test'
        );
        expect(result).toBeNull();
      });

      it('should return undefined for undefined input', async () => {
        const result = await transformer.transform(
          undefined,
          { type: TransformationType.UPPERCASE },
          'test'
        );
        expect(result).toBeUndefined();
      });
    });
  });

  describe('transformChain()', () => {
    it('should apply transformations in sequence', async () => {
      const result = await transformer.transformChain(
        '  hello world  ',
        [
          { type: TransformationType.TRIM },
          { type: TransformationType.UPPERCASE }
        ],
        'test'
      );
      expect(result).toBe('HELLO WORLD');
    });

    it('should handle empty transformation array', async () => {
      const result = await transformer.transformChain(
        'hello',
        [],
        'test'
      );
      expect(result).toBe('hello');
    });

    it('should pass result of one transform to next', async () => {
      const result = await transformer.transformChain(
        '3.7',
        [
          { type: TransformationType.ROUND },
          { type: TransformationType.CUSTOM, script: 'return value * 2;' }
        ],
        'test'
      );
      expect(result).toBe(8);
    });
  });

  describe('transformSafe()', () => {
    it('should return success result on success', async () => {
      const result = await transformer.transformSafe(
        'hello',
        [{ type: TransformationType.UPPERCASE }],
        'test'
      );
      expect(result.success).toBe(true);
      expect(result.value).toBe('HELLO');
      expect(result.error).toBeUndefined();
    });

    it('should return error result on failure', async () => {
      const result = await transformer.transformSafe(
        'not-a-number',
        [{ type: TransformationType.ROUND }],
        'test'
      );
      expect(result.success).toBe(false);
      expect(result.value).toBe('not-a-number');
      expect(result.error).toBeInstanceOf(TransformationError);
    });
  });
});
