/**
 * Global teardown for Playwright E2E tests.
 * Runs once after all tests.
 */

async function globalTeardown() {
  console.log('\n=== E2E Tests Complete ===');
  console.log('Global teardown complete.\n');
}

export default globalTeardown;
