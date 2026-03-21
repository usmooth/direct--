// backend/test/auth.test.ts

import request from 'supertest';
import { app } from '../index';
import { db } from '../firebase-init';
import * as admin from 'firebase-admin';
import sha256 from 'sha256';

// Helper function to clear collections
const clearCollection = async (collectionName: string) => {
  const snapshot = await db.collection(collectionName).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

describe('Auth Endpoints', () => {
  beforeEach(async () => {
    await clearCollection('verificationRequests');
  });

  afterEach(async () => {
    await clearCollection('verificationRequests');
  });

  describe('POST /register-request', () => {
    it('should successfully send verification code for valid phone number', async () => {
      const phoneNumber = '+905551234567';
      
      const response = await request(app)
        .post('/register-request')
        .send({ phoneNumber })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Verification code sent.');
      expect(response.body.expiresAt).toBeDefined();

      // Verify that verification request was saved
      const phoneNumberHash = sha256(phoneNumber.trim());
      const verificationDoc = await db.collection('verificationRequests').doc(phoneNumberHash).get();
      expect(verificationDoc.exists).toBe(true);
      const data = verificationDoc.data();
      expect(data?.code).toBeDefined();
      expect(data?.code.length).toBe(6);
      expect(data?.expiresAt).toBeDefined();
    });

    it('should return 400 for missing phone number', async () => {
      const response = await request(app)
        .post('/register-request')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('phoneNumber is required.');
    });

    it('should return 400 for empty phone number', async () => {
      const response = await request(app)
        .post('/register-request')
        .send({ phoneNumber: '' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('phoneNumber is required.');
    });

    it('should return 400 for non-string phone number', async () => {
      const response = await request(app)
        .post('/register-request')
        .send({ phoneNumber: 123456 })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('phoneNumber is required.');
    });

    it('should enforce rate limiting (max 1 request per 5 minutes)', async () => {
      const phoneNumber = '+905551234567';
      const phoneNumberHash = sha256(phoneNumber.trim());

      // First request
      await request(app)
        .post('/register-request')
        .send({ phoneNumber })
        .expect(200);

      // Second request immediately after (should be rate limited)
      const response = await request(app)
        .post('/register-request')
        .send({ phoneNumber })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Please wait before requesting a new verification code.');
      expect(response.body.retryAfter).toBeDefined();
    });

    it('should allow new request after rate limit period', async () => {
      const phoneNumber = '+905551234567';
      const phoneNumberHash = sha256(phoneNumber.trim());

      // First request
      await request(app)
        .post('/register-request')
        .send({ phoneNumber })
        .expect(200);

      // Manually set requestTime to 6 minutes ago
      const sixMinutesAgo = new Date(Date.now() - 6 * 60 * 1000);
      await db.collection('verificationRequests').doc(phoneNumberHash).update({
        requestTime: admin.firestore.Timestamp.fromDate(sixMinutesAgo)
      });

      // Second request should now be allowed
      const response = await request(app)
        .post('/register-request')
        .send({ phoneNumber })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /register', () => {
    const phoneNumber = '+905551234567';
    const phoneNumberHash = sha256(phoneNumber.trim());

    beforeEach(async () => {
      // Create a valid verification request for each test
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
      await db.collection('verificationRequests').doc(phoneNumberHash).set({
        code: '123456',
        expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
        requestTime: admin.firestore.Timestamp.fromDate(new Date()),
        attemptCount: 0
      });
    });

    it('should successfully register with valid verification code and return JWT token', async () => {
      const response = await request(app)
        .post('/register')
        .send({ phoneNumber, smsValidationCode: '123456' })
        .expect(200);

      expect(response.body.token).toBeDefined();
      expect(typeof response.body.token).toBe('string');

      // Verify verification request was deleted
      const verificationDoc = await db.collection('verificationRequests').doc(phoneNumberHash).get();
      expect(verificationDoc.exists).toBe(false);
    });

    it('should return 400 for missing phone number', async () => {
      const response = await request(app)
        .post('/register')
        .send({ smsValidationCode: '123456' })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('phoneNumber and smsValidationCode are required.');
    });

    it('should return 400 for missing verification code', async () => {
      const response = await request(app)
        .post('/register')
        .send({ phoneNumber })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('phoneNumber and smsValidationCode are required.');
    });

    it('should return 401 for invalid verification code', async () => {
      const response = await request(app)
        .post('/register')
        .send({ phoneNumber, smsValidationCode: '000000' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid verification code.');

      // Verify attemptCount was incremented
      const verificationDoc = await db.collection('verificationRequests').doc(phoneNumberHash).get();
      const data = verificationDoc.data();
      expect(data?.attemptCount).toBe(1);
    });

    it('should return 401 for expired verification code', async () => {
      // Update expiration to past
      const expiredDate = new Date(Date.now() - 1000);
      await db.collection('verificationRequests').doc(phoneNumberHash).update({
        expiresAt: admin.firestore.Timestamp.fromDate(expiredDate)
      });

      const response = await request(app)
        .post('/register')
        .send({ phoneNumber, smsValidationCode: '123456' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Verification code has expired.');

      // Verify verification request was deleted
      const verificationDoc = await db.collection('verificationRequests').doc(phoneNumberHash).get();
      expect(verificationDoc.exists).toBe(false);
    });

    it('should return 401 for non-existent verification request', async () => {
      // Delete the verification request
      await db.collection('verificationRequests').doc(phoneNumberHash).delete();

      const response = await request(app)
        .post('/register')
        .send({ phoneNumber, smsValidationCode: '123456' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Verification request not found or expired.');
    });

    it('should enforce max 5 attempts per verification code', async () => {
      // Set attemptCount to 4
      await db.collection('verificationRequests').doc(phoneNumberHash).update({
        attemptCount: 4
      });

      // 5th failed attempt
      const response = await request(app)
        .post('/register')
        .send({ phoneNumber, smsValidationCode: '000000' })
        .expect(429);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Too many failed attempts. Please request a new verification code.');

      // Verify verification request was deleted
      const verificationDoc = await db.collection('verificationRequests').doc(phoneNumberHash).get();
      expect(verificationDoc.exists).toBe(false);
    });

    it('should handle whitespace in phone number and code', async () => {
      const response = await request(app)
        .post('/register')
        .send({ phoneNumber: '  +905551234567  ', smsValidationCode: '  123456  ' })
        .expect(200);

      expect(response.body.token).toBeDefined();
    });
  });
});

