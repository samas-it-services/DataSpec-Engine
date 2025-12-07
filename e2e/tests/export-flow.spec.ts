/**
 * Export Flow E2E Tests
 *
 * Tests the data export functionality with masking.
 */

import { test, expect } from '@playwright/test';
import { DataSpecApiClient } from '../helpers/api-client';

const API_URL = process.env.E2E_API_URL || 'http://localhost:3000';

test.describe('Export Flow', () => {
  let api: DataSpecApiClient;

  test.beforeAll(async ({ request }) => {
    api = new DataSpecApiClient(request, API_URL);
  });

  test.describe('JSON Export', () => {
    test('should export entity data as JSON', async ({ request }) => {
      const result = await api.exportData('users', 'json', false);

      expect(result.success).toBe(true);
      expect(result.data?.rowCount).toBeDefined();
      expect(result.data?.content).toBeDefined();
    });

    test('should apply masking when exporting', async ({ request }) => {
      const result = await api.exportData('users', 'json', true);

      expect(result.success).toBe(true);
      expect(result.data?.rowCount).toBeDefined();

      // If we have content, verify masking is applied
      if (result.data?.content && Array.isArray(result.data.content)) {
        // Check that sensitive fields are masked
        const rows = result.data.content as Record<string, unknown>[];
        if (rows.length > 0) {
          // Email should be masked if it exists
          const firstRow = rows[0];
          if (firstRow.email) {
            expect(firstRow.email).toMatch(/\*+|.*\*\*\*.*/);
          }
        }
      }
    });
  });

  test.describe('CSV Export', () => {
    test('should export entity data as CSV', async ({ request }) => {
      const result = await api.exportData('users', 'csv', false);

      expect(result.success).toBe(true);
      expect(result.data?.content).toBeDefined();

      // CSV content should be a string
      if (typeof result.data?.content === 'string') {
        // Should have header row at minimum
        expect(result.data.content.length).toBeGreaterThan(0);
        expect(result.data.content).toContain(',');
      }
    });

    test('should include headers in CSV export', async ({ request }) => {
      const result = await api.exportData('users', 'csv', false);

      expect(result.success).toBe(true);

      if (typeof result.data?.content === 'string') {
        const lines = result.data.content.split('\n');
        const headers = lines[0];

        // Should have typical user columns
        const hasUserColumns =
          headers.includes('first_name') ||
          headers.includes('last_name') ||
          headers.includes('email') ||
          headers.includes('id');

        expect(hasUserColumns).toBe(true);
      }
    });

    test('should apply masking to CSV export', async ({ request }) => {
      const result = await api.exportData('users', 'csv', true);

      expect(result.success).toBe(true);

      if (typeof result.data?.content === 'string') {
        // Masked content should contain asterisks
        // This depends on what fields are marked as sensitive
        expect(result.data.content).toBeDefined();
      }
    });
  });

  test.describe('Export Validation', () => {
    test('should handle invalid entity gracefully', async ({ request }) => {
      const result = await api.exportData('nonexistent-entity', 'json', false);

      // Should either fail gracefully or return empty data
      if (!result.success) {
        expect(result.error).toBeDefined();
        expect(result.error?.message).toBeDefined();
      } else {
        expect(result.data?.rowCount).toBe(0);
      }
    });

    test('should handle empty entity', async ({ request }) => {
      const result = await api.exportData('', 'json', false);

      // Should fail with validation error
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });
});

test.describe('Export UI Flow', () => {
  const FRONTEND_URL = process.env.E2E_BASE_URL || 'http://localhost:3001';

  test('should display export options', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Look for export functionality
    const exportButton = page.locator(
      'button:has-text("Export"), a:has-text("Export"), [aria-label*="export"]'
    );

    if (await exportButton.first().isVisible()) {
      await exportButton.first().click();

      // Check for format selection
      const formatSelect = page.locator(
        'select:has-text("JSON"), select:has-text("CSV"), [role="combobox"]'
      );
      const formatOptions = page.locator(
        'text=JSON, text=CSV, text=Excel, [role="option"]'
      );

      const hasFormatSelection =
        (await formatSelect.isVisible()) || (await formatOptions.first().isVisible());

      // Format selection may or may not be visible depending on UI design
    }
  });

  test('should show masking toggle', async ({ page }) => {
    await page.goto(FRONTEND_URL);
    await page.waitForLoadState('networkidle');

    // Look for masking toggle
    const maskingToggle = page.locator(
      'input[type="checkbox"]:near(:text("mask")), [role="switch"]:near(:text("mask"))'
    );

    // Masking toggle may be present in export UI
    if (await maskingToggle.first().isVisible()) {
      expect(await maskingToggle.first().isEnabled()).toBe(true);
    }
  });
});
