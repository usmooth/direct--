# Backend Test Suite

This directory contains the comprehensive test suite for the backend application.

## Test Files

- `auth.test.ts` - Tests for `/register-request` and `/register` endpoints
- `protected.test.ts` - JWT authentication middleware tests
- `send-feedback.test.ts` - Tests for `/send-feedback` endpoint
- `notifications.test.ts` - Tests for `/get-notifications` endpoint
- `feedback-logic.test.ts` - Feedback business logic tests

## Running Tests

### Requirements

Firebase configuration is required for tests to run. You can use one of the following methods:

#### Method 1: Environment Variable (Recommended)

```bash
export FIREBASE_SERVICE_ACCOUNT='{"type":"service_account",...}'
npm test
```

#### Method 2: Service Account Key File

Create `backend/serviceAccountKey.json` file and add your Firebase service account key.

#### Method 3: Firebase Emulator (Recommended for CI/CD)

You can run tests using Firebase Emulator:

```bash
# Start Firebase emulator
firebase emulators:start --only firestore

# Run tests in another terminal
npm test
```

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage
```

## Test Coverage

The test suite covers the following areas:

- ✅ Authentication endpoints (register-request, register)
- ✅ JWT token generation and validation
- ✅ Protected endpoints authentication
- ✅ Feedback sending operations
- ✅ Mutual feedback scenarios
- ✅ Rate limiting
- ✅ Notification endpoints
- ✅ Pagination and filtering
- ✅ Input validation
- ✅ Error handling

## Test Structure

Each test file:
- Performs database cleanup using `beforeEach` and `afterEach` hooks
- Prepares Firebase Firestore collections for testing
- Sends real HTTP requests (using supertest)
- Validates responses and database state

## Notes

- Tests use real Firebase instance (or emulator)
- Database is cleaned before and after each test run
- Tests are independent (isolated)
- JWT secret key is set to `TEST_SECRET_KEY_FOR_JEST` in test environment
