import type {Config} from 'jest';

const config: Config = {
    preset: 'ts-jest',
    testEnvironment: 'node',
    roots: ['<rootDir>/src'],
    moduleFileExtensions: ['ts', 'js', 'json'],
    transform: {
        '^.+\\.(t|j)s$': ['ts-jest', {tsconfig: 'tsconfig.json'}],
    },
    testRegex: '.*\\.spec\\.(t|j)s$',
    coveragePathIgnorePatterns: [
        '/src/app.module.ts',
        '/src/.*/dto/',
        '/src/.*/exceptions/',
        '/src/.*/*\\.entity\\.ts$',
    ],
    coverageThreshold: {
        global: {
            branches: 85,
            functions: 85,
            lines: 85,
            statements: 85,
        },
    },
    coverageReporters: ['text', 'lcov', 'clover'],
    maxWorkers: 1,
    testTimeout: 120000,
};

export default config;
