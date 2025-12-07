/**
 * Global setup for Playwright E2E tests.
 * Runs once before all tests.
 */

import { FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  console.log('\n=== DataSpec Engine E2E Tests ===');
  console.log('Global setup starting...');

  // Store config for use in tests
  process.env.E2E_BASE_URL = config.projects[0].use?.baseURL as string || 'http://localhost:3001';
  process.env.E2E_API_URL = process.env.E2E_API_URL || 'http://localhost:3000';

  console.log(`Frontend URL: ${process.env.E2E_BASE_URL}`);
  console.log(`API URL: ${process.env.E2E_API_URL}`);
  console.log('Global setup complete.\n');
}

export default globalSetup;
