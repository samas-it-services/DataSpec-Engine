import {
  SpecDefinition,
  GetSpecsResponse,
  ValidateSpecResponse,
  ValidationError,
  ValidationWarning,
  ParsedSpec,
  DatabaseAdapter,
  NotFoundException,
  ValidationException,
  InternalServerException,
  SensitivityLevel,
} from '../types';
import * as yaml from 'yaml';

export interface SpecServiceDependencies {
  db: DatabaseAdapter;
}

// YAML Schema structure based on PRD
interface YAMLSpec {
  version: string;
  metadata: {
    entity: string;
    name: string;
    description?: string;
  };
  database: {
    table: string;
    schema?: string;
  };
  columns: YAMLColumn[];
  hooks?: YAMLHook[];
  importOptions?: {
    batchSize?: number;
    skipHeader?: boolean;
    delimiter?: string;
  };
  exportOptions?: {
    includeHeader?: boolean;
    delimiter?: string;
  };
}

interface YAMLColumn {
  name: string;
  source: string;
  type: string;
  required?: boolean;
  sensitivity?: string;
  validation?: YAMLValidation[];
  transform?: YAMLTransform[];
  lookup?: YAMLLookup;
  masking?: YAMLMasking;
  default?: unknown;
}

interface YAMLValidation {
  type: string;
  value?: unknown;
  message?: string;
}

interface YAMLTransform {
  type: string;
  [key: string]: unknown;
}

interface YAMLLookup {
  table: string;
  key: string | string[];
  return: string;
  fallback?: 'error' | 'skip' | 'default';
  defaultValue?: unknown;
}

interface YAMLMasking {
  mode: 'full' | 'partial' | 'regex' | 'custom';
  visibleChars?: number;
  pattern?: string;
  replacement?: string;
}

interface YAMLHook {
  point: string;
  handler: string;
}

export class SpecService {
  private db: DatabaseAdapter;

  constructor(deps: SpecServiceDependencies) {
    this.db = deps.db;
  }

