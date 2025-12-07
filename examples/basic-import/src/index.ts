/**
 * Basic Import Example
 *
 * This example demonstrates how to use the @dataspec-engine/core package
 * to import CSV data using a YAML specification.
 */

import * as fs from 'fs';
import * as path from 'path';

// Import from the core package
import {
  YAMLParser,
  ImportExecutor,
  FieldTransformer,
  LookupResolver,
  MaskingEngine,
  HookExecutor,
  type DatabaseAdapter,
  type DataSpecDefinition,
  type ImportResult,
  type PreviewResult,
} from '@dataspec-engine/core';

// ============================================================================
// Mock Database Adapter
// ============================================================================

/**
 * A simple mock database adapter for demonstration purposes.
 * In a real application, you would use the SupabaseAdapter from
 * @dataspec-engine/supabase-adapter or implement your own.
 */
class MockDatabaseAdapter implements DatabaseAdapter {
  private tables: Map<string, Map<string, Record<string, unknown>>> = new Map();

  async find(
    table: string,
    query?: { where?: Record<string, unknown>; limit?: number }
  ): Promise<Record<string, unknown>[]> {
    const tableData = this.tables.get(table);
    if (!tableData) return [];

    let results = Array.from(tableData.values());

    if (query?.where) {
      results = results.filter((row) =>
        Object.entries(query.where!).every(([key, value]) => row[key] === value)
      );
    }

    if (query?.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async findOne(
    table: string,
    query: { where: Record<string, unknown> }
  ): Promise<Record<string, unknown> | null> {
    const results = await this.find(table, { ...query, limit: 1 });
    return results[0] || null;
  }

  async insert(
    table: string,
    rows: Record<string, unknown>[]
  ): Promise<{ inserted: number; ids: string[] }> {
    if (!this.tables.has(table)) {
      this.tables.set(table, new Map());
    }

    const tableData = this.tables.get(table)!;
    const ids: string[] = [];

    for (const row of rows) {
      const id = row.id as string || `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      tableData.set(id, { ...row, id });
      ids.push(id);
    }

    return { inserted: rows.length, ids };
  }

  async update(
    table: string,
    rows: Record<string, unknown>[],
    _where: Record<string, unknown>
  ): Promise<{ updated: number }> {
    const tableData = this.tables.get(table);
    if (!tableData) return { updated: 0 };

    let updated = 0;
    for (const row of rows) {
      const id = row.id as string;
      if (id && tableData.has(id)) {
        tableData.set(id, { ...tableData.get(id), ...row });
        updated++;
      }
    }

    return { updated };
  }

  async delete(
    table: string,
    where: Record<string, unknown>
  ): Promise<{ deleted: number }> {
    const tableData = this.tables.get(table);
    if (!tableData) return { deleted: 0 };

    let deleted = 0;
    for (const [id, row] of tableData.entries()) {
      const matches = Object.entries(where).every(
        ([key, value]) => row[key] === value
      );
      if (matches) {
        tableData.delete(id);
        deleted++;
      }
    }

    return { deleted };
  }

  async lookup(
    table: string,
    key: string | string[],
    value: unknown | unknown[]
  ): Promise<Record<string, unknown> | null> {
    const keys = Array.isArray(key) ? key : [key];
    const values = Array.isArray(value) ? value : [value];

    const where: Record<string, unknown> = {};
    keys.forEach((k, i) => {
      where[k] = values[i];
    });

    return this.findOne(table, { where });
  }

  async transaction<T>(
    callback: (trx: DatabaseAdapter) => Promise<T>
  ): Promise<T> {
    // For mock purposes, just execute the callback
    return callback(this);
  }

  async logOperation(operation: {
    type: string;
    entity: string;
    rowCount: number;
    userId?: string;
    details?: Record<string, unknown>;
  }): Promise<void> {
    console.log(`[AUDIT] ${operation.type} on ${operation.entity}: ${operation.rowCount} rows`);
  }

  setUser(_userId: string, _roles: string[]): void {
    // Mock implementation - no-op
  }

  // Helper method to view table contents
  getTableData(table: string): Record<string, unknown>[] {
    const tableData = this.tables.get(table);
    return tableData ? Array.from(tableData.values()) : [];
  }
}

// ============================================================================
// CSV Parser Helper
// ============================================================================

function parseCSV(content: string): Record<string, string>[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',');
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });

    rows.push(row);
  }

  return rows;
}

// ============================================================================
// Main Example
// ============================================================================

async function main(): Promise<void> {
  console.log('=== DataSpec Engine - Basic Import Example ===\n');

  // Load the YAML specification
  console.log('1. Parsing YAML specification...');
  const yamlPath = path.join(__dirname, '../specs/users-import.yaml');
  const yamlContent = fs.readFileSync(yamlPath, 'utf-8');

  const parser = new YAMLParser();
  let spec: DataSpecDefinition;

  try {
    spec = parser.parse(yamlContent);
    console.log('   ✓ Specification parsed successfully');
    console.log(`   Entity: ${spec.metadata.entity}`);
    console.log(`   Columns: ${spec.columns.length}`);
  } catch (error) {
    console.error('   ✗ Failed to parse specification:', error);
    process.exit(1);
  }

  // Load the CSV file
  console.log('\n2. Loading CSV file...');
  const csvPath = path.join(__dirname, '../sample-data/users.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const csvData = parseCSV(csvContent);

  console.log(`   ✓ Loaded ${csvData.length} rows from CSV`);

  // Create dependencies
  const adapter = new MockDatabaseAdapter();
  const transformer = new FieldTransformer();
  const lookupResolver = new LookupResolver(adapter);
  const maskingEngine = new MaskingEngine();
  const hookExecutor = new HookExecutor();

  // Create the import executor
  const executor = new ImportExecutor({
    spec,
    adapter,
    transformer,
    lookupResolver,
    maskingEngine,
    hookExecutor,
  });

  // ========================================
  // PREVIEW MODE
  // ========================================
  console.log('\n=== PREVIEW MODE ===\n');
  console.log('3. Previewing import...');

  const preview: PreviewResult = await executor.preview(csvData, { maxRows: 100 });

  console.log('\n   Preview Results:');
  console.log('   ─────────────────────────────────────────────────────────────────');

  // Print header
  const columns = ['first_name', 'last_name', 'email', 'date_of_birth', 'role', 'department'];
  console.log(`   │ ${columns.map((c) => c.padEnd(15)).join(' │ ')} │`);
  console.log('   ├────────────────────────────────────────────────────────────────');

  // Print rows
  for (const row of preview.rows) {
    const values = columns.map((col) => {
      const value = row.data[col];
      const hasError = row.errors.some((e) => e.field === col);

      if (hasError) {
        return '[ERROR]'.padEnd(15);
      }
      return String(value || '').substring(0, 15).padEnd(15);
    });
    console.log(`   │ ${values.join(' │ ')} │`);
  }
  console.log('   ─────────────────────────────────────────────────────────────────');

  console.log(`\n   Summary:`);
  console.log(`   - Total rows: ${preview.totalRows}`);
  console.log(`   - Valid rows: ${preview.validRows}`);
  console.log(`   - Invalid rows: ${preview.invalidRows}`);

  if (preview.errors.length > 0) {
    console.log(`\n   Validation Errors:`);
    for (const error of preview.errors) {
      console.log(`   - Row ${error.rowIndex + 1}: ${error.errors.map((e) => e.message).join(', ')}`);
    }
  }

  // ========================================
  // EXECUTE MODE
  // ========================================
  console.log('\n=== EXECUTE MODE ===\n');
  console.log('4. Executing import (valid rows only)...');

  // Filter to only valid rows for import
  const validData = csvData.filter((_, index) => {
    return !preview.errors.some((e) => e.rowIndex === index);
  });

  const result: ImportResult = await executor.execute(validData);

  console.log(`\n   Import Results:`);
  console.log(`   - Inserted: ${result.inserted}`);
  console.log(`   - Updated: ${result.updated}`);
  console.log(`   - Skipped: ${result.skipped}`);
  console.log(`   - Errors: ${result.errors.length}`);

  // Show the data in the mock database
  console.log('\n5. Verifying data in mock database...');
  const storedData = adapter.getTableData('users');
  console.log(`   ✓ ${storedData.length} records stored`);

  console.log('\n   Stored Records:');
  for (const record of storedData) {
    console.log(`   - ${record.first_name} ${record.last_name} (${record.email})`);
  }

  // ========================================
  // MASKING DEMONSTRATION
  // ========================================
  console.log('\n=== MASKING DEMONSTRATION ===\n');
  console.log('6. Demonstrating field masking...');

  // Show masked date_of_birth
  for (const record of storedData) {
    if (record.date_of_birth) {
      const masked = maskingEngine.mask(
        String(record.date_of_birth),
        {
          mode: 'partial',
          visibleChars: 4,
        }
      );
      console.log(`   ${record.first_name}: DOB = ${masked} (original: ${record.date_of_birth})`);
    }
  }

  console.log('\n=== Example Complete ===');
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
