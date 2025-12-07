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
    '^@dataspec-engine/core$': '<rootDir>/packages/core/src',
    '^@dataspec-engine/supabase-adapter$': '<rootDir>/packages/supabase-adapter/src',
    '^@dataspec-engine/react$': '<rootDir>/packages/react/src',
    '^@dataspec-engine/api$': '<rootDir>/packages/api/src',
  },
};
