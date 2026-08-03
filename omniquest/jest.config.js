/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/unit/**/*.test.ts', '**/unit/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/tests/jest.setup.js'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-.*|@expo/.*|@react-navigation/.*|react-navigation|nativewind|react-native-css-interop)/)',
  ],
  collectCoverageFrom: [
    'components/auth/**/*.{ts,tsx}',
    'hooks/useAppFeedback.ts',
    'components/admin/api/adminApi.ts',
    '!**/*.d.ts',
  ],
}
