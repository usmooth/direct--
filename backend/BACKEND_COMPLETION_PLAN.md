# Backend Completion Plan

## Overview
This plan includes all necessary steps to make the backend production-ready. It covers security, reliability, performance, and test coverage improvements.

---

## 1. Security Improvements

### 1.1 JWT Middleware Implementation
- **File**: `backend/index.ts`
- **Description**: Add JWT authentication middleware for all protected endpoints
- **Details**:
  - Create `authenticateToken` middleware function
  - Extract token from request header in `Authorization: Bearer <token>` format
  - Perform JWT verification and add `req.userHash`
  - Return 401 for invalid/expired tokens

### 1.2 JWT Secret Environment Variable
- **File**: `backend/index.ts`
- **Description**: Prevent hardcoded secret usage in production
- **Details**:
  - Terminate process if `JWT_SECRET` env var is missing in production mode
  - Log warning in development but continue execution

### 1.3 Rate Limiting - Verification Code
- **File**: `backend/index.ts` (register-request endpoint)
- **Description**: Prevent brute-force attacks on SMS verification codes
- **Details**:
  - Add `attemptCount` and `lastAttempt` fields to `verificationRequests` collection
  - Allow maximum 5 attempts per 5 minutes
  - Return 429 Too Many Requests if limit exceeded
  - Increment `attemptCount` on each failed attempt

### 1.4 Firebase Credentials Environment Variable
- **File**: `backend/firebase-init.ts`
- **Description**: Read service account key from environment variable
- **Details**:
  - Get `FIREBASE_SERVICE_ACCOUNT` as JSON string from env
  - Fallback to `serviceAccountKey.json` file (for development)
  - Make env var mandatory in production

---

## 2. Missing Endpoint Implementations

### 2.1 `/send-feedback` Endpoint
- **File**: `backend/index.ts`
- **Description**: Connect existing `sendFeedbackToSomeone` function to REST endpoint
- **Request Body**:
  ```typescript
  {
    targetUserHash: string
  }
  ```
- **Response**:
  ```typescript
  {
    success: boolean,
    message: string
  }
  ```
- **Details**:
  - Must be protected with JWT middleware
  - Get sender user from `req.userHash`
  - Create recipient user from `targetUserHash`
  - Call `sendFeedbackToSomeone` function
  - Return response

### 2.2 `/get-notifications` Endpoint
- **File**: `backend/index.ts`
- **Description**: Get user's notifications
- **Query Parameters**: 
  - `limit` (optional, default: 50)
  - `offset` (optional, default: 0)
- **Response**:
  ```typescript
  {
    success: boolean,
    notifications: Notification[],
    total: number
  }
  ```
- **Details**:
  - Must be protected with JWT middleware
  - Query `notifications` collection by `to` field using `req.userHash`
  - Get only non-expired notifications (where `skt` has not passed)
  - Sort by `notificationTime` descending
  - Add pagination support

---

## 3. Race Condition and Data Integrity Improvements

### 3.1 Firestore Transactions - sendFeedbackToSomeone
- **File**: `backend/index.ts`
- **Description**: Prevent race conditions in concurrent feedback submissions
- **Details**:
  - Wrap `sendFeedbackToSomeone` function in Firestore transaction
  - Perform all read and write operations within transaction
  - Add transaction retry logic (max 3 attempts)

### 3.2 Deterministic Document IDs
- **File**: `backend/index.ts`
- **Description**: Prevent duplicate record creation
- **Details**:
  - Use `feedbackHash` as document ID for `listeningRecords`
  - Use `doc(feedbackHash).set()` instead of `add()`
  - Use `set()` with merge: false to prevent duplicates

---

## 4. Expired Records Cleanup

### 4.1 Scheduled Cleanup Job
- **File**: `backend/index.ts` or `backend/cleanup.ts`
- **Description**: Automatically clean up expired records
- **Details**:
  - Create cleanup function that runs once daily using `setInterval`
  - Delete records in `listeningRecords` collection where `expireDate < now`
  - Delete records in `notifications` collection where `skt < now`
  - Delete credits older than 7 days in `listeningAndCreditData` collection
  - Use batch delete (batches of 500)

### 4.2 Firestore TTL Policy Setup
- **File**: Documentation (manual in Firebase Console)
- **Description**: Use Firestore native TTL feature
- **Details**:
  - Add TTL policy to `expiresAt` field for `verificationRequests` collection
  - This will automatically delete expired verification codes

---

## 5. Error Handling and Logging

### 5.1 Centralized Error Handler
- **File**: `backend/index.ts` or `backend/middleware/errorHandler.ts`
- **Description**: Handle all errors centrally
- **Details**:
  - Add Express error handler middleware
  - Return appropriate HTTP status codes for different error types
  - Hide detailed error messages in production
  - Show stack trace in development

