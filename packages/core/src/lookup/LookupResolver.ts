/**
 * Lookup Resolver
 *
 * Handles database lookups for foreign key resolution with caching support
 * Supports both single key and composite key lookups
 */

import { LookupConfig, LookupFallback } from '../types/spec.types';
import { DatabaseAdapter, LookupResult } from '../types/execution.types';

/**
 * Lookup error
 */
export class LookupError extends Error {
  constructor(
    message: string,
    public field: string,
    public lookupValue: any,
    public table: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'LookupError';
  }
}

/**
 * Cache entry
 */
interface CacheEntry {
  value: any;
  timestamp: number;
}

/**
 * Lookup statistics
 */
export interface LookupStats {
  totalLookups: number;
  cacheHits: number;
  cacheMisses: number;
  errors: number;
  averageTime: number;
}

/**
 * Lookup Resolver class
 */
export class LookupResolver {
  private cache: Map<string, CacheEntry>;
  private stats: LookupStats;
  private cacheTTL: number;
  private maxCacheSize: number;

  constructor(
    private dbAdapter: DatabaseAdapter,
    options: {
      cacheTTL?: number;
      maxCacheSize?: number;
    } = {}
  ) {
    this.cache = new Map();
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes default
    this.maxCacheSize = options.maxCacheSize || 10000;
    this.stats = {
      totalLookups: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      averageTime: 0
    };
  }

  /**
   * Resolve a lookup for a field
   *
   * @param config - Lookup configuration
   * @param value - Value to lookup
   * @param fieldName - Field name for error reporting
   * @returns Lookup result
   */
  async resolve(
    config: LookupConfig,
    value: any,
    fieldName: string
  ): Promise<LookupResult> {
    const startTime = Date.now();
    this.stats.totalLookups++;

    try {
      if (value === null || value === undefined) {
        return this.handleFallback(config, value, fieldName, 'Value is null or undefined');
      }

      const cacheKey = this.getCacheKey(config, value);

      if (config.cache !== false) {
        const cached = this.getFromCache(cacheKey);
        if (cached !== null) {
          this.stats.cacheHits++;
          return {
            field: fieldName,
            lookupValue: value,
            foundRecord: cached,
            success: true
          };
        }
      }

      this.stats.cacheMisses++;

      const foundRecord = await this.performLookup(config, value);

      if (foundRecord) {
        if (config.cache !== false) {
          this.setCache(cacheKey, foundRecord);
        }

        this.updateAverageTime(Date.now() - startTime);

        return {
          field: fieldName,
          lookupValue: value,
          foundRecord,
          success: true
        };
      }

      return this.handleFallback(config, value, fieldName, 'Record not found');
    } catch (error: any) {
      this.stats.errors++;
      this.updateAverageTime(Date.now() - startTime);

      if (config.fallback === LookupFallback.ERROR) {
        throw new LookupError(
          `Lookup failed for field ${fieldName}: ${error.message}`,
          fieldName,
          value,
          config.table,
          error
        );
      }

      return this.handleFallback(config, value, fieldName, error.message);
    }
  }

  /**
   * Perform the actual database lookup
   */
  private async performLookup(config: LookupConfig, value: any): Promise<any | null> {
    return await this.dbAdapter.lookup(config.table, config.key, value);
  }

  /**
   * Handle fallback strategies when lookup fails
   */
  private handleFallback(
    config: LookupConfig,
    value: any,
    fieldName: string,
    errorMessage: string
  ): LookupResult {
    switch (config.fallback) {
      case LookupFallback.ERROR:
        throw new LookupError(
          `Lookup failed for field ${fieldName}: ${errorMessage}`,
          fieldName,
          value,
          config.table
        );

      case LookupFallback.SKIP:
        return {
          field: fieldName,
          lookupValue: value,
          success: false,
          error: errorMessage
        };

      case LookupFallback.DEFAULT:
        return {
          field: fieldName,
          lookupValue: value,
          foundRecord: config.defaultValue,
          success: true
        };

      case LookupFallback.NULL:
        return {
          field: fieldName,
          lookupValue: value,
          foundRecord: null,
          success: true
        };

      default:
        throw new LookupError(
          `Unknown fallback strategy: ${config.fallback}`,
          fieldName,
          value,
          config.table
        );
    }
  }

  /**
   * Generate cache key from lookup configuration and value
   */
  private getCacheKey(config: LookupConfig, value: any): string {
    const keyStr = Array.isArray(config.key) ? config.key.join(',') : config.key;
    const valueStr = Array.isArray(value) ? value.join(',') : String(value);
    return `${config.table}:${keyStr}:${valueStr}`;
  }

  /**
   * Get value from cache
   */
  private getFromCache(key: string): any | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const now = Date.now();
    if (now - entry.timestamp > this.cacheTTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  /**
   * Set value in cache
   */
  private setCache(key: string, value: any): void {
    if (this.cache.size >= this.maxCacheSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    ttl: number;
  } {
    return {
      size: this.cache.size,
      maxSize: this.maxCacheSize,
      ttl: this.cacheTTL
    };
  }

  /**
   * Get lookup statistics
   */
  getStats(): LookupStats {
    return { ...this.stats };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.stats = {
      totalLookups: 0,
      cacheHits: 0,
      cacheMisses: 0,
      errors: 0,
      averageTime: 0
    };
  }

  /**
   * Update average time calculation
   */
  private updateAverageTime(newTime: number): void {
    const totalTime = this.stats.averageTime * (this.stats.totalLookups - 1);
    this.stats.averageTime = (totalTime + newTime) / this.stats.totalLookups;
  }

  /**
   * Batch resolve multiple lookups
   * This is more efficient than calling resolve() multiple times
   */
  async resolveBatch(
    lookups: Array<{
      config: LookupConfig;
      value: any;
      fieldName: string;
    }>
  ): Promise<LookupResult[]> {
    const results: LookupResult[] = [];

    for (const lookup of lookups) {
      const result = await this.resolve(lookup.config, lookup.value, lookup.fieldName);
      results.push(result);
    }

    return results;
  }

  /**
   * Preload cache with common lookups
   * Useful for warming up the cache before processing large batches
   */
  async preloadCache(
    config: LookupConfig,
    values: any[]
  ): Promise<void> {
    for (const value of values) {
      const cacheKey = this.getCacheKey(config, value);

      if (!this.cache.has(cacheKey)) {
        try {
          const foundRecord = await this.performLookup(config, value);
          if (foundRecord) {
            this.setCache(cacheKey, foundRecord);
          }
        } catch (error) {
          // Ignore errors during preload
        }
      }
    }
  }
}

export default LookupResolver;
