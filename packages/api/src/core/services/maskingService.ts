import {
  MaskResult,
  UnmaskResult,
  SensitivityLevel,
  DatabaseAdapter,
  AuthUser,
  AuthorizationException,
  ValidationException,
  InternalServerException,
} from '../types';

export interface MaskingServiceDependencies {
  db: DatabaseAdapter;
}

interface MaskingOptions {
  visibleChars?: number;
  pattern?: string;
  replacement?: string;
}

// Role requirements for each sensitivity level
const SENSITIVITY_ROLE_MAP: Record<SensitivityLevel, string[]> = {
  [SensitivityLevel.PUBLIC]: [],
  [SensitivityLevel.INTERNAL]: ['internal', 'confidential', 'admin'],
  [SensitivityLevel.CONFIDENTIAL]: ['confidential', 'admin'],
  [SensitivityLevel.SECRET]: ['secret', 'admin'],
  [SensitivityLevel.HIGHLY_RESTRICTED]: ['highly_restricted', 'super_admin'],
};

export class MaskingService {
  private db: DatabaseAdapter;

  constructor(deps: MaskingServiceDependencies) {
    this.db = deps.db;
  }

  /**
   * Mask a value based on sensitivity and mode
   * @param _sensitivity - Sensitivity level (available for future use with role-based masking)
   */
  mask(
    value: string,
    _sensitivity: SensitivityLevel,
    mode: 'full' | 'partial' | 'regex' | 'custom',
    options?: MaskingOptions
  ): string {
    if (!value || value.length === 0) {
      return value;
    }

    switch (mode) {
      case 'full':
        return this.maskFull(value, options);
      case 'partial':
        return this.maskPartial(value, options);
      case 'regex':
        return this.maskRegex(value, options);
      case 'custom':
        return this.maskCustom(value, options);
      default:
        return this.maskFull(value, options);
    }
  }

  /**
   * Full masking - replace entire value
   */
  private maskFull(value: string, options?: MaskingOptions): string {
    const replacement = options?.replacement || '*';
    return replacement.repeat(Math.min(value.length, 10));
  }

  /**
   * Partial masking - show some characters
   */
  private maskPartial(value: string, options?: MaskingOptions): string {
    const visibleChars = options?.visibleChars || 3;
    const replacement = options?.replacement || '*';

    if (value.length <= visibleChars * 2) {
      return replacement.repeat(value.length);
    }

    const start = value.substring(0, visibleChars);
    const end = value.substring(value.length - visibleChars);
    const middle = replacement.repeat(Math.min(value.length - visibleChars * 2, 5));

    return `${start}${middle}${end}`;
  }

  /**
   * Regex-based masking
   */
  private maskRegex(value: string, options?: MaskingOptions): string {
    const pattern = options?.pattern;
    const replacement = options?.replacement || '***';

    if (!pattern) {
      return this.maskFull(value, options);
    }

    try {
      const regex = new RegExp(pattern, 'g');
      return value.replace(regex, replacement);
    } catch {
      return this.maskFull(value, options);
    }
  }

  /**
   * Custom masking (placeholder - would call hook in real implementation)
   */
  private maskCustom(value: string, options?: MaskingOptions): string {
    // Custom masking would typically call a user-defined hook
    // For now, fall back to partial masking
    return this.maskPartial(value, options);
  }

  /**
   * Mask value and return result with metadata
   */
  maskWithResult(
    value: string,
    sensitivity: SensitivityLevel,
    mode: 'full' | 'partial' | 'regex' | 'custom',
    options?: MaskingOptions
  ): MaskResult {
    return {
      maskedValue: this.mask(value, sensitivity, mode, options),
      sensitivity,
      maskingMode: mode,
    };
  }

  /**
   * Check if user can unmask a field with given sensitivity
   */
  canUnmask(userRoles: string[], sensitivity: SensitivityLevel): boolean {
    if (sensitivity === SensitivityLevel.PUBLIC) {
      return true;
    }

    const requiredRoles = SENSITIVITY_ROLE_MAP[sensitivity];
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    return userRoles.some((role) =>
      requiredRoles.includes(role.toLowerCase())
    );
  }

