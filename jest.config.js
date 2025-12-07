module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/packages'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  collectCoverageFrom: [
    'packages/*/src/**/*.ts',
    '!packages/*/src/**/*.d.ts',
    '!packages/*/src/**/*.test.ts',
    '!packages/*/src/**/*.spec.ts',
    '!packages/*/src/types/**',
    '!packages/*/src/**/index.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  moduleNameMapper: {
    '^@samas/dataspec-core$': '<rootDir>/packages/core/src',
    '^@samas/dataspec-supabase-adapter$': '<rootDir>/packages/supabase-adapter/src',
    '^@samas/dataspec-react$': '<rootDir>/packages/react/src',
    '^@samas/dataspec-api$': '<rootDir>/packages/api/src',
  },
};
