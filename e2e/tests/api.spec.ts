/**
 * API Endpoint E2E Tests
 *
 * Tests all DataSpec API endpoints for correct behavior.
 */

import { test, expect } from '@playwright/test';
import { DataSpecApiClient } from '../helpers/api-client';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3000';

test.describe('DataSpec API Endpoints', () => {
  let api: DataSpecApiClient;

  test.beforeAll(async ({ request }) => {
    api = new DataSpecApiClient(request, API_URL);
  });

  test.describe('Health Check', () => {
    test('should return health status', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);
      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });
  });

  test.describe('Entities API', () => {
    test('should list all entities', async ({ request }) => {
      const result = await api.listEntities();

      expect(result.success).toBe(true);
      expect(result.data?.entities).toBeDefined();
      expect(Array.isArray(result.data?.entities)).toBe(true);
    });

    test('should include spec count when requested', async ({ request }) => {
      const result = await api.listEntities(true);

      expect(result.success).toBe(true);
      expect(result.data?.entities).toBeDefined();
      if (result.data?.entities && result.data.entities.length > 0) {
        expect(result.data.entities[0].specCount).toBeDefined();
      }
    });
  });

  test.describe('Specs API', () => {
    test('should list all specs', async ({ request }) => {
      const result = await api.listSpecs();

      expect(result.success).toBe(true);
      expect(result.data?.specs).toBeDefined();
      expect(Array.isArray(result.data?.specs)).toBe(true);
    });

    test('should filter specs by entity', async ({ request }) => {
      const result = await api.listSpecs('users');

      expect(result.success).toBe(true);
      expect(result.data?.specs).toBeDefined();
      if (result.data?.specs && result.data.specs.length > 0) {
        result.data.specs.forEach((spec) => {
          expect(spec.entityId).toBe('users');
        });
      }
    });
  });

  test.describe('YAML Validation', () => {
    test('should validate correct YAML', async ({ request }) => {
      const validYaml = `version: "1.0"
metadata:
  entity: users
columns:
  - name: test
    type: string`;

      const result = await api.validateYaml(validYaml);

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(true);
      expect(result.data?.errors).toHaveLength(0);
    });

    test('should reject invalid YAML', async ({ request }) => {
      const invalidYaml = `invalid yaml without required fields`;

      const result = await api.validateYaml(invalidYaml);

      expect(result.success).toBe(true);
      expect(result.data?.valid).toBe(false);
      expect(result.data?.errors && result.data.errors.length > 0).toBe(true);
    });
  });

  test.describe('Import Preview', () => {
    test('should preview CSV import', async ({ request }) => {
      const csvContent = `first_name,last_name,email
John,Doe,john@test.com
Jane,Smith,jane@test.com`;

      const result = await api.previewImport(
        'users-import-v1',
        csvContent,
        'test.csv'
      );

      expect(result.success).toBe(true);
      expect(result.data?.totalRows).toBe(2);
      expect(result.data?.rows).toHaveLength(2);
      expect(result.data?.columns).toBeDefined();
    });

    test('should detect validation errors', async ({ request }) => {
      const csvContent = `first_name,last_name,email
John,Doe,invalid-email
Jane,Smith,jane@test.com`;

      const result = await api.previewImport(
        'users-import-v1',
        csvContent,
        'test.csv'
      );

      expect(result.success).toBe(true);
      expect(result.data?.invalidRows).toBeGreaterThanOrEqual(1);
    });

    test('should respect maxRows limit', async ({ request }) => {
      const csvContent = `first_name,last_name,email
Row1,Test,row1@test.com
Row2,Test,row2@test.com
Row3,Test,row3@test.com
Row4,Test,row4@test.com
Row5,Test,row5@test.com`;

      const result = await api.previewImport(
        'users-import-v1',
        csvContent,
        'test.csv',
        2
      );

      expect(result.success).toBe(true);
      expect(result.data?.rows).toHaveLength(2);
      expect(result.data?.totalRows).toBe(5);
    });
  });

  test.describe('Import Execute', () => {
    test('should execute import', async ({ request }) => {
      const csvContent = `first_name,last_name,email
Test,User,test${Date.now()}@example.com`;

      const result = await api.executeImport(
        'users-import-v1',
        csvContent,
        'test.csv'
      );

      expect(result.success).toBe(true);
      expect(result.data?.inserted).toBeGreaterThanOrEqual(1);
    });
  });

  test.describe('Export', () => {
    test('should export data as JSON', async ({ request }) => {
      const result = await api.exportData('users', 'json', true);

      expect(result.success).toBe(true);
      expect(result.data?.rowCount).toBeDefined();
    });

    test('should export data as CSV', async ({ request }) => {
      const result = await api.exportData('users', 'csv', false);

      expect(result.success).toBe(true);
      expect(result.data?.content).toBeDefined();
    });
  });

  test.describe('Masking', () => {
    test('should mask value with partial mode', async ({ request }) => {
      const result = await api.maskValue('john.doe@example.com', 'partial');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
      expect(result.data?.maskedValue).not.toBe('john.doe@example.com');
    });

    test('should mask value with full mode', async ({ request }) => {
      const result = await api.maskValue('secret-password', 'full');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
      expect(result.data?.maskedValue).toMatch(/^\*+$/);
    });
  });
});
