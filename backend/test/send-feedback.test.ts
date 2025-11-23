// backend/test/send-feedback.test.ts

import request from 'supertest';
import { app } from '../index';
import { db } from '../firebase-init';
import jwt from 'jsonwebtoken';
import { User } from '../model/user.model';
import { hashTwoUsers } from '../index';
import * as admin from 'firebase-admin';

const JWT_SECRET = process.env.JWT_SECRET || 'DEFAULT_DEVELOPMENT_SECRET_KEY_12345';

// Helper function to clear collections
const clearCollection = async (collectionName: string) => {
  const snapshot = await db.collection(collectionName).get();
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  await batch.commit();
};

// Helper to generate valid user hash
const generateUserHash = (): string => {
  return 'a'.repeat(64);
};

describe('POST /send-feedback', () => {
  let fromUserHash: string;
  let targetUserHash: string;
  let fromUserToken: string;

  beforeEach(async () => {
    await clearCollection('listeningRecords');
    await clearCollection('listeningAndCreditData');
    await clearCollection('notifications');

    fromUserHash = generateUserHash();
    targetUserHash = 'b'.repeat(64);
    fromUserToken = jwt.sign({ userHash: fromUserHash }, JWT_SECRET, { expiresIn: '1y' });
  });

  afterEach(async () => {
    await clearCollection('listeningRecords');
    await clearCollection('listeningAndCreditData');
    await clearCollection('notifications');
  });

  it('should return 400 for missing targetUserHash', async () => {
    const response = await request(app)
      .post('/send-feedback')
      .set('Authorization', `Bearer ${fromUserToken}`)
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('targetUserHash is required.');
  });

  it('should return 400 for empty targetUserHash', async () => {
    const response = await request(app)
      .post('/send-feedback')
      .set('Authorization', `Bearer ${fromUserToken}`)
      .send({ targetUserHash: '' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('targetUserHash is required.');
  });

  it('should return 400 for invalid targetUserHash format (not SHA-256)', async () => {
    const response = await request(app)
      .post('/send-feedback')
      .set('Authorization', `Bearer ${fromUserToken}`)
      .send({ targetUserHash: 'invalid-hash' })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Invalid targetUserHash format.');
  });

  it('should return 400 for self-feedback attempt', async () => {
    const selfToken = jwt.sign({ userHash: fromUserHash }, JWT_SECRET, { expiresIn: '1y' });

    const response = await request(app)
      .post('/send-feedback')
      .set('Authorization', `Bearer ${selfToken}`)
      .send({ targetUserHash: fromUserHash })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Cannot send feedback to yourself.');
  });

  it('should successfully send feedback when user has right to send', async () => {
    const response = await request(app)
      .post('/send-feedback')
      .set('Authorization', `Bearer ${fromUserToken}`)
      .send({ targetUserHash })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('feedback-is-sent');

    // Verify listening record was created
    const commonHash = hashTwoUsers(fromUserHash, targetUserHash);
    const listeningRecordsQuery = await db.collection('listeningRecords')
      .where('feedbackHash', '==', commonHash)
      .get();
    expect(listeningRecordsQuery.size).toBe(1);
    expect(listeningRecordsQuery.docs[0].data().mutualFeedback).toBe(false);
  });

  it('should return 400 when user sent feedback less than 7 days ago', async () => {
    // Create a recent credit record (today)
    const commonHash = hashTwoUsers(fromUserHash, 'c'.repeat(64));
    await db.collection('listeningAndCreditData').add({
      user: { userHash: fromUserHash } as User,
      credit: new Date(),
      listening: commonHash
    });

    const response = await request(app)
      .post('/send-feedback')
      .set('Authorization', `Bearer ${fromUserToken}`)
      .send({ targetUserHash })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('sorry-,-you-must-wait');
  });

  it('should establish mutual feedback when both users send feedback', async () => {
    const targetUserToken = jwt.sign({ userHash: targetUserHash }, JWT_SECRET, { expiresIn: '1y' });

    // First user sends feedback
    await request(app)
      .post('/send-feedback')
      .set('Authorization', `Bearer ${fromUserToken}`)
      .send({ targetUserHash })
      .expect(200);

    // Second user sends feedback back (should create mutual feedback)
    const response = await request(app)
      .post('/send-feedback')
      .set('Authorization', `Bearer ${targetUserToken}`)
      .send({ targetUserHash: fromUserHash })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('mutual-feedback-established');

    // Verify records were cleaned up
    const listeningRecordsSnapshot = await db.collection('listeningRecords').get();
    const creditDataSnapshot = await db.collection('listeningAndCreditData').get();
    expect(listeningRecordsSnapshot.empty).toBe(true);
    expect(creditDataSnapshot.empty).toBe(true);

    // Verify notifications were created
    const notificationsSnapshot = await db.collection('notifications').get();
    expect(notificationsSnapshot.size).toBe(2);
  });

  it('should handle whitespace in targetUserHash', async () => {
    const response = await request(app)
      .post('/send-feedback')
      .set('Authorization', `Bearer ${fromUserToken}`)
      .send({ targetUserHash: `  ${targetUserHash}  ` })
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});

