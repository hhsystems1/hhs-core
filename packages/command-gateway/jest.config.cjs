module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleExtension: ['.ts'],
  globals: {
    'ts-jest': {
      tsconfig: {
        preset: 'tsconfig.json',
        testInclude: ['src/**/*.ts'],
      }
    }
  },
  transform: {
    '^.+\\.ts$': 'ts-jest'
  },
  coverageDirectory: '<rootDir>/coverage',
  verbose: true,
};