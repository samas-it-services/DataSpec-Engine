/**
 * Supabase Database Adapter
 *
 * Implements the DatabaseAdapter interface for Supabase/PostgreSQL.
 * Provides query building, transaction support, and audit logging.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  DatabaseAdapter,
  QueryBuilder,
  InsertResult,
  UpdateResult,
  DeleteResult,
  Transaction,
  OperationLog,
  OperationMode,
  EntityDefinition,
  EntityOperation,
  isOperationAllowedByMode,
  hasEntityPermission
} from '@samas-it-services/dataspec-core';

/**
 * Database error
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Supabase adapter options
 */
export interface SupabaseAdapterOptions {
  auditTable?: string;
  enableRLS?: boolean;
  defaultSchema?: string;
}

/**
 * Supabase transaction wrapper
 */
class SupabaseTransaction implements Transaction {
  private _isActive: boolean = true;

  constructor(_client: SupabaseClient) {
    // Client reference stored for potential future use with DB functions
    void _client;
  }

  async commit(): Promise<void> {
    // Supabase doesn't expose explicit transaction control
    // Each operation is auto-committed
    this._isActive = false;
  }

  async rollback(): Promise<void> {
    // Supabase doesn't expose explicit rollback
    // This is a limitation - use RPC for true transactions
    this._isActive = false;
  }

  isActive(): boolean {
    return this._isActive;
  }
}

/**
 * Operator mapping for Supabase query builder
 */
const OPERATOR_MAP: Record<string, string> = {
  '=': 'eq',
  '!=': 'neq',
  '<>': 'neq',
  '>': 'gt',
  '>=': 'gte',
  '<': 'lt',
  '<=': 'lte',
  'LIKE': 'like',
  'ILIKE': 'ilike',
  'IN': 'in',
  'IS': 'is',
  'IS NOT': 'not.is'
};

/**
 * Supabase Adapter class
 */
export class SupabaseAdapter implements DatabaseAdapter {
  private userId?: string;
  private userRoles: string[] = [];
  private auditTable: string;

  constructor(
    private client: SupabaseClient,
    options: SupabaseAdapterOptions = {}
  ) {
    this.auditTable = options.auditTable || 'dataspec_operation_logs';
  }

  /**
   * Set the current user context for RLS
   */
  setUser(userId: string, roles: string[]): void {
    this.userId = userId;
    this.userRoles = roles;
  }

  /**
   * Find multiple records
   */
  async find(table: string, query: QueryBuilder): Promise<any[]> {
    let supaQuery = this.client
      .from(table)
      .select(query.select || '*');

    supaQuery = this.applyFilters(supaQuery, query.filters);
    supaQuery = this.applyOrdering(supaQuery, query.orderBy);

    if (query.limit) {
      supaQuery = supaQuery.limit(query.limit);
    }

    if (query.offset) {
      supaQuery = supaQuery.range(query.offset, query.offset + (query.limit || 1000) - 1);
    }

    const { data, error } = await supaQuery;

    if (error) {
      throw new DatabaseError(error.message, error.code, error.details);
    }

    return data || [];
  }

  /**
   * Find a single record
   */
  async findOne(table: string, query: QueryBuilder): Promise<any | null> {
    let supaQuery: any = this.client
      .from(table)
      .select(query.select || '*');

    supaQuery = this.applyFilters(supaQuery, query.filters);
    supaQuery = supaQuery.limit(1).single();

    const { data, error } = await supaQuery;

    if (error) {
      if (error.code === 'PGRST116') {
        // No rows returned - this is expected for findOne
        return null;
      }
      throw new DatabaseError(error.message, error.code, error.details);
    }

    return data;
  }

  /**
   * Insert one or more records
   */
  async insert(table: string, rows: any[]): Promise<InsertResult> {
    if (rows.length === 0) {
      return { insertedCount: 0, insertedIds: [] };
    }

    const { data, error } = await this.client
      .from(table)
      .insert(rows)
      .select();

    if (error) {
      return {
        insertedCount: 0,
        insertedIds: [],
        errors: [{
          row: rows[0],
          error: error.message
        }]
      };
    }

    const insertedIds = data?.map((row: any) => row.id || row[Object.keys(row)[0]]) || [];

    return {
      insertedCount: data?.length || 0,
      insertedIds
    };
  }

  /**
   * Update records
   */
  async update(
    table: string,
    updates: any[],
    where: QueryBuilder
  ): Promise<UpdateResult> {
    if (updates.length === 0) {
      return { updatedCount: 0 };
    }

    // For bulk updates, we need to update each row individually
    // Supabase doesn't support bulk updates with different values per row
    let updatedCount = 0;
    const errors: Array<{ row: any; error: string }> = [];

    for (const update of updates) {
      let supaQuery = this.client.from(table).update(update);
      supaQuery = this.applyFilters(supaQuery, where.filters);

      const { error, count } = await supaQuery;

      if (error) {
        errors.push({ row: update, error: error.message });
      } else {
        updatedCount += count || 1;
      }
    }

    return {
      updatedCount,
      errors: errors.length > 0 ? errors : undefined
    };
  }