  /**
   * Get all specs for an entity
   */
  async getSpecs(entityId: string, includeVersions: boolean = false): Promise<GetSpecsResponse> {
    try {
      const query = {
        select: [
          'id',
          'entity_id',
          'name',
          'version',
          'description',
          'is_active',
          'created_at',
          'updated_at',
          ...(includeVersions ? ['yaml_content'] : []),
        ],
        filters: [
          { field: 'entity_id', operator: 'eq' as const, value: entityId },
          { field: 'is_active', operator: 'eq' as const, value: true },
        ],
        orderBy: [
          { field: 'name', direction: 'asc' as const },
          { field: 'version', direction: 'desc' as const },
        ],
      };

      const results = await this.db.find('dataspec_definitions', query);

      const specs: SpecDefinition[] = results.map((row: unknown) => {
        const r = row as Record<string, unknown>;
        return {
          id: r.id as string,
          entityId: r.entity_id as string,
          name: r.name as string,
          version: r.version as string,
          description: r.description as string | undefined,
          yamlContent: includeVersions ? (r.yaml_content as string | undefined) : undefined,
          isActive: r.is_active as boolean,
          createdAt: new Date(r.created_at as string),
          updatedAt: new Date(r.updated_at as string),
        };
      });

      return {
        specs,
        total: specs.length,
      };
    } catch (error) {
      throw new InternalServerException(
        `Failed to fetch specs: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get a single spec by ID
   */
  async getSpecById(specId: string): Promise<SpecDefinition> {
    try {
      const result = await this.db.findOne('dataspec_definitions', {
        filters: [{ field: 'id', operator: 'eq', value: specId }],
      });

      if (!result) {
        throw new NotFoundException('Spec', specId);
      }

      const r = result as Record<string, unknown>;
      return {
        id: r.id as string,
        entityId: r.entity_id as string,
        name: r.name as string,
        version: r.version as string,
        description: r.description as string | undefined,
        yamlContent: r.yaml_content as string | undefined,
        isActive: r.is_active as boolean,
        createdAt: new Date(r.created_at as string),
        updatedAt: new Date(r.updated_at as string),
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }
      throw new InternalServerException(
        `Failed to fetch spec: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Check if spec exists
   */
  async specExists(specId: string): Promise<boolean> {
    try {
      const result = await this.db.findOne('dataspec_definitions', {
        select: ['id'],
        filters: [{ field: 'id', operator: 'eq', value: specId }],
      });
      return result !== null;
    } catch {
      return false;
    }
  }

  /**
   * Validate YAML spec content
   */
  validateYaml(yamlContent: string): ValidateSpecResponse {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    let parsedSpec: ParsedSpec | undefined;

    try {
      // Parse YAML
      const spec = yaml.parse(yamlContent) as YAMLSpec;

      // Validate required fields
      if (!spec.version) {
        errors.push({
          path: 'version',
          message: 'Version is required',
          code: 'REQUIRED_FIELD',
        });
      }

      if (!spec.metadata) {
        errors.push({
          path: 'metadata',
          message: 'Metadata section is required',
          code: 'REQUIRED_FIELD',
        });
      } else {
        if (!spec.metadata.entity) {
          errors.push({
            path: 'metadata.entity',
            message: 'Entity name is required',
            code: 'REQUIRED_FIELD',
          });
        }
        if (!spec.metadata.name) {
          errors.push({
            path: 'metadata.name',
            message: 'Spec name is required',
            code: 'REQUIRED_FIELD',
          });
        }
      }

      if (!spec.database) {
        errors.push({
          path: 'database',
          message: 'Database section is required',
          code: 'REQUIRED_FIELD',
        });
      } else if (!spec.database.table) {
        errors.push({
          path: 'database.table',
          message: 'Database table name is required',
          code: 'REQUIRED_FIELD',
        });
      }

      if (!spec.columns || !Array.isArray(spec.columns) || spec.columns.length === 0) {
        errors.push({
          path: 'columns',
          message: 'At least one column definition is required',
          code: 'REQUIRED_FIELD',
        });
      } else {
        // Validate each column
        spec.columns.forEach((col, index) => {
          const columnErrors = this.validateColumn(col, index);
          errors.push(...columnErrors.errors);
          warnings.push(...columnErrors.warnings);
        });
      }

      // Validate hooks if present
      if (spec.hooks) {
        spec.hooks.forEach((hook, index) => {
          if (!hook.point) {
            errors.push({
              path: `hooks[${index}].point`,
              message: 'Hook point is required',
              code: 'REQUIRED_FIELD',
            });
          } else if (!this.isValidHookPoint(hook.point)) {
            errors.push({
              path: `hooks[${index}].point`,
              message: `Invalid hook point: ${hook.point}`,
              code: 'INVALID_HOOK_POINT',
            });
          }
          if (!hook.handler) {
            errors.push({
              path: `hooks[${index}].handler`,
              message: 'Hook handler is required',
              code: 'REQUIRED_FIELD',
            });
          }
        });
      }

      // Build parsed spec if no critical errors
      if (errors.length === 0) {
        parsedSpec = {
          version: spec.version,
          entity: spec.metadata?.entity || '',
          columns: spec.columns?.map((col) => ({
            name: col.name,
            source: col.source,
            type: col.type,
            required: col.required ?? false,
            sensitivity: col.sensitivity as SensitivityLevel | undefined,
          })) || [],
          hooks: spec.hooks?.map((h) => h.point),
        };
      }

      return {
        valid: errors.length === 0,
        errors,
        warnings,
        parsedSpec,
      };
    } catch (error) {
      if (error instanceof yaml.YAMLParseError) {
        errors.push({
          path: '',
          message: `YAML parse error: ${error.message}`,
          code: 'YAML_PARSE_ERROR',
        });
      } else {
        errors.push({
          path: '',
          message: `Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          code: 'VALIDATION_ERROR',
        });
      }

      return {
        valid: false,
        errors,
        warnings,
        parsedSpec: undefined,
      };
    }
  }

  /**
   * Validate a single column definition
   */
  private validateColumn(
    col: YAMLColumn,
    index: number
  ): { errors: ValidationError[]; warnings: ValidationWarning[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const prefix = `columns[${index}]`;

    if (!col.name) {
      errors.push({
        path: `${prefix}.name`,
        message: 'Column name is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!col.source) {
      errors.push({
        path: `${prefix}.source`,
        message: 'Source column is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!col.type) {
      errors.push({
        path: `${prefix}.type`,
        message: 'Column type is required',
        code: 'REQUIRED_FIELD',
      });
    } else if (!this.isValidColumnType(col.type)) {
      errors.push({
        path: `${prefix}.type`,
        message: `Invalid column type: ${col.type}`,
        code: 'INVALID_TYPE',
      });
    }

    // Validate sensitivity level
    if (col.sensitivity && !this.isValidSensitivity(col.sensitivity)) {
      errors.push({
        path: `${prefix}.sensitivity`,
        message: `Invalid sensitivity level: ${col.sensitivity}`,
        code: 'INVALID_SENSITIVITY',
      });
    }

    // Validate masking configuration
    if (col.masking) {
      if (!col.sensitivity) {
        warnings.push({
          path: `${prefix}.masking`,
          message: 'Masking is defined but no sensitivity level is set',
          suggestion: 'Consider adding a sensitivity level',
        });
      }
      if (!['full', 'partial', 'regex', 'custom'].includes(col.masking.mode)) {
        errors.push({
          path: `${prefix}.masking.mode`,
          message: `Invalid masking mode: ${col.masking.mode}`,
          code: 'INVALID_MASKING_MODE',
        });
      }
    }

    // Validate lookup configuration
    if (col.lookup) {
      if (!col.lookup.table) {
        errors.push({
          path: `${prefix}.lookup.table`,
          message: 'Lookup table is required',
          code: 'REQUIRED_FIELD',
        });
      }
      if (!col.lookup.key) {
        errors.push({
          path: `${prefix}.lookup.key`,
          message: 'Lookup key is required',
          code: 'REQUIRED_FIELD',
        });
      }
      if (!col.lookup.return) {
        errors.push({
          path: `${prefix}.lookup.return`,
          message: 'Lookup return field is required',
          code: 'REQUIRED_FIELD',
        });
      }
    }

    // Validate transforms
    if (col.transform) {
      col.transform.forEach((t, tIndex) => {
        if (!t.type) {
          errors.push({
            path: `${prefix}.transform[${tIndex}].type`,
            message: 'Transform type is required',
            code: 'REQUIRED_FIELD',
          });
        } else if (!this.isValidTransformType(t.type)) {
          errors.push({
            path: `${prefix}.transform[${tIndex}].type`,
            message: `Invalid transform type: ${t.type}`,
            code: 'INVALID_TRANSFORM_TYPE',
          });
        }
      });
    }

    return { errors, warnings };
  }

  private isValidColumnType(type: string): boolean {
    const validTypes = [
      'string',
      'number',
      'integer',
      'boolean',
      'date',
      'datetime',
      'timestamp',
      'uuid',
      'json',
      'array',
    ];
    return validTypes.includes(type.toLowerCase());
  }

  private isValidSensitivity(level: string): boolean {
    const validLevels = ['public', 'internal', 'confidential', 'secret', 'highly_restricted'];
    return validLevels.includes(level.toLowerCase());
  }

  private isValidHookPoint(point: string): boolean {
    const validPoints = [
      'beforeValidateRow',
      'validateField',
      'beforeLookup',
      'performLookup',
      'transformField',
      'maskField',
      'unmaskField',
      'beforeInsert',
      'afterInsert',
    ];
    return validPoints.includes(point);
  }

  private isValidTransformType(type: string): boolean {
    const validTypes = [
      'trim',
      'uppercase',
      'lowercase',
      'parse_date',
      'parse_number',
      'parse_boolean',
      'round',
      'regex_extract',
      'replace',
      'default',
      'concat',
    ];
    return validTypes.includes(type.toLowerCase());
  }

  /**
   * Parse YAML content into a spec object
   */
  parseYaml(yamlContent: string): YAMLSpec {
    const validation = this.validateYaml(yamlContent);
    if (!validation.valid) {
      throw new ValidationException('Invalid YAML spec', {
        errors: validation.errors,
      });
    }
    return yaml.parse(yamlContent) as YAMLSpec;
  }
}
