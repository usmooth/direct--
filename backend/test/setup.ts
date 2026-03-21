// backend/test/setup.ts
// Test setup file for Jest

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'TEST_SECRET_KEY_FOR_JEST';

// Note: For tests to run, you need to either:
// 1. Set FIREBASE_SERVICE_ACCOUNT environment variable with valid Firebase credentials
// 2. Provide a serviceAccountKey.json file in the backend directory
// 3. Use Firebase Emulator (recommended for CI/CD)

// If Firebase is not configured, tests will fail with a clear error message
// This is intentional to ensure tests run against a real or emulated Firebase instance

