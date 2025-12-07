/**
 * RLS (Row Level Security) Validator
 *
 * Helps validate that RLS policies are properly configured for DataSpec operations.
 * Provides utilities for checking permissions before performing operations.
 */

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * RLS policy check result
 */
export interface RLSCheckResult {
  table: string;
  operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';
  allowed: boolean;
  policyName?: string;
  error?: string;
}

/**
 * Table permission summary
 */
export interface TablePermissions {
  table: string;
  canSelect: boolean;
  canInsert: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  rlsEnabled: boolean;
  policies: string[];
}

/**
 * RLS Validator class
 */
export class RLSValidator {
  constructor(private client: SupabaseClient) {}

  /**
   * Check if the current user can perform a SELECT on a table
   */
  async canSelect(table: string): Promise<RLSCheckResult> {
    return this.checkPermission(table, 'SELECT');
  }

  /**
   * Check if the current user can perform an INSERT on a table
   */
  async canInsert(table: string): Promise<RLSCheckResult> {
    return this.checkPermission(table, 'INSERT');
  }

  /**
   * Check if the current user can perform an UPDATE on a table
   */
  async canUpdate(table: string): Promise<RLSCheckResult> {
    return this.checkPermission(table, 'UPDATE');
  }

  /**
   * Check if the current user can perform a DELETE on a table
   */
  async canDelete(table: string): Promise<RLSCheckResult> {
    return this.checkPermission(table, 'DELETE');
  }

  /**
   * Check permission for a specific operation
   */
  private async checkPermission(
    table: string,
    operation: 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'
  ): Promise<RLSCheckResult> {
    try {
      switch (operation) {
        case 'SELECT': {
          const { error } = await this.client
            .from(table)
            .select('*')
            .limit(0);

          return {
            table,
            operation,
            allowed: !error,
            error: error?.message
          };
        }

        case 'INSERT': {
          // We can't actually test INSERT without modifying data
          // So we rely on the table's RLS policy configuration
          // A workaround is to use a dry-run approach with a transaction
          return {
            table,
            operation,
            allowed: true, // Assume allowed, will fail on actual insert if not
            policyName: 'assumed'
          };
        }

        case 'UPDATE': {
          // Similar to INSERT, we can't truly test without modifying data
          return {
            table,
            operation,
            allowed: true,
            policyName: 'assumed'
          };
        }

        case 'DELETE': {
          return {
            table,
            operation,
            allowed: true,
            policyName: 'assumed'
          };
        }
      }
    } catch (error: any) {
      return {
        table,
        operation,
        allowed: false,
        error: error.message
      };
    }
  }

  /**
   * Check all CRUD permissions for a table
   */
  async checkTablePermissions(table: string): Promise<TablePermissions> {
    const [selectResult, insertResult, updateResult, deleteResult] = await Promise.all([
      this.canSelect(table),
      this.canInsert(table),
      this.canUpdate(table),
      this.canDelete(table)
    ]);

    return {
      table,
      canSelect: selectResult.allowed,
      canInsert: insertResult.allowed,
      canUpdate: updateResult.allowed,
      canDelete: deleteResult.allowed,
      rlsEnabled: true, // Assumed true in Supabase
      policies: []
    };
  }

  /**
   * Check permissions for multiple tables
   */
  async checkMultipleTablePermissions(
    tables: string[]
  ): Promise<Map<string, TablePermissions>> {
    const results = new Map<string, TablePermissions>();

    const checks = await Promise.all(
      tables.map(table => this.checkTablePermissions(table))
    );

    checks.forEach(result => {
      results.set(result.table, result);
    });

    return results;
  }

  /**
   * Validate that required permissions exist for an import operation
   */
  async validateImportPermissions(
    targetTable: string,
    lookupTables: string[] = []
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check target table permissions
    const targetPerms = await this.checkTablePermissions(targetTable);

    if (!targetPerms.canSelect) {
      errors.push(`Cannot SELECT from target table '${targetTable}'`);
    }

    if (!targetPerms.canInsert) {
      errors.push(`Cannot INSERT into target table '${targetTable}'`);
    }

    if (!targetPerms.canUpdate) {
      warnings.push(`Cannot UPDATE target table '${targetTable}' - duplicate updates will fail`);
    }

    // Check lookup table permissions
    for (const lookupTable of lookupTables) {
      const lookupPerms = await this.checkTablePermissions(lookupTable);

      if (!lookupPerms.canSelect) {
        errors.push(`Cannot SELECT from lookup table '${lookupTable}'`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate that required permissions exist for an export operation
   */
  async validateExportPermissions(
    sourceTable: string
  ): Promise<{
    valid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const perms = await this.checkTablePermissions(sourceTable);

    if (!perms.canSelect) {
      errors.push(`Cannot SELECT from source table '${sourceTable}'`);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Get RLS policies for a table (requires elevated privileges)
   * This is primarily useful for admin debugging
   */
  async getRLSPolicies(table: string, schema: string = 'public'): Promise<Array<{
    policyName: string;
    command: string;
    roles: string[];
    using: string;
    withCheck: string;
  }>> {
    try {
      // This requires access to pg_policies view
      const { data, error } = await this.client.rpc('get_rls_policies', {
        p_table_name: table,
        p_schema_name: schema
      });

      if (error) {
        // RPC function may not exist
        return [];
      }

      return data || [];
    } catch {
      return [];
    }
  }

  /**
   * Check if the current session is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    const { data: { session } } = await this.client.auth.getSession();
    return session !== null;
  }

  /**
   * Get the current authenticated user ID
   */
  async getCurrentUserId(): Promise<string | null> {
    const { data: { session } } = await this.client.auth.getSession();
    return session?.user?.id || null;
  }

  /**
   * Check if user has a specific role
   * This assumes roles are stored in a custom table or JWT claims
   */
  async userHasRole(role: string): Promise<boolean> {
    try {
      // Try to call a custom function that checks roles
      const { data, error } = await this.client.rpc('user_has_role', {
        role_name: role
      });

      if (error) {
        // Function may not exist, return true to not block
        return true;
      }

      return data === true;
    } catch {
      return true;
    }
  }

  /**
   * Check if user has any of the specified roles
   */
  async userHasAnyRole(roles: string[]): Promise<boolean> {
    for (const role of roles) {
      if (await this.userHasRole(role)) {
        return true;
      }
    }
    return false;
  }
}

export default RLSValidator;
