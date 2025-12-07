/**
 * LRU (Least Recently Used) Cache Implementation
 *
 * A high-performance cache with O(1) get, set, and delete operations.
 * Automatically evicts least recently used entries when capacity is exceeded.
 */

interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  prev: CacheEntry<T> | null;
  next: CacheEntry<T> | null;
}

export interface LRUCacheOptions {
  maxSize: number;
  ttl?: number; // Time to live in milliseconds
  onEvict?: (key: string, value: any) => void;
}

export interface LRUCacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  evictions: number;
  hitRate: number;
}

/**
 * LRU Cache with O(1) operations
 */
export class LRUCache<T = any> {
  private cache: Map<string, CacheEntry<T>>;
  private head: CacheEntry<T> | null = null;
  private tail: CacheEntry<T> | null = null;
  private maxSize: number;
  private ttl: number;
  private onEvict?: (key: string, value: T) => void;

  // Statistics
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(options: LRUCacheOptions) {
    this.cache = new Map();
    this.maxSize = options.maxSize;
    this.ttl = options.ttl || 0; // 0 means no TTL
    this.onEvict = options.onEvict;
  }

  /**
   * Get a value from the cache
   * Returns undefined if not found or expired
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check TTL
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      this.misses++;
      return undefined;
    }

    // Move to front (most recently used)
    this.moveToFront(entry);
    this.hits++;

    return entry.value;
  }

  /**
   * Set a value in the cache
   */
  set(key: string, value: T): void {
    const existingEntry = this.cache.get(key);

    if (existingEntry) {
      // Update existing entry
      existingEntry.value = value;
      existingEntry.timestamp = Date.now();
      this.moveToFront(existingEntry);
      return;
    }

    // Create new entry
    const newEntry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      prev: null,
      next: null
    };

    // Add to cache
    this.cache.set(key, newEntry);
    this.addToFront(newEntry);

    // Evict if over capacity
    if (this.cache.size > this.maxSize) {
      this.evictLRU();
    }
  }

  /**
   * Check if a key exists in the cache (without updating LRU order)
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check TTL
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Delete a key from the cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    this.removeFromList(entry);
    this.cache.delete(key);

    return true;
  }

  /**
   * Clear the entire cache
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    this.resetStats();
  }

  /**
   * Get the current size of the cache
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): LRUCacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      hitRate: total > 0 ? this.hits / total : 0
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  /**
   * Get all keys in the cache (from most to least recently used)
   */
  keys(): string[] {
    const keys: string[] = [];
    let current = this.head;

    while (current) {
      keys.push(current.key);
      current = current.next;
    }

    return keys;
  }

  /**
   * Get all entries in the cache (from most to least recently used)
   */
  entries(): Array<[string, T]> {
    const entries: Array<[string, T]> = [];
    let current = this.head;

    while (current) {
      entries.push([current.key, current.value]);
      current = current.next;
    }

    return entries;
  }

  /**
   * Peek at a value without updating LRU order
   */
  peek(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check TTL
    if (this.ttl > 0 && Date.now() - entry.timestamp > this.ttl) {
      this.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Batch get multiple values
   */
  getMany(keys: string[]): Map<string, T> {
    const result = new Map<string, T>();

    for (const key of keys) {
      const value = this.get(key);
      if (value !== undefined) {
        result.set(key, value);
      }
    }

    return result;
  }

  /**
   * Batch set multiple values
   */
  setMany(entries: Array<[string, T]>): void {
    for (const [key, value] of entries) {
      this.set(key, value);
    }
  }

  // Private methods for doubly linked list operations

  private addToFront(entry: CacheEntry<T>): void {
    entry.next = this.head;
    entry.prev = null;

    if (this.head) {
      this.head.prev = entry;
    }

    this.head = entry;

    if (!this.tail) {
      this.tail = entry;
    }
  }

  private removeFromList(entry: CacheEntry<T>): void {
    if (entry.prev) {
      entry.prev.next = entry.next;
    } else {
      this.head = entry.next;
    }

    if (entry.next) {
      entry.next.prev = entry.prev;
    } else {
      this.tail = entry.prev;
    }
  }

  private moveToFront(entry: CacheEntry<T>): void {
    if (entry === this.head) {
      return;
    }

    this.removeFromList(entry);
    this.addToFront(entry);
  }

  private evictLRU(): void {
    if (!this.tail) {
      return;
    }

    const evictedKey = this.tail.key;
    const evictedValue = this.tail.value;

    this.cache.delete(evictedKey);
    this.removeFromList(this.tail);

    this.evictions++;

    if (this.onEvict) {
      this.onEvict(evictedKey, evictedValue);
    }
  }
}

export default LRUCache;