  /**
   * Delete records
   */
  async delete(table: string, where: QueryBuilder): Promise<DeleteResult> {
    let supaQuery = this.client.from(table).delete();
    supaQuery = this.applyFilters(supaQuery, where.filters);

    const { error, count } = await supaQuery;

    if (error) {
      return {
        deletedCount: 0,
        errors: [error.message]
      };
    }

    return {
      deletedCount: count || 0
    };
  }

  /**
   * Lookup a record by key(s)
   */
  async lookup(
    table: string,
    key: string | string[],
    value: any | any[]
  ): Promise<any | null> {
    let supaQuery: any = this.client.from(table).select('*');

    if (Array.isArray(key) && Array.isArray(value)) {
      // Composite key lookup
      for (let i = 0; i < key.length; i++) {
        supaQuery = supaQuery.eq(key[i], value[i]);
      }
    } else {
      // Single key lookup
      supaQuery = supaQuery.eq(key as string, value);
    }

    supaQuery = supaQuery.limit(1).maybeSingle();

    const { data, error } = await supaQuery;

    if (error) {
      throw new DatabaseError(error.message, error.code, error.details);
    }

    return data;
  }

  /**
   * Execute operations in a transaction
   * Note: Supabase JS client doesn't support explicit transactions
   * For true ACID transactions, use database functions via RPC
   */
  async transaction(callback: (trx: Transaction) => Promise<void>): Promise<void> {
    const trx = new SupabaseTransaction(this.client);

    try {
      await callback(trx);
      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }

  /**
   * Log an operation for audit trail
   */
  async logOperation(operation: OperationLog): Promise<void> {
    const logEntry = {
      operation_type: operation.operationType,
      spec_id: operation.specId,
      spec_name: operation.specName,
      entity: operation.entity,
      execution_id: operation.executionId,
      user_id: operation.userId || this.userId,
      user_role: operation.userRole || this.userRoles.join(','),
      status: operation.status,
      total_records: operation.totalRecords,
      successful_records: operation.successfulRecords,
      failed_records: operation.failedRecords,
      execution_time_ms: operation.executionTime,
      created_at: operation.timestamp.toISOString(),
      metadata: operation.metadata,
      errors: operation.errors
    };

    const { error } = await this.client
      .from(this.auditTable)
      .insert(logEntry);

    if (error) {
      // Log error but don't throw - audit logging should not fail the operation
      console.error('Failed to log operation:', error.message);
    }
  }

  /**
   * Apply filters to a Supabase query
   */
  private applyFilters(
    query: any,
    filters: QueryBuilder['filters']
  ): any {
    if (!filters || filters.length === 0) {
      return query;
    }

    for (const filter of filters) {
      const method = OPERATOR_MAP[filter.operator.toUpperCase()] || 'eq';

      switch (method) {
        case 'eq':
          query = query.eq(filter.field, filter.value);
          break;
        case 'neq':
          query = query.neq(filter.field, filter.value);
          break;
        case 'gt':
          query = query.gt(filter.field, filter.value);
          break;
        case 'gte':
          query = query.gte(filter.field, filter.value);
          break;
        case 'lt':
          query = query.lt(filter.field, filter.value);
          break;
        case 'lte':
          query = query.lte(filter.field, filter.value);
          break;
        case 'like':
          query = query.like(filter.field, filter.value);
          break;
        case 'ilike':
          query = query.ilike(filter.field, filter.value);
          break;
        case 'in':
          query = query.in(filter.field, filter.value);
          break;
        case 'is':
          query = query.is(filter.field, filter.value);
          break;
        default:
          query = query.eq(filter.field, filter.value);
      }
    }

    return query;
  }

  /**
   * Apply ordering to a Supabase query
   */
  private applyOrdering(
    query: any,
    orderBy?: QueryBuilder['orderBy']
  ): any {
    if (!orderBy || orderBy.length === 0) {
      return query;
    }

    for (const order of orderBy) {
      query = query.order(order.field, { ascending: order.direction === 'asc' });
    }

    return query;
  }

  /**
   * Execute a raw SQL query via RPC
   * Useful for complex operations not supported by the query builder
   */
  async executeRpc<T = any>(
    functionName: string,
    params: Record<string, any> = {}
  ): Promise<T> {
    const { data, error } = await this.client.rpc(functionName, params);

    if (error) {
      throw new DatabaseError(error.message, error.code, error.details);
    }

    return data as T;
  }

  /**
   * Get the current user ID
   */
  getUserId(): string | undefined {
    return this.userId;
  }

  /**
   * Get the current user roles
   */
  getUserRoles(): string[] {
    return [...this.userRoles];
  }

  /**
   * Check if a table exists
   */
  async tableExists(table: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from(table)
        .select('*')
        .limit(0);

      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Get table columns metadata
   */
  async getTableColumns(table: string): Promise<Array<{
    name: string;
    type: string;
    nullable: boolean;
  }>> {
    // This requires access to information_schema which may need elevated privileges
    // For now, we use a workaround by selecting a single row
    try {
      const { data } = await this.client
        .from(table)
        .select('*')
        .limit(1);

      if (data && data.length > 0) {
        return Object.keys(data[0]).map(name => ({
          name,
          type: 'unknown', // Would need pg_catalog access for actual types
          nullable: true
        }));
      }

      return [];
    } catch {
      return [];
    }
  }

  /**
   * Upsert records (insert or update)
   */
  async upsert(
    table: string,
    rows: any[],
    onConflict: string | string[]
  ): Promise<InsertResult> {
    if (rows.length === 0) {
      return { insertedCount: 0, insertedIds: [] };
    }

    const conflictColumns = Array.isArray(onConflict) ? onConflict.join(',') : onConflict;

    const { data, error } = await this.client
      .from(table)
      .upsert(rows, { onConflict: conflictColumns })
      .select();

    if (error) {
      return {
        insertedCount: 0,
        insertedIds: [],
        errors: [{
          row: rows[0],
          error: error.message
        }]
      };
    }

    const insertedIds = data?.map((row: any) => row.id || row[Object.keys(row)[0]]) || [];

    return {
      insertedCount: data?.length || 0,
      insertedIds
    };
  }

  /**
   * Count records matching a query
   */
  async count(table: string, query?: QueryBuilder): Promise<number> {
    let supaQuery = this.client
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (query?.filters) {
      supaQuery = this.applyFilters(supaQuery, query.filters);
    }

    const { count, error } = await supaQuery;

    if (error) {
      throw new DatabaseError(error.message, error.code, error.details);
    }

    return count || 0;
  }

  // ==========================================================================
  // Entity Permission Methods
  // ==========================================================================

  /**
   * Fetch all enabled entities from dataspec_entities table
   */
  async getEntities(): Promise<EntityDefinition[]> {
    const { data, error } = await this.client
      .from('dataspec_entities')
      .select('*')
      .eq('enabled', true)
      .order('category')
      .order('sort_order');

    if (error) {
      throw new DatabaseError(error.message, error.code, error.details);
    }

    return (data || []).map(this.mapEntityRow);
  }

  /**
   * Fetch entities that the current user can view
   */
  async getEntitiesForUser(operation?: EntityOperation): Promise<EntityDefinition[]> {
    const allEntities = await this.getEntities();

    return allEntities.filter(entity => {
      // If operation specified, check that specific operation
      if (operation) {
        return hasEntityPermission(entity, operation, this.userRoles);
      }
      // Default to view permission
      return hasEntityPermission(entity, 'view', this.userRoles);
    });
  }

  /**
   * Get a single entity by name
   */
  async getEntityByName(name: string): Promise<EntityDefinition | null> {
    const { data, error } = await this.client
      .from('dataspec_entities')
      .select('*')
      .eq('name', name)
      .eq('enabled', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new DatabaseError(error.message, error.code, error.details);
    }

    return data ? this.mapEntityRow(data) : null;
  }

  /**
   * Check if the current user can perform an operation on an entity
   */
  canPerformOperation(entity: EntityDefinition, operation: EntityOperation): boolean {
    return hasEntityPermission(entity, operation, this.userRoles);
  }

  /**
   * Check if an operation is allowed by the entity's mode (ignores roles)
   */
  isOperationAllowedByMode(entity: EntityDefinition, operation: EntityOperation): boolean {
    return isOperationAllowedByMode(entity.operationMode, operation);
  }

  /**
   * Map a database row to EntityDefinition
   */
  private mapEntityRow(row: any): EntityDefinition {
    return {
      id: row.id,
      name: row.name,
      displayName: row.display_name,
      description: row.description,
      tableName: row.table_name,
      operationMode: row.operation_mode as OperationMode || OperationMode.FULL,
      permissions: {
        viewRoles: row.view_roles || ['super_admin'],
        importRoles: row.import_roles || ['super_admin'],
        exportRoles: row.export_roles || ['super_admin']
      },
      category: row.category || 'general',
      sortOrder: row.sort_order || 0,
      icon: row.icon,
      enabled: row.enabled !== false,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }
}

export default SupabaseAdapter;
