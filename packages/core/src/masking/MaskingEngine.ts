/**
 * Masking Engine
 *
 * Handles data masking and unmasking based on sensitivity levels and user roles.
 * Supports multiple masking modes: full, partial, regex, and custom.
 */

import {
  MaskingConfig,
  MaskingMode,
  SensitivityLevel,
  ColumnMapping
} from '../types/spec.types';

/**
 * Masking error
 */
export class MaskingError extends Error {
  constructor(
    message: string,
    public field: string,
    public mode: MaskingMode,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'MaskingError';
  }
}

/**
 * Role configuration for sensitivity access
 */
export interface RoleConfig {
  [role: string]: SensitivityLevel[];
}

/**
 * Masking result
 */
export interface MaskingResult {
  field: string;
  originalValue: any;
  maskedValue: any;
  wasMasked: boolean;
}

/**
 * Unmask request
 */
export interface UnmaskRequest {
  field: string;
  maskedValue: any;
  column: ColumnMapping;
}

/**
 * Default masking character
 */
const DEFAULT_MASK_CHAR = '*';

/**
 * Default role to sensitivity level mapping
 */
const DEFAULT_ROLE_CONFIG: RoleConfig = {
  admin: [
    SensitivityLevel.PUBLIC,
    SensitivityLevel.INTERNAL,
    SensitivityLevel.CONFIDENTIAL,
    SensitivityLevel.SECRET,
    SensitivityLevel.HIGHLY_RESTRICTED
  ],
  manager: [
    SensitivityLevel.PUBLIC,
    SensitivityLevel.INTERNAL,
    SensitivityLevel.CONFIDENTIAL
  ],
  user: [
    SensitivityLevel.PUBLIC,
    SensitivityLevel.INTERNAL
  ],
  guest: [
    SensitivityLevel.PUBLIC
  ]
};

/**
 * Masking Engine class
 */
export class MaskingEngine {
  private roleConfig: RoleConfig;
  private maskChar: string;

  constructor(options: {
    roleConfig?: RoleConfig;
    maskChar?: string;
  } = {}) {
    this.roleConfig = options.roleConfig || DEFAULT_ROLE_CONFIG;
    this.maskChar = options.maskChar || DEFAULT_MASK_CHAR;
  }

