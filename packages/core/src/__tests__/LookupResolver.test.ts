/**
 * LookupResolver Unit Tests
 */

import { LookupResolver, LookupError } from '../lookup/LookupResolver';
import { LookupFallback } from '../types/spec.types';
import { DatabaseAdapter } from '../types/execution.types';

describe('LookupResolver', () => {
  let mockDbAdapter: jest.Mocked<DatabaseAdapter>;
  let resolver: LookupResolver;

  beforeEach(() => {
    mockDbAdapter = {
      find: jest.fn(),
      findOne: jest.fn(),
      insert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      lookup: jest.fn(),
      transaction: jest.fn(),
      logOperation: jest.fn(),
      setUser: jest.fn()
    };

    resolver = new LookupResolver(mockDbAdapter, {
      cacheTTL: 60000,
      maxCacheSize: 100
    });
  });

  afterEach(() => {
    resolver.clearCache();
    resolver.resetStats();
  });

  describe('resolve()', () => {
    it('should resolve a simple lookup', async () => {
      mockDbAdapter.lookup.mockResolvedValue({ id: 1, name: 'Test' });

      const result = await resolver.resolve(
        {
          table: 'users',
          key: 'name',
          fallback: LookupFallback.ERROR
        },
        'Test',
        'user_id'
      );

      expect(result.success).toBe(true);
      expect(result.foundRecord).toEqual({ id: 1, name: 'Test' });
      expect(result.field).toBe('user_id');
      expect(result.lookupValue).toBe('Test');
    });

    it('should cache lookup results', async () => {
      mockDbAdapter.lookup.mockResolvedValue({ id: 1, name: 'Test' });

      await resolver.resolve(
        { table: 'users', key: 'name', fallback: LookupFallback.ERROR },
        'Test',
        'user_id'
      );

      await resolver.resolve(
        { table: 'users', key: 'name', fallback: LookupFallback.ERROR },
        'Test',
        'user_id'
      );

      expect(mockDbAdapter.lookup).toHaveBeenCalledTimes(1);

      const stats = resolver.getStats();
      expect(stats.cacheHits).toBe(1);
      expect(stats.cacheMisses).toBe(1);
    });

    it('should skip cache when cache=false', async () => {
      mockDbAdapter.lookup.mockResolvedValue({ id: 1, name: 'Test' });

      await resolver.resolve(
        { table: 'users', key: 'name', fallback: LookupFallback.ERROR, cache: false },
        'Test',
        'user_id'
      );

      await resolver.resolve(
        { table: 'users', key: 'name', fallback: LookupFallback.ERROR, cache: false },
        'Test',
        'user_id'
      );

      expect(mockDbAdapter.lookup).toHaveBeenCalledTimes(2);
    });

    it('should return null for null/undefined values', async () => {
      const result = await resolver.resolve(
        { table: 'users', key: 'name', fallback: LookupFallback.NULL },
        null,
        'user_id'
      );

      expect(result.success).toBe(true);
      expect(result.foundRecord).toBeNull();
    });

    describe('fallback strategies', () => {
      it('should throw error with ERROR fallback', async () => {
        mockDbAdapter.lookup.mockResolvedValue(null);

        await expect(
          resolver.resolve(
            { table: 'users', key: 'name', fallback: LookupFallback.ERROR },
            'NotFound',
            'user_id'
          )
        ).rejects.toThrow(LookupError);
      });

      it('should return success=false with SKIP fallback', async () => {
        mockDbAdapter.lookup.mockResolvedValue(null);

        const result = await resolver.resolve(
          { table: 'users', key: 'name', fallback: LookupFallback.SKIP },
          'NotFound',
          'user_id'
        );

        expect(result.success).toBe(false);
        expect(result.error).toBe('Record not found');
      });

      it('should return default value with DEFAULT fallback', async () => {
        mockDbAdapter.lookup.mockResolvedValue(null);

        const result = await resolver.resolve(
          {
            table: 'users',
            key: 'name',
            fallback: LookupFallback.DEFAULT,
            defaultValue: 'default-id'
          },
          'NotFound',
          'user_id'
        );

        expect(result.success).toBe(true);
        expect(result.foundRecord).toBe('default-id');
      });

      it('should return null with NULL fallback', async () => {
        mockDbAdapter.lookup.mockResolvedValue(null);

        const result = await resolver.resolve(
          { table: 'users', key: 'name', fallback: LookupFallback.NULL },
          'NotFound',
          'user_id'
        );

        expect(result.success).toBe(true);
        expect(result.foundRecord).toBeNull();
      });
    });

    describe('error handling', () => {
      it('should handle database errors with ERROR fallback', async () => {
        mockDbAdapter.lookup.mockRejectedValue(new Error('Database error'));

        await expect(
          resolver.resolve(
            { table: 'users', key: 'name', fallback: LookupFallback.ERROR },
            'Test',
            'user_id'
          )
        ).rejects.toThrow(LookupError);
      });

      it('should handle database errors with NULL fallback', async () => {
        mockDbAdapter.lookup.mockRejectedValue(new Error('Database error'));

        const result = await resolver.resolve(
          { table: 'users', key: 'name', fallback: LookupFallback.NULL },
          'Test',
          'user_id'
        );

        expect(result.success).toBe(true);
        expect(result.foundRecord).toBeNull();
      });

      it('should track error count in stats', async () => {
        mockDbAdapter.lookup.mockRejectedValue(new Error('Database error'));

        await resolver.resolve(
          { table: 'users', key: 'name', fallback: LookupFallback.NULL },
          'Test',
          'user_id'
        );

        const stats = resolver.getStats();
        expect(stats.errors).toBe(1);
      });
    });
  });

  describe('resolveBatch()', () => {
    it('should resolve multiple lookups', async () => {
      mockDbAdapter.lookup
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 });

      const results = await resolver.resolveBatch([
        {
          config: { table: 'users', key: 'name', fallback: LookupFallback.NULL },
          value: 'User1',
          fieldName: 'user_id'
        },
        {
          config: { table: 'users', key: 'name', fallback: LookupFallback.NULL },
          value: 'User2',
          fieldName: 'user_id'
        }
      ]);

      expect(results).toHaveLength(2);
      expect(results[0].foundRecord).toEqual({ id: 1 });
      expect(results[1].foundRecord).toEqual({ id: 2 });
    });
  });

  describe('preloadCache()', () => {
    it('should preload cache with values', async () => {
      mockDbAdapter.lookup
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 });

      await resolver.preloadCache(
        { table: 'users', key: 'name', fallback: LookupFallback.NULL },
        ['User1', 'User2']
      );

      const cacheStats = resolver.getCacheStats();
      expect(cacheStats.size).toBe(2);
    });

    it('should not fail on preload errors', async () => {
      mockDbAdapter.lookup.mockRejectedValue(new Error('Database error'));

      await expect(
        resolver.preloadCache(
          { table: 'users', key: 'name', fallback: LookupFallback.NULL },
          ['User1']
        )
      ).resolves.not.toThrow();
    });
  });

  describe('cache management', () => {
    it('should clear cache', async () => {
      mockDbAdapter.lookup.mockResolvedValue({ id: 1 });

      await resolver.resolve(
        { table: 'users', key: 'name', fallback: LookupFallback.NULL },
        'Test',
        'user_id'
      );

      resolver.clearCache();

      const cacheStats = resolver.getCacheStats();
      expect(cacheStats.size).toBe(0);
    });

    it('should evict oldest entries when max size reached', async () => {
      const smallResolver = new LookupResolver(mockDbAdapter, {
        maxCacheSize: 2
      });

      mockDbAdapter.lookup.mockResolvedValue({ id: 1 });

      await smallResolver.resolve(
        { table: 'users', key: 'name', fallback: LookupFallback.NULL },
        'A',
        'field'
      );
      await smallResolver.resolve(
        { table: 'users', key: 'name', fallback: LookupFallback.NULL },
        'B',
        'field'
      );
      await smallResolver.resolve(
        { table: 'users', key: 'name', fallback: LookupFallback.NULL },
        'C',
        'field'
      );

      const cacheStats = smallResolver.getCacheStats();
      expect(cacheStats.size).toBe(2);
    });
  });

  describe('statistics', () => {
    it('should track lookup statistics', async () => {
      mockDbAdapter.lookup.mockResolvedValue({ id: 1 });

      await resolver.resolve(
        { table: 'users', key: 'name', fallback: LookupFallback.NULL },
        'Test',
        'user_id'
      );

      const stats = resolver.getStats();
      expect(stats.totalLookups).toBe(1);
      expect(stats.cacheMisses).toBe(1);
      expect(stats.averageTime).toBeGreaterThanOrEqual(0);
    });

    it('should reset statistics', async () => {
      mockDbAdapter.lookup.mockResolvedValue({ id: 1 });

      await resolver.resolve(
        { table: 'users', key: 'name', fallback: LookupFallback.NULL },
        'Test',
        'user_id'
      );

      resolver.resetStats();

      const stats = resolver.getStats();
      expect(stats.totalLookups).toBe(0);
      expect(stats.cacheHits).toBe(0);
      expect(stats.cacheMisses).toBe(0);
    });
  });

  describe('composite keys', () => {
    it('should handle composite key lookups', async () => {
      mockDbAdapter.lookup.mockResolvedValue({ id: 1 });

      const result = await resolver.resolve(
        {
          table: 'users',
          key: ['first_name', 'last_name'],
          fallback: LookupFallback.NULL
        },
        ['John', 'Doe'],
        'user_id'
      );

      expect(result.success).toBe(true);
      expect(mockDbAdapter.lookup).toHaveBeenCalledWith(
        'users',
        ['first_name', 'last_name'],
        ['John', 'Doe']
      );
    });
  });
});
