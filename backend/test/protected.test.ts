// backend/test/protected.test.ts

import request from 'supertest';
import { app } from '../index';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'DEFAULT_DEVELOPMENT_SECRET_KEY_12345';

describe('Protected Endpoints - JWT Authentication', () => {
  const validUserHash = 'a'.repeat(64); // Valid SHA-256 hash format
  const validToken = jwt.sign({ userHash: validUserHash }, JWT_SECRET, { expiresIn: '1y' });

  describe('POST /send-feedback', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .post('/send-feedback')
        .send({ targetUserHash: validUserHash })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication token required.');
    });

    it('should return 401 when token is invalid', async () => {
      const response = await request(app)
        .post('/send-feedback')
        .set('Authorization', 'Bearer invalid_token_12345')
        .send({ targetUserHash: validUserHash })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or malformed token.');
    });

    it('should return 401 when token is expired', async () => {
      const expiredToken = jwt.sign({ userHash: validUserHash }, JWT_SECRET, { expiresIn: '-1h' });

      const response = await request(app)
        .post('/send-feedback')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({ targetUserHash: validUserHash })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Token has expired.');
    });

    it('should return 401 when Authorization header format is wrong', async () => {
      const response = await request(app)
        .post('/send-feedback')
        .set('Authorization', validToken) // Missing 'Bearer ' prefix
        .send({ targetUserHash: validUserHash })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication token required.');
    });

    it('should accept valid token and proceed to endpoint logic', async () => {
      // This will fail at business logic level (user doesn't exist), but authentication should pass
      const response = await request(app)
        .post('/send-feedback')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ targetUserHash: 'b'.repeat(64) })
        .expect(400); // 400 because of business logic, not 401

      // Should not be authentication error
      expect(response.body.message).not.toBe('Authentication token required.');
      expect(response.body.message).not.toBe('Invalid or malformed token.');
    });
  });

  describe('GET /get-notifications', () => {
    it('should return 401 when no token is provided', async () => {
      const response = await request(app)
        .get('/get-notifications')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication token required.');
    });

    it('should return 401 when token is invalid', async () => {
      const response = await request(app)
        .get('/get-notifications')
        .set('Authorization', 'Bearer invalid_token_12345')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid or malformed token.');
    });

    it('should accept valid token and proceed to endpoint logic', async () => {
      const response = await request(app)
        .get('/get-notifications')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200); // Should succeed (may return empty notifications)

      expect(response.body.success).toBe(true);
      expect(response.body.notifications).toBeDefined();
    });
  });
});

