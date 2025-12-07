// Jest setup file for API tests

// Extend Jest matchers
expect.extend({
  toBeValidResponse(received) {
    const pass = received && typeof received === 'object' && 'success' in received;
    return {
      message: () =>
        `expected ${JSON.stringify(received)} to ${pass ? 'not ' : ''}be a valid API response`,
      pass,
    };
  },
});

// Global test timeout
jest.setTimeout(10000);

// Mock environment variables
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.JWT_SECRET = 'test-jwt-secret';

// Suppress console during tests (uncomment if needed)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
// };
