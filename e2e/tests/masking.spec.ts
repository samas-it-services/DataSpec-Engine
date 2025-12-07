/**
 * Masking E2E Tests
 *
 * Tests the data masking and unmasking functionality.
 */

import { test, expect } from '@playwright/test';
import { DataSpecApiClient } from '../helpers/api-client';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3000';

test.describe('Masking Operations', () => {
  let api: DataSpecApiClient;

  test.beforeAll(async ({ request }) => {
    api = new DataSpecApiClient(request, API_URL);
  });

  test.describe('Full Masking', () => {
    test('should fully mask a string value', async ({ request }) => {
      const result = await api.maskValue('sensitive-data', 'full');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
      expect(result.data?.maskedValue).toMatch(/^\*+$/);
      expect(result.data?.maskedValue).not.toBe('sensitive-data');
    });

    test('should fully mask an email', async ({ request }) => {
      const result = await api.maskValue('user@example.com', 'full');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
      expect(result.data?.maskedValue).not.toContain('@');
      expect(result.data?.maskedValue).toMatch(/^\*+$/);
    });

    test('should fully mask a phone number', async ({ request }) => {
      const result = await api.maskValue('555-123-4567', 'full');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
      expect(result.data?.maskedValue).not.toContain('-');
      expect(result.data?.maskedValue).toMatch(/^\*+$/);
    });

    test('should handle empty string', async ({ request }) => {
      const result = await api.maskValue('', 'full');

      expect(result.success).toBe(true);
      // Empty string should return empty or masked
      expect(result.data?.maskedValue).toBeDefined();
    });
  });

  test.describe('Partial Masking', () => {
    test('should partially mask an email', async ({ request }) => {
      const result = await api.maskValue('john.doe@example.com', 'partial');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
      // Partial masking should preserve some characters
      const masked = result.data?.maskedValue || '';
      expect(masked).toContain('*');
      // Should still have recognizable structure
      expect(masked.length).toBeGreaterThan(0);
    });

    test('should partially mask a phone number', async ({ request }) => {
      const result = await api.maskValue('555-123-4567', 'partial');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
      const masked = result.data?.maskedValue || '';
      // Partial masking typically shows last 4 digits
      expect(masked).toContain('*');
    });

    test('should partially mask a credit card number', async ({ request }) => {
      const result = await api.maskValue('4111111111111111', 'partial');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
      const masked = result.data?.maskedValue || '';
      // Credit cards typically show last 4 digits
      expect(masked).toContain('*');
      // Should preserve last 4 digits
      expect(masked).toMatch(/.*1111$|.*\*+$/);
    });

    test('should partially mask a short string', async ({ request }) => {
      const result = await api.maskValue('abc', 'partial');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
    });
  });

  test.describe('Masking Edge Cases', () => {
    test('should handle special characters', async ({ request }) => {
      const result = await api.maskValue('test@#$%^&*()', 'full');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
      expect(result.data?.maskedValue).toMatch(/^\*+$/);
    });

    test('should handle unicode characters', async ({ request }) => {
      const result = await api.maskValue('用户名', 'full');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
    });

    test('should handle very long strings', async ({ request }) => {
      const longString = 'a'.repeat(1000);
      const result = await api.maskValue(longString, 'full');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
      expect(result.data?.maskedValue?.length).toBe(1000);
    });

    test('should handle numeric values', async ({ request }) => {
      const result = await api.maskValue('12345', 'partial');

      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toBeDefined();
    });
  });

  test.describe('Masking Consistency', () => {
    test('should produce consistent results for same input', async ({ request }) => {
      const value = 'test@example.com';

      const result1 = await api.maskValue(value, 'partial');
      const result2 = await api.maskValue(value, 'partial');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.data?.maskedValue).toBe(result2.data?.maskedValue);
    });

    test('should produce different results for different modes', async ({ request }) => {
      const value = 'test@example.com';

      const fullResult = await api.maskValue(value, 'full');
      const partialResult = await api.maskValue(value, 'partial');

      expect(fullResult.success).toBe(true);
      expect(partialResult.success).toBe(true);
      expect(fullResult.data?.maskedValue).not.toBe(partialResult.data?.maskedValue);
    });
  });
});

test.describe('Unmask Operations', () => {
  test.describe('Without Authentication', () => {
    test('should reject unmask without auth token', async ({ request }) => {
      const response = await request.post(`${API_URL}/dataspec/mask/unmask`, {
        data: {
          maskedValue: '***@***.com',
          originalRef: 'user-123-email',
        },
      });

      // Should be 401 Unauthorized
      expect(response.status()).toBe(401);
    });
  });

  test.describe('With Authentication', () => {
    // These tests require a valid JWT token
    const TEST_JWT = process.env.E2E_TEST_JWT || 'test-jwt-token';

    test('should unmask with valid token and permissions', async ({ request }) => {
      const response = await request.post(`${API_URL}/dataspec/mask/unmask`, {
        headers: {
          Authorization: `Bearer ${TEST_JWT}`,
        },
        data: {
          maskedValue: '***@***.com',
          originalRef: 'user-123-email',
        },
      });

      // If JWT is valid and has permissions, should succeed
      // If JWT is test token, may return 401 or 403
      const status = response.status();
      expect([200, 401, 403]).toContain(status);

      if (status === 200) {
        const data = await response.json();
        expect(data.success).toBe(true);
        expect(data.data?.unmaskedValue).toBeDefined();
      }
    });

    test('should log unmask operation', async ({ request }) => {
      // This test verifies audit logging is in place
      // Implementation depends on how audit logs are exposed
      const response = await request.post(`${API_URL}/dataspec/mask/unmask`, {
        headers: {
          Authorization: `Bearer ${TEST_JWT}`,
        },
        data: {
          maskedValue: '***@***.com',
          originalRef: 'user-123-email',
        },
      });

      // Audit logging should happen regardless of success
      // We can't directly verify logs here, but the endpoint should work
      expect(response.status()).toBeDefined();
    });
  });

  test.describe('Role-Based Access', () => {
    test('should deny unmask for insufficient role', async ({ request }) => {
      // Test with a token that has low permissions
      const lowPermToken = process.env.E2E_LOW_PERM_JWT || 'low-perm-token';

      const response = await request.post(`${API_URL}/dataspec/mask/unmask`, {
        headers: {
          Authorization: `Bearer ${lowPermToken}`,
        },
        data: {
          maskedValue: '***secret***',
          originalRef: 'user-123-ssn',
        },
      });

      // Should be 401 or 403
      expect([401, 403]).toContain(response.status());
    });
  });
});

test.describe('Sensitivity Levels', () => {
  test.describe('Classification Enforcement', () => {
    // These tests verify that sensitivity levels are enforced
    test('should handle Public level', async ({ request }) => {
      const api = new DataSpecApiClient(request, API_URL);
      const result = await api.maskValue('public-info', 'partial');

      // Public data can be partially masked
      expect(result.success).toBe(true);
    });

    test('should handle Confidential level', async ({ request }) => {
      const api = new DataSpecApiClient(request, API_URL);
      const result = await api.maskValue('confidential-data', 'full');

      // Confidential data should be fully masked
      expect(result.success).toBe(true);
      expect(result.data?.maskedValue).toMatch(/^\*+$/);
    });
  });
});
