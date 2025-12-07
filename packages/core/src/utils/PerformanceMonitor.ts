/**
 * Performance Monitor
 *
 * Tracks and reports performance metrics for import/export operations.
 * Helps identify bottlenecks and verify PRD performance requirements.
 */

export interface OperationTiming {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  totalDuration: number;
  operations: OperationTiming[];
  rowsProcessed: number;
  rowsPerSecond: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  breakdown: {
    parsing: number;
    validation: number;
    transformation: number;
    lookup: number;
    database: number;
    other: number;
  };
}

/**
 * Performance Monitor class
 */
export class PerformanceMonitor {
  private operations: OperationTiming[] = [];
  private startTime: number = 0;
  private endTime: number = 0;
  private rowsProcessed: number = 0;
  private activeOperations: Map<string, OperationTiming> = new Map();

  /**
   * Start monitoring
   */
  start(): void {
    this.startTime = performance.now();
    this.operations = [];
    this.rowsProcessed = 0;
    this.activeOperations.clear();
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    this.endTime = performance.now();
  }

  /**
   * Start timing an operation
   */
  startOperation(name: string, metadata?: Record<string, any>): void {
    const timing: OperationTiming = {
      name,
      startTime: performance.now(),
      metadata
    };

    this.activeOperations.set(name, timing);
  }

  /**
   * End timing an operation
   */
  endOperation(name: string, metadata?: Record<string, any>): void {
    const timing = this.activeOperations.get(name);

    if (timing) {
      timing.endTime = performance.now();
      timing.duration = timing.endTime - timing.startTime;

      if (metadata) {
        timing.metadata = { ...timing.metadata, ...metadata };
      }

      this.operations.push(timing);
      this.activeOperations.delete(name);
    }
  }

  /**
   * Record a completed operation
   */
  recordOperation(name: string, duration: number, metadata?: Record<string, any>): void {
    this.operations.push({
      name,
      startTime: performance.now() - duration,
      endTime: performance.now(),
      duration,
      metadata
    });
  }

  /**
   * Increment rows processed counter
   */
  incrementRows(count: number = 1): void {
    this.rowsProcessed += count;
  }

  /**
   * Set total rows processed
   */
  setRowsProcessed(count: number): void {
    this.rowsProcessed = count;
  }

  /**
   * Get current memory usage
   */
  private getMemoryUsage(): { heapUsed: number; heapTotal: number; external: number } {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: usage.heapUsed,
        heapTotal: usage.heapTotal,
        external: usage.external
      };
    }

    // Browser fallback
    return {
      heapUsed: 0,
      heapTotal: 0,
      external: 0
    };
  }

  /**
   * Calculate performance breakdown by category
   */
  private calculateBreakdown(): PerformanceMetrics['breakdown'] {
    const breakdown = {
      parsing: 0,
      validation: 0,
      transformation: 0,
      lookup: 0,
      database: 0,
      other: 0
    };

    for (const op of this.operations) {
      const duration = op.duration || 0;
      const name = op.name.toLowerCase();

      if (name.includes('parse') || name.includes('csv')) {
        breakdown.parsing += duration;
      } else if (name.includes('valid')) {
        breakdown.validation += duration;
      } else if (name.includes('transform')) {
        breakdown.transformation += duration;
      } else if (name.includes('lookup')) {
        breakdown.lookup += duration;
      } else if (name.includes('db') || name.includes('insert') || name.includes('update')) {
        breakdown.database += duration;
      } else {
        breakdown.other += duration;
      }
    }

    return breakdown;
  }

  /**
   * Get performance metrics
   */
  getMetrics(): PerformanceMetrics {
    const totalDuration = (this.endTime || performance.now()) - this.startTime;
    const rowsPerSecond = totalDuration > 0
      ? (this.rowsProcessed / totalDuration) * 1000
      : 0;

    return {
      totalDuration,
      operations: [...this.operations],
      rowsProcessed: this.rowsProcessed,
      rowsPerSecond,
      memoryUsage: this.getMemoryUsage(),
      breakdown: this.calculateBreakdown()
    };
  }

  /**
   * Get summary report as a string
   */
  getSummary(): string {
    const metrics = this.getMetrics();
    const lines: string[] = [];

    lines.push('=== Performance Report ===');
    lines.push(`Total Duration: ${metrics.totalDuration.toFixed(2)}ms`);
    lines.push(`Rows Processed: ${metrics.rowsProcessed}`);
    lines.push(`Throughput: ${metrics.rowsPerSecond.toFixed(2)} rows/sec`);
    lines.push('');
    lines.push('Breakdown:');
    lines.push(`  Parsing: ${metrics.breakdown.parsing.toFixed(2)}ms`);
    lines.push(`  Validation: ${metrics.breakdown.validation.toFixed(2)}ms`);
    lines.push(`  Transformation: ${metrics.breakdown.transformation.toFixed(2)}ms`);
    lines.push(`  Lookup: ${metrics.breakdown.lookup.toFixed(2)}ms`);
    lines.push(`  Database: ${metrics.breakdown.database.toFixed(2)}ms`);
    lines.push(`  Other: ${metrics.breakdown.other.toFixed(2)}ms`);
    lines.push('');
    lines.push('Memory:');
    lines.push(`  Heap Used: ${(metrics.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    lines.push(`  Heap Total: ${(metrics.memoryUsage.heapTotal / 1024 / 1024).toFixed(2)}MB`);

    return lines.join('\n');
  }

  /**
   * Check if performance meets PRD requirements
   */
  checkPRDCompliance(rowCount: number): {
    compliant: boolean;
    details: {
      previewTarget: number;
      previewActual: number;
      previewPassed: boolean;
      importTarget: number;
      importActual: number;
      importPassed: boolean;
    };
  } {
    const metrics = this.getMetrics();
    const durationSeconds = metrics.totalDuration / 1000;

    // PRD Requirements:
    // - Preview: <1 second for 200 rows
    // - Import: <30 seconds for 10k rows

    const previewTarget = 1.0; // 1 second
    const previewRowThreshold = 200;
    const importTarget = 30.0; // 30 seconds
    const importRowThreshold = 10000;

    // Calculate expected max time based on row count
    const expectedPreviewTime = (rowCount / previewRowThreshold) * previewTarget;
    const expectedImportTime = (rowCount / importRowThreshold) * importTarget;

    const previewPassed = rowCount <= previewRowThreshold
      ? durationSeconds < previewTarget
      : durationSeconds < expectedPreviewTime;

    const importPassed = rowCount <= importRowThreshold
      ? durationSeconds < importTarget
      : durationSeconds < expectedImportTime;

    return {
      compliant: previewPassed && importPassed,
      details: {
        previewTarget: expectedPreviewTime,
        previewActual: durationSeconds,
        previewPassed,
        importTarget: expectedImportTime,
        importActual: durationSeconds,
        importPassed
      }
    };
  }

  /**
   * Time a function and return its result along with duration
   * @param _name - Operation name (for documentation/logging purposes)
   * @param fn - Async function to time
   */
  static async time<T>(
    _name: string,
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    return { result, duration };
  }

  /**
   * Create a scoped timer that automatically records on completion
   */
  timer(name: string, metadata?: Record<string, any>): () => void {
    this.startOperation(name, metadata);
    return () => this.endOperation(name);
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.operations = [];
    this.startTime = 0;
    this.endTime = 0;
    this.rowsProcessed = 0;
    this.activeOperations.clear();
  }
}

export default PerformanceMonitor;