### 5.2 Request Logging
- **File**: `backend/index.ts`
- **Description**: Log all requests
- **Details**:
  - Log request method, path, timestamp, userHash (if available)
  - Log response status code and duration
  - Use Winston or simple console.log

---

## 6. Input Validation

### 6.1 Request Body Validation
- **File**: `backend/index.ts`
- **Description**: Perform input validation on all endpoints
- **Details**:
  - Validate `phoneNumber` format (using regex)
  - `smsValidationCode` must be numeric and 6 digits
  - `targetUserHash` must be in SHA-256 format (64 hex characters)
  - Return 400 Bad Request if validation fails

---

## 7. Test Coverage Increase

### 7.1 Auth Endpoint Tests
- **File**: `backend/test/auth.test.ts`
- **Description**: Test register and register-request endpoints
- **Test Cases**:
  - Successful verification code sending
  - Successful registration and JWT return
  - Expired verification code
  - Invalid verification code
  - Rate limiting test
  - Missing/invalid phone number

### 7.2 Protected Endpoint Tests
- **File**: `backend/test/protected.test.ts`
- **Description**: Test JWT middleware and protected endpoints
- **Test Cases**:
  - Endpoint access with valid JWT
  - 401 response with invalid JWT
  - 401 response with missing JWT
  - 401 response with expired JWT

### 7.3 Notification Endpoint Tests
- **File**: `backend/test/notifications.test.ts`
- **Description**: Test get-notifications endpoint
- **Test Cases**:
  - Get user's notifications
  - Filter expired notifications
  - Pagination test
  - Empty list response

### 7.4 Integration Tests
- **File**: `backend/test/integration.test.ts`
- **Description**: Full flow tests
- **Test Cases**:
  - Register → Send Feedback → Get Notifications flow
  - Mutual feedback scenario
  - Feedback sending with rate limiting

### 7.5 Firebase Emulator Setup
- **File**: `backend/jest.config.js`, `backend/test/setup.ts`
- **Description**: Use emulator instead of real Firebase in tests
- **Details**:
  - Use `@firebase/rules-unit-testing` or `firebase-tools` emulator
  - Start emulator in test setup
  - Clean up emulator in test teardown

---

## 8. Code Organization

### 8.1 Route Separation
- **File**: `backend/routes/auth.routes.ts`, `backend/routes/feedback.routes.ts`, `backend/routes/notification.routes.ts`
- **Description**: Separate routes into different files
- **Details**:
  - Use Express Router
  - Mount routes in `index.ts`

### 8.2 Service Layer
- **File**: `backend/services/auth.service.ts`, `backend/services/feedback.service.ts`, `backend/services/notification.service.ts`
- **Description**: Separate business logic from route handlers
- **Details**:
  - Route handlers should only handle HTTP operations
  - Business logic should be in service layer

### 8.3 Middleware Separation
- **File**: `backend/middleware/auth.middleware.ts`, `backend/middleware/errorHandler.middleware.ts`
- **Description**: Move middleware to separate files

---

## 9. Type Safety Improvements

### 9.1 Request/Response Types
- **File**: `backend/types/api.types.ts`
- **Description**: Define all API request/response types
- **Details**:
  - Extend Express Request/Response types
  - Create `AuthenticatedRequest` interface (with userHash field)

### 9.2 Environment Variables Types
- **File**: `backend/types/env.types.ts`
- **Description**: Define environment variable types

---

## 10. Documentation

### 10.1 API Documentation
- **File**: `backend/API.md` or Swagger/OpenAPI
- **Description**: Documentation for all endpoints
- **Content**:
  - Endpoint paths
  - Request/Response formats
  - Error codes
  - Authentication requirements

### 10.2 Environment Variables Documentation
- **File**: `backend/.env.example`
- **Description**: Example file listing required environment variables
- **Content**:
  ```
  JWT_SECRET=your-secret-key-here
  FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
  NODE_ENV=development
  PORT=3000
  ```

---

## Implementation Order (Priority)

1. **Critical Security** (1.1, 1.2, 1.3, 1.4)
2. **Missing Endpoints** (2.1, 2.2)
3. **Race Condition Fix** (3.1, 3.2)
4. **Error Handling** (5.1, 5.2)
5. **Input Validation** (6.1)
6. **Cleanup Job** (4.1)
7. **Test Coverage** (7.1-7.5)
8. **Code Organization** (8.1-8.3)
9. **Type Safety** (9.1, 9.2)
10. **Documentation** (10.1, 10.2)

---

## Notes

- Ensure existing tests run at each step
- Prepare migration plan for breaking changes
- Test in staging environment before deploying to production
- Firebase TTL policies must be set manually in Firebase Console