  /**
   * Unmask a value (retrieve original value)
   */
  async unmask(
    specId: string,
    fieldName: string,
    _maskedValue: string,
    rowId: string,
    user: AuthUser,
    reason?: string
  ): Promise<UnmaskResult> {
    try {
      // Get the spec to determine sensitivity level
      const specResult = await this.db.findOne('dataspec_definitions', {
        filters: [{ field: 'id', operator: 'eq', value: specId }],
      });

      if (!specResult) {
        throw new ValidationException(`Spec ${specId} not found`);
      }

      // Get field definition from spec
      const spec = specResult as Record<string, unknown>;
      const yamlContent = spec.yaml_content as string;

      // Parse YAML to get field sensitivity (simplified)
      const sensitivity = this.getFieldSensitivity(yamlContent, fieldName);

      // Check permission
      if (!this.canUnmask(user.roles, sensitivity)) {
        throw new AuthorizationException(
          `Insufficient permissions to unmask field with sensitivity level: ${sensitivity}`
        );
      }

      // Get the original value from database
      const tableName = this.getTableName(yamlContent);
      const row = await this.db.findOne(tableName, {
        filters: [{ field: 'id', operator: 'eq', value: rowId }],
      });

      if (!row) {
        throw new ValidationException(`Row ${rowId} not found`);
      }

      const originalValue = (row as Record<string, unknown>)[fieldName];

      // Log the unmask event
      const auditId = await this.logUnmaskEvent(
        specId,
        fieldName,
        rowId,
        user,
        reason
      );

      return {
        success: true,
        value: originalValue !== null && originalValue !== undefined
          ? String(originalValue)
          : undefined,
        auditId,
      };
    } catch (error) {
      if (
        error instanceof AuthorizationException ||
        error instanceof ValidationException
      ) {
        throw error;
      }
      throw new InternalServerException(
        `Failed to unmask value: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get field sensitivity from YAML content
   */
  private getFieldSensitivity(yamlContent: string, fieldName: string): SensitivityLevel {
    // Simplified parsing - in production, use proper YAML parser
    const match = new RegExp(
      `name:\\s*${fieldName}[\\s\\S]*?sensitivity:\\s*(\\w+)`,
      'i'
    ).exec(yamlContent);

    if (match && match[1]) {
      const level = match[1].toLowerCase();
      if (Object.values(SensitivityLevel).includes(level as SensitivityLevel)) {
        return level as SensitivityLevel;
      }
    }

    return SensitivityLevel.PUBLIC;
  }

  /**
   * Get table name from YAML content
   */
  private getTableName(yamlContent: string): string {
    const match = /database:\s*[\s\S]*?table:\s*(\w+)/i.exec(yamlContent);
    return match ? match[1] : '';
  }

  /**
   * Log unmask event for audit trail
   */
  private async logUnmaskEvent(
    specId: string,
    fieldName: string,
    rowId: string,
    user: AuthUser,
    reason?: string
  ): Promise<string> {
    try {
      const result = await this.db.insert('unmask_audit_log', [
        {
          spec_id: specId,
          user_id: user.id,
          field_name: fieldName,
          row_id: rowId,
          reason: reason || 'No reason provided',
          created_at: new Date().toISOString(),
        },
      ]);

      return result.insertedIds?.[0] || 'audit-logged';
    } catch {
      // Log failure shouldn't block unmask operation
      return 'audit-failed';
    }
  }

  /**
   * Get masking statistics for a spec
   */
  async getMaskingStats(specId: string): Promise<{
    maskedFieldCount: number;
    sensitivityBreakdown: Record<SensitivityLevel, number>;
  }> {
    try {
      const specResult = await this.db.findOne('dataspec_definitions', {
        filters: [{ field: 'id', operator: 'eq', value: specId }],
      });

      if (!specResult) {
        return {
          maskedFieldCount: 0,
          sensitivityBreakdown: {
            [SensitivityLevel.PUBLIC]: 0,
            [SensitivityLevel.INTERNAL]: 0,
            [SensitivityLevel.CONFIDENTIAL]: 0,
            [SensitivityLevel.SECRET]: 0,
            [SensitivityLevel.HIGHLY_RESTRICTED]: 0,
          },
        };
      }

      const spec = specResult as Record<string, unknown>;
      const yamlContent = spec.yaml_content as string;

      // Count fields by sensitivity (simplified)
      const breakdown: Record<SensitivityLevel, number> = {
        [SensitivityLevel.PUBLIC]: 0,
        [SensitivityLevel.INTERNAL]: 0,
        [SensitivityLevel.CONFIDENTIAL]: 0,
        [SensitivityLevel.SECRET]: 0,
        [SensitivityLevel.HIGHLY_RESTRICTED]: 0,
      };

      let maskedCount = 0;

      // Simple regex to count sensitivity levels
      const sensitivityMatches = yamlContent.matchAll(/sensitivity:\s*(\w+)/gi);
      for (const match of sensitivityMatches) {
        const level = match[1].toLowerCase() as SensitivityLevel;
        if (Object.values(SensitivityLevel).includes(level)) {
          breakdown[level]++;
          if (level !== SensitivityLevel.PUBLIC) {
            maskedCount++;
          }
        }
      }

      return {
        maskedFieldCount: maskedCount,
        sensitivityBreakdown: breakdown,
      };
    } catch {
      return {
        maskedFieldCount: 0,
        sensitivityBreakdown: {
          [SensitivityLevel.PUBLIC]: 0,
          [SensitivityLevel.INTERNAL]: 0,
          [SensitivityLevel.CONFIDENTIAL]: 0,
          [SensitivityLevel.SECRET]: 0,
          [SensitivityLevel.HIGHLY_RESTRICTED]: 0,
        },
      };
    }
  }
}
