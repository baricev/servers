export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      { useESM: true },
    ],
  },
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['**/*.ts','!**/dist/**','!**/__tests__/**','!**/node_modules/**'],
  coverageThreshold: {
    global: { lines: 0, branches: 0, functions: 0, statements: 0 },
  },
};