  /**
   * Check if a user role can access a sensitivity level
   */
  canAccess(userRoles: string[], sensitivity: SensitivityLevel): boolean {
    for (const role of userRoles) {
      const allowedLevels = this.roleConfig[role] || [];
      if (allowedLevels.includes(sensitivity)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if a user can unmask a specific field
   */
  canUnmask(userRoles: string[], column: ColumnMapping): boolean {
    if (!column.masking) {
      return true;
    }

    if (column.unmaskPermissions && column.unmaskPermissions.length > 0) {
      return userRoles.some(role => column.unmaskPermissions!.includes(role));
    }

    return this.canAccess(userRoles, column.sensitivity);
  }

  /**
   * Mask a single value based on configuration
   */
  mask(value: any, config: MaskingConfig, fieldName: string): any {
    if (value === null || value === undefined) {
      return value;
    }

    try {
      switch (config.mode) {
        case MaskingMode.FULL:
          return this.maskFull(value, config);

        case MaskingMode.PARTIAL:
          return this.maskPartial(value, config);

        case MaskingMode.REGEX:
          return this.maskRegex(value, config);

        case MaskingMode.CUSTOM:
          return this.maskCustom(value, config, fieldName);

        default:
          throw new Error(`Unknown masking mode: ${config.mode}`);
      }
    } catch (error: any) {
      throw new MaskingError(
        `Masking failed for field ${fieldName}: ${error.message}`,
        fieldName,
        config.mode,
        error
      );
    }
  }

  /**
   * Apply full masking - replace entire value
   */
  private maskFull(value: any, config: MaskingConfig): string {
    const str = String(value);
    const replacement = config.replacement || this.maskChar;
    return replacement.repeat(str.length);
  }

  /**
   * Apply partial masking - show start and end characters
   */
  private maskPartial(value: any, config: MaskingConfig): string {
    const str = String(value);
    const start = config.partialStart ?? 0;
    const end = config.partialEnd ?? 0;

    if (start + end >= str.length) {
      return this.maskFull(value, config);
    }

    const replacement = config.replacement || this.maskChar;
    const maskLength = str.length - start - end;

    return (
      str.substring(0, start) +
      replacement.repeat(maskLength) +
      str.substring(str.length - end)
    );
  }

  /**
   * Apply regex masking - mask matched portions
   */
  private maskRegex(value: any, config: MaskingConfig): string {
    const str = String(value);

    if (!config.regexPattern) {
      throw new Error('Regex pattern is required for regex masking mode');
    }

    const regex = new RegExp(config.regexPattern, 'g');
    const replacement = config.replacement || this.maskChar;

    return str.replace(regex, (match) => replacement.repeat(match.length));
  }

  /**
   * Apply custom masking using JavaScript
   */
  private maskCustom(value: any, config: MaskingConfig, fieldName: string): any {
    if (!config.customScript) {
      throw new Error('Custom script is required for custom masking mode');
    }

    try {
      const fn = new Function('value', 'fieldName', 'maskChar', `
        "use strict";
        ${config.customScript}
      `);

      return fn(value, fieldName, this.maskChar);
    } catch (error: any) {
      throw new Error(`Custom masking script failed: ${error.message}`);
    }
  }

  /**
   * Mask a field value based on column configuration and user roles
   */
  maskField(
    value: any,
    column: ColumnMapping,
    userRoles: string[]
  ): MaskingResult {
    const result: MaskingResult = {
      field: column.name,
      originalValue: value,
      maskedValue: value,
      wasMasked: false
    };

    if (!column.masking) {
      return result;
    }

    if (this.canAccess(userRoles, column.sensitivity)) {
      return result;
    }

    result.maskedValue = this.mask(value, column.masking, column.name);
    result.wasMasked = true;

    return result;
  }

  /**
   * Mask multiple fields in a row
   */
  maskRow(
    row: Record<string, any>,
    columns: ColumnMapping[],
    userRoles: string[]
  ): {
    maskedRow: Record<string, any>;
    results: MaskingResult[];
  } {
    const maskedRow: Record<string, any> = { ...row };
    const results: MaskingResult[] = [];

    for (const column of columns) {
      if (column.name in row) {
        const result = this.maskField(row[column.name], column, userRoles);
        maskedRow[column.name] = result.maskedValue;
        results.push(result);
      }
    }

    return { maskedRow, results };
  }

  /**
   * Mask all rows in a dataset
   */
  maskDataset(
    rows: Record<string, any>[],
    columns: ColumnMapping[],
    userRoles: string[]
  ): {
    maskedRows: Record<string, any>[];
    totalMasked: number;
  } {
    const maskedRows: Record<string, any>[] = [];
    let totalMasked = 0;

    for (const row of rows) {
      const { maskedRow, results } = this.maskRow(row, columns, userRoles);
      maskedRows.push(maskedRow);
      totalMasked += results.filter(r => r.wasMasked).length;
    }

    return { maskedRows, totalMasked };
  }

  /**
   * Unmask a value (requires permission check)
   * Note: This only works for reversible masking or when original value is stored
   */
  unmask(
    request: UnmaskRequest,
    userRoles: string[],
    originalValue?: any
  ): {
    success: boolean;
    value: any;
    error?: string;
  } {
    if (!this.canUnmask(userRoles, request.column)) {
      return {
        success: false,
        value: request.maskedValue,
        error: `Insufficient permissions to unmask field ${request.field}`
      };
    }

    if (originalValue !== undefined) {
      return {
        success: true,
        value: originalValue
      };
    }

    return {
      success: false,
      value: request.maskedValue,
      error: 'Original value not available for unmasking'
    };
  }

  /**
   * Get all fields that should be masked for given roles
   */
  getFieldsToMask(
    columns: ColumnMapping[],
    userRoles: string[]
  ): ColumnMapping[] {
    return columns.filter(column => {
      if (!column.masking) return false;
      return !this.canAccess(userRoles, column.sensitivity);
    });
  }

  /**
   * Get sensitivity level access for a role
   */
  getRoleAccess(role: string): SensitivityLevel[] {
    return this.roleConfig[role] || [];
  }

  /**
   * Update role configuration
   */
  setRoleConfig(roleConfig: RoleConfig): void {
    this.roleConfig = roleConfig;
  }

  /**
   * Add or update a role's access levels
   */
  setRoleAccess(role: string, levels: SensitivityLevel[]): void {
    this.roleConfig[role] = levels;
  }

  /**
   * Create common masking configurations
   */
  static createMaskingConfig(
    type: 'email' | 'phone' | 'ssn' | 'creditCard' | 'name'
  ): MaskingConfig {
    switch (type) {
      case 'email':
        return {
          mode: MaskingMode.REGEX,
          regexPattern: '(?<=.{2}).(?=[^@]*?@)',
          replacement: '*'
        };

      case 'phone':
        return {
          mode: MaskingMode.PARTIAL,
          partialStart: 0,
          partialEnd: 4,
          replacement: '*'
        };

      case 'ssn':
        return {
          mode: MaskingMode.PARTIAL,
          partialStart: 0,
          partialEnd: 4,
          replacement: '*'
        };

      case 'creditCard':
        return {
          mode: MaskingMode.PARTIAL,
          partialStart: 0,
          partialEnd: 4,
          replacement: '*'
        };

      case 'name':
        return {
          mode: MaskingMode.PARTIAL,
          partialStart: 1,
          partialEnd: 0,
          replacement: '*'
        };

      default:
        return {
          mode: MaskingMode.FULL,
          replacement: '*'
        };
    }
  }
}

export default MaskingEngine;
