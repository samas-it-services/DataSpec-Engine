/**
 * API Client helper for E2E tests.
 * Provides typed methods for interacting with the DataSpec API.
 */

import { APIRequestContext } from '@playwright/test';

export interface Entity {
  id: string;
  name: string;
  displayName: string;
  table: string;
  description: string;
  specCount?: number;
}

export interface Spec {
  id: string;
  name: string;
  description: string;
  entityId: string;
  createdAt: string;
  updatedAt: string;
}

export interface PreviewRow {
  rowIndex: number;
  data: Record<string, unknown>;
  errors: { field: string; message: string }[];
  isValid: boolean;
}

export interface PreviewResult {
  rows: PreviewRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  errors: { rowIndex: number; errors: { field: string; message: string }[] }[];
  columns: { name: string; sourceColumn: string; type: string; required: boolean }[];
}

export interface ImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: unknown[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: string;
    duration?: number;
  };
}

export class DataSpecApiClient {
  constructor(private request: APIRequestContext, private baseUrl: string) {}

  /**
   * Health check
   */
  async health(): Promise<{ status: string; timestamp: string }> {
    const response = await this.request.get(`${this.baseUrl}/health`);
    return response.json();
  }

  /**
   * List all entities
   */
  async listEntities(includeSpecCount = false): Promise<ApiResponse<{ entities: Entity[] }>> {
    const url = includeSpecCount
      ? `${this.baseUrl}/dataspec/entities?includeSpecCount=true`
      : `${this.baseUrl}/dataspec/entities`;
    const response = await this.request.get(url);
    return response.json();
  }

  /**
   * List specs for an entity
   */
  async listSpecs(entity?: string): Promise<ApiResponse<{ specs: Spec[] }>> {
    const url = entity
      ? `${this.baseUrl}/dataspec/specs?entity=${entity}`
      : `${this.baseUrl}/dataspec/specs`;
    const response = await this.request.get(url);
    return response.json();
  }

  /**
   * Validate YAML spec
   */
  async validateYaml(
    yamlContent: string
  ): Promise<ApiResponse<{ valid: boolean; errors: string[] }>> {
    const response = await this.request.post(`${this.baseUrl}/dataspec/specs/validate`, {
      data: { yamlContent },
    });
    return response.json();
  }

  /**
   * Preview import
   */
  async previewImport(
    specId: string,
    fileContent: string,
    fileName: string,
    maxRows = 100
  ): Promise<ApiResponse<PreviewResult>> {
    const response = await this.request.post(`${this.baseUrl}/dataspec/import/preview`, {
      data: { specId, fileContent, fileName, maxRows },
    });
    return response.json();
  }

  /**
   * Execute import
   */
  async executeImport(
    specId: string,
    fileContent: string,
    fileName: string
  ): Promise<ApiResponse<ImportResult>> {
    const response = await this.request.post(`${this.baseUrl}/dataspec/import/execute`, {
      data: { specId, fileContent, fileName },
    });
    return response.json();
  }

  /**
   * Export data
   */
  async exportData(
    entity: string,
    format: 'json' | 'csv' = 'json',
    applyMasking = true
  ): Promise<ApiResponse<{ content: unknown; rowCount: number }>> {
    const response = await this.request.post(`${this.baseUrl}/dataspec/export`, {
      data: { entity, format, applyMasking },
    });
    return response.json();
  }

  /**
   * Mask a value
   */
  async maskValue(
    value: string,
    mode: 'full' | 'partial' = 'partial'
  ): Promise<ApiResponse<{ maskedValue: string }>> {
    const response = await this.request.post(`${this.baseUrl}/dataspec/mask`, {
      data: { value, mode },
    });
    return response.json();
  }
}
