/**
 * Field Transformer
 *
 * Handles all field transformations including:
 * - String transformations (trim, case)
 * - Date transformations (parse, format)
 * - Numeric transformations (round, floor, ceil)
 * - Regex transformations (extract, replace)
 * - Custom JavaScript transformations
 */

import { parse, format as formatDate } from 'date-fns';
import {
  TransformationUnion,
  TransformationType,
  ParseDateTransform,
  FormatDateTransform,
  RoundTransform,
  RegexExtractTransform,
  RegexReplaceTransform,
  SplitTransform,
  JoinTransform,
  CustomTransform
} from '../types/spec.types';

/**
 * Transformation error
 */
export class TransformationError extends Error {
  constructor(
    message: string,
    public field: string,
    public transformationType: string,
    public value: any,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'TransformationError';
  }
}

/**
 * Transformation result
 */
export interface TransformResult {
  success: boolean;
  value: any;
  error?: TransformationError;
}

/**
 * Field Transformer class
 */
export class FieldTransformer {
  /**
   * Apply a single transformation to a value
   *
   * @param value - Input value
   * @param transform - Transformation configuration
   * @param fieldName - Field name for error reporting
   * @returns Transformed value
   */
  async transform(
    value: any,
    transform: TransformationUnion,
    fieldName: string
  ): Promise<any> {
    if (value === null || value === undefined) {
      return value;
    }

    try {
      switch (transform.type) {
        case TransformationType.TRIM:
          return this.trim(value);

        case TransformationType.UPPERCASE:
          return this.uppercase(value);

        case TransformationType.LOWERCASE:
          return this.lowercase(value);

        case TransformationType.CAPITALIZE:
          return this.capitalize(value);

        case TransformationType.PARSE_DATE:
          return this.parseDate(value, transform as ParseDateTransform);

        case TransformationType.FORMAT_DATE:
          return this.formatDateValue(value, transform as FormatDateTransform);

        case TransformationType.ROUND:
        case TransformationType.FLOOR:
        case TransformationType.CEIL:
          return this.roundNumber(value, transform as RoundTransform);

        case TransformationType.REGEX_EXTRACT:
          return this.regexExtract(value, transform as RegexExtractTransform);

        case TransformationType.REGEX_REPLACE:
          return this.regexReplace(value, transform as RegexReplaceTransform);

        case TransformationType.SPLIT:
          return this.split(value, transform as SplitTransform);

        case TransformationType.JOIN:
          return this.join(value, transform as JoinTransform);

        case TransformationType.CUSTOM:
          return await this.custom(value, transform as CustomTransform, fieldName);

        default:
          throw new Error(`Unknown transformation type: ${(transform as any).type}`);
      }
    } catch (error: any) {
      throw new TransformationError(
        `Transformation failed for field ${fieldName}: ${error.message}`,
        fieldName,
        transform.type,
        value,
        error
      );
    }
  }

  /**
   * Apply multiple transformations in sequence
   *
   * @param value - Input value
   * @param transforms - Array of transformations
   * @param fieldName - Field name for error reporting
   * @returns Final transformed value
   */
  async transformChain(
    value: any,
    transforms: TransformationUnion[],
    fieldName: string
  ): Promise<any> {
    let result = value;

    for (const transform of transforms) {
      result = await this.transform(result, transform, fieldName);
    }

    return result;
  }

  /**
   * Apply transformations with error handling
   *
   * @param value - Input value
   * @param transforms - Array of transformations
   * @param fieldName - Field name
   * @returns Transform result with success flag
   */
  async transformSafe(
    value: any,
    transforms: TransformationUnion[],
    fieldName: string
  ): Promise<TransformResult> {
    try {
      const transformedValue = await this.transformChain(value, transforms, fieldName);
      return {
        success: true,
        value: transformedValue
      };
    } catch (error: any) {
      return {
        success: false,
        value,
        error: error instanceof TransformationError ? error : new TransformationError(
          error.message,
          fieldName,
          'unknown',
          value,
          error
        )
      };
    }
  }

  /**
   * Trim whitespace from string
   */
  private trim(value: any): string {
    return String(value).trim();
  }

  /**
   * Convert to uppercase
   */
  private uppercase(value: any): string {
    return String(value).toUpperCase();
  }

  /**
   * Convert to lowercase
   */
  private lowercase(value: any): string {
    return String(value).toLowerCase();
  }

  /**
   * Capitalize first letter of each word
   */
  private capitalize(value: any): string {
    return String(value)
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  /**
   * Parse date from string
   */
  private parseDate(value: any, transform: ParseDateTransform): Date {
    if (value instanceof Date) {
      return value;
    }

    try {
      return parse(String(value), transform.format, new Date());
    } catch (error: any) {
      throw new Error(`Failed to parse date "${value}" with format "${transform.format}": ${error.message}`);
    }
  }

  /**
   * Format date to string
   */
  private formatDateValue(value: any, transform: FormatDateTransform): string {
    let date: Date;

    if (value instanceof Date) {
      date = value;
    } else if (typeof value === 'string' || typeof value === 'number') {
      date = new Date(value);
    } else {
      throw new Error(`Invalid date value: ${value}`);
    }

    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${value}`);
    }

    try {
      return formatDate(date, transform.format);
    } catch (error: any) {
      throw new Error(`Failed to format date with format "${transform.format}": ${error.message}`);
    }
  }

  /**
   * Round, floor, or ceil a number
   */
  private roundNumber(value: any, transform: RoundTransform): number {
    const num = Number(value);

    if (isNaN(num)) {
      throw new Error(`Invalid number: ${value}`);
    }

    const decimals = transform.decimals ?? 0;
    const multiplier = Math.pow(10, decimals);

    switch (transform.type) {
      case TransformationType.ROUND:
        return Math.round(num * multiplier) / multiplier;

      case TransformationType.FLOOR:
        return Math.floor(num * multiplier) / multiplier;

      case TransformationType.CEIL:
        return Math.ceil(num * multiplier) / multiplier;

      default:
        return num;
    }
  }

  /**
   * Extract value using regex
   */
  private regexExtract(value: any, transform: RegexExtractTransform): string | null {
    const str = String(value);
    const regex = new RegExp(transform.pattern, transform.flags || '');
    const match = str.match(regex);

    if (!match) {
      return null;
    }

    const captureGroup = transform.captureGroup ?? 0;
    return match[captureGroup] || null;
  }

  /**
   * Replace value using regex
   */
  private regexReplace(value: any, transform: RegexReplaceTransform): string {
    const str = String(value);
    const regex = new RegExp(transform.pattern, transform.flags || 'g');
    return str.replace(regex, transform.replacement);
  }

  /**
   * Split string by delimiter
   */
  private split(value: any, transform: SplitTransform): string | string[] {
    const str = String(value);
    const parts = str.split(transform.delimiter);

    if (transform.index !== undefined) {
      return parts[transform.index] || '';
    }

    return parts;
  }

  /**
   * Join array with delimiter
   */
  private join(value: any, transform: JoinTransform): string {
    if (Array.isArray(value)) {
      return value.join(transform.delimiter);
    }

    return String(value);
  }

  /**
   * Execute custom JavaScript transformation
   */
  private async custom(value: any, transform: CustomTransform, fieldName: string): Promise<any> {
    try {
      const fn = new Function('value', 'fieldName', `
        "use strict";
        ${transform.script}
      `);

      const result = fn(value, fieldName);

      if (result instanceof Promise) {
        return await result;
      }

      return result;
    } catch (error: any) {
      throw new Error(`Custom transformation script failed: ${error.message}`);
    }
  }
}

export default FieldTransformer;
