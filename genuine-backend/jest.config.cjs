module.exports = {
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@nestjs/schedule$': '<rootDir>/test/mocks/nestjs-schedule.ts',
  },
  testEnvironment: 'node',
};
