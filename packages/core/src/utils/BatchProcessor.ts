/**
 * Batch Processor
 *
 * Provides utilities for efficient batch processing of rows.
 * Supports parallel execution and configurable batch sizes.
 */

export interface BatchProcessorOptions {
  batchSize?: number;
  maxConcurrency?: number;
  onProgress?: (processed: number, total: number) => void;
  onError?: (error: Error, batch: any[]) => void;
}

export interface BatchResult<T> {
  results: T[];
  errors: BatchError[];
  totalProcessed: number;
  totalBatches: number;
  executionTime: number;
}

export interface BatchError {
  batchIndex: number;
  error: Error;
  items: any[];
}

const DEFAULT_OPTIONS: Required<Omit<BatchProcessorOptions, 'onProgress' | 'onError'>> = {
  batchSize: 100,
  maxConcurrency: 5
};

/**
 * Batch Processor class
 */
export class BatchProcessor {
  private options: Required<Omit<BatchProcessorOptions, 'onProgress' | 'onError'>>;
  private onProgress?: (processed: number, total: number) => void;
  private onError?: (error: Error, batch: any[]) => void;

  constructor(options: BatchProcessorOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.onProgress = options.onProgress;
    this.onError = options.onError;
  }

  /**
   * Process items in batches sequentially
   */
  async processSequential<T, R>(
    items: T[],
    processor: (batch: T[], batchIndex: number) => Promise<R[]>
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const results: R[] = [];
    const errors: BatchError[] = [];
    const batches = this.createBatches(items);

    let processed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      try {
        const batchResults = await processor(batch, i);
        results.push(...batchResults);
      } catch (error: any) {
        errors.push({
          batchIndex: i,
          error,
          items: batch
        });

        if (this.onError) {
          this.onError(error, batch);
        }
      }

      processed += batch.length;

      if (this.onProgress) {
        this.onProgress(processed, items.length);
      }
    }

