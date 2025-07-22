import { pathsToModuleNameMapper } from 'ts-jest';
import { readFileSync } from 'node:fs';

const { compilerOptions } = JSON.parse(
  readFileSync(new URL('./tsconfig.json', import.meta.url))
);

export default {
  extensionsToTreatAsEsm: ['.ts'],
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: ['**/*.ts', '!dist/**'],
  moduleNameMapper: {
    ...pathsToModuleNameMapper(compilerOptions.paths || {}, { prefix: '<rootDir>/' }),
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  globals: {
    'ts-jest': { useESM: true, diagnostics: false }
  }
};
