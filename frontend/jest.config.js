const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });
const customJestConfig = {
  setupFilesAfterSetup: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
module.exports = createJestConfig(customJestConfig);