    return {
      results,
      errors,
      totalProcessed: processed,
      totalBatches: batches.length,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Process items in batches with controlled concurrency
   */
  async processParallel<T, R>(
    items: T[],
    processor: (batch: T[], batchIndex: number) => Promise<R[]>
  ): Promise<BatchResult<R>> {
    const startTime = Date.now();
    const results: R[] = [];
    const errors: BatchError[] = [];
    const batches = this.createBatches(items);

    let processed = 0;
    const resultMap = new Map<number, R[]>();

    // Process batches with controlled concurrency
    const processWithConcurrency = async () => {
      const executing: Promise<void>[] = [];
      let batchIndex = 0;

      const runBatch = async (index: number): Promise<void> => {
        const batch = batches[index];

        try {
          const batchResults = await processor(batch, index);
          resultMap.set(index, batchResults);
        } catch (error: any) {
          errors.push({
            batchIndex: index,
            error,
            items: batch
          });

          if (this.onError) {
            this.onError(error, batch);
          }

          resultMap.set(index, []);
        }

        processed += batch.length;

        if (this.onProgress) {
          this.onProgress(processed, items.length);
        }
      };

      while (batchIndex < batches.length) {
        // Remove completed promises
        while (executing.length >= this.options.maxConcurrency) {
          await Promise.race(executing);
          // Filter out completed promises
          for (let i = executing.length - 1; i >= 0; i--) {
            const status = await Promise.race([
              executing[i].then(() => 'fulfilled'),
              Promise.resolve('pending')
            ]);
            if (status === 'fulfilled') {
              executing.splice(i, 1);
            }
          }
        }

        const currentIndex = batchIndex++;
        const promise = runBatch(currentIndex);
        executing.push(promise);
      }

      // Wait for all remaining promises
      await Promise.all(executing);
    };

    await processWithConcurrency();

    // Collect results in order
    for (let i = 0; i < batches.length; i++) {
      const batchResults = resultMap.get(i);
      if (batchResults) {
        results.push(...batchResults);
      }
    }

    return {
      results,
      errors,
      totalProcessed: processed,
      totalBatches: batches.length,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Process items one by one with batched callbacks
   */
  async processWithCallback<T>(
    items: T[],
    processor: (item: T, index: number) => Promise<void>,
    onBatchComplete?: (batchIndex: number, batchResults: any[]) => Promise<void>
  ): Promise<BatchResult<void>> {
    const startTime = Date.now();
    const errors: BatchError[] = [];
    const batches = this.createBatches(items);

    let processed = 0;
    let globalIndex = 0;

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      const batchErrors: any[] = [];

      for (const item of batch) {
        try {
          await processor(item, globalIndex);
        } catch (error: any) {
          batchErrors.push({ index: globalIndex, error, item });
        }
        globalIndex++;
      }

      if (batchErrors.length > 0) {
        errors.push({
          batchIndex,
          error: new Error(`${batchErrors.length} errors in batch`),
          items: batchErrors
        });
      }

      processed += batch.length;

      if (this.onProgress) {
        this.onProgress(processed, items.length);
      }

      if (onBatchComplete) {
        await onBatchComplete(batchIndex, batch);
      }
    }

    return {
      results: [],
      errors,
      totalProcessed: processed,
      totalBatches: batches.length,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Create batches from items array
   */
  createBatches<T>(items: T[]): T[][] {
    const batches: T[][] = [];

    for (let i = 0; i < items.length; i += this.options.batchSize) {
      batches.push(items.slice(i, i + this.options.batchSize));
    }

    return batches;
  }

  /**
   * Map items in parallel with controlled concurrency
   */
  async map<T, R>(
    items: T[],
    mapper: (item: T, index: number) => Promise<R>
  ): Promise<BatchResult<R>> {
    return this.processParallel(items, async (batch, batchIndex) => {
      const startIndex = batchIndex * this.options.batchSize;
      const results: R[] = [];

      for (let i = 0; i < batch.length; i++) {
        const result = await mapper(batch[i], startIndex + i);
        results.push(result);
      }

      return results;
    });
  }

  /**
   * Filter items in parallel with controlled concurrency
   */
  async filter<T>(
    items: T[],
    predicate: (item: T, index: number) => Promise<boolean>
  ): Promise<BatchResult<T>> {
    return this.processParallel(items, async (batch, batchIndex) => {
      const startIndex = batchIndex * this.options.batchSize;
      const results: T[] = [];

      for (let i = 0; i < batch.length; i++) {
        const keep = await predicate(batch[i], startIndex + i);
        if (keep) {
          results.push(batch[i]);
        }
      }

      return results;
    });
  }

  /**
   * Reduce items with batched accumulation
   */
  async reduce<T, R>(
    items: T[],
    reducer: (accumulator: R, item: T, index: number) => Promise<R>,
    initialValue: R
  ): Promise<{ result: R; executionTime: number }> {
    const startTime = Date.now();
    let accumulator = initialValue;
    let index = 0;

    for (const item of items) {
      accumulator = await reducer(accumulator, item, index);
      index++;

      if (this.onProgress) {
        this.onProgress(index, items.length);
      }
    }

    return {
      result: accumulator,
      executionTime: Date.now() - startTime
    };
  }

  /**
   * Chunk items into smaller arrays
   */
  static chunk<T>(items: T[], size: number): T[][] {
    const chunks: T[][] = [];

    for (let i = 0; i < items.length; i += size) {
      chunks.push(items.slice(i, i + size));
    }

    return chunks;
  }

  /**
   * Flatten array of arrays
   */
  static flatten<T>(arrays: T[][]): T[] {
    return arrays.reduce((acc, arr) => acc.concat(arr), []);
  }

  /**
   * Retry a function with exponential backoff
   */
  static async retry<T>(
    fn: () => Promise<T>,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      maxDelay?: number;
      factor?: number;
    } = {}
  ): Promise<T> {
    const {
      maxRetries = 3,
      baseDelay = 1000,
      maxDelay = 30000,
      factor = 2
    } = options;

    let lastError: Error | undefined;
    let delay = baseDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        lastError = error;

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, delay));
          delay = Math.min(delay * factor, maxDelay);
        }
      }
    }

    throw lastError;
  }
}

export default BatchProcessor;
