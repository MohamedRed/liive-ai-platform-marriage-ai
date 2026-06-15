/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: true,
        tsconfig: './tsconfig.test.json',
        diagnostics: {
          warnOnly: true,
          ignoreCodes: [2345, 2339, 2554, 2741]
        }
      }
    ]
  },
  transformIgnorePatterns: [
    // This is needed for ESM dependencies
    "node_modules/(?!(@liive-marriage-ai/database-types)/)"
  ],
  moduleNameMapper: {
    // Mock the database-types package
    "@liive-marriage-ai/database-types": "<rootDir>/src/__tests__/mocks/database-types.ts"
  },
  clearMocks: true,
  verbose: true,
  maxWorkers: '50%',
  testTimeout: 15000
}; 