// backend/test/notifications.test.ts

import request from 'supertest';
import { app } from '../index';
import { db } from '../firebase-init';
import jwt from 'jsonwebtoken';
import { Notification } from '../model/notification.model';
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

describe('GET /get-notifications', () => {
  let userHash: string;
  let userToken: string;

  beforeEach(async () => {
    await clearCollection('notifications');
    userHash = 'a'.repeat(64);
    userToken = jwt.sign({ userHash }, JWT_SECRET, { expiresIn: '1y' });
  });

  afterEach(async () => {
    await clearCollection('notifications');
  });

  it('should return empty notifications list for user with no notifications', async () => {
    const response = await request(app)
      .get('/get-notifications')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.notifications).toEqual([]);
    expect(response.body.total).toBe(0);
    expect(response.body.limit).toBe(50);
    expect(response.body.offset).toBe(0);
  });

  it('should return user notifications', async () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now

    // Create notifications
    const notification1: Notification = {
      to: userHash,
      context: 'b'.repeat(64),
      notificationTime: now,
      skt: futureDate
    };

    const notification2: Notification = {
      to: userHash,
      context: 'c'.repeat(64),
      notificationTime: new Date(now.getTime() + 1000),
      skt: futureDate
    };

    await db.collection('notifications').add({
      ...notification1,
      notificationTime: admin.firestore.Timestamp.fromDate(notification1.notificationTime),
      skt: admin.firestore.Timestamp.fromDate(notification1.skt)
    });

    await db.collection('notifications').add({
      ...notification2,
      notificationTime: admin.firestore.Timestamp.fromDate(notification2.notificationTime),
      skt: admin.firestore.Timestamp.fromDate(notification2.skt)
    });

    const response = await request(app)
      .get('/get-notifications')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.notifications.length).toBe(2);
    expect(response.body.total).toBe(2);
    expect(response.body.notifications[0].to).toBe(userHash);
    expect(response.body.notifications[0].context).toBeDefined();
  });

  it('should filter out expired notifications', async () => {
    const now = new Date();
    const expiredDate = new Date(now.getTime() - 1000); // 1 second ago
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day from now

    // Create expired notification
    await db.collection('notifications').add({
      to: userHash,
      context: 'expired',
      notificationTime: admin.firestore.Timestamp.fromDate(now),
      skt: admin.firestore.Timestamp.fromDate(expiredDate)
    });

    // Create valid notification
    await db.collection('notifications').add({
      to: userHash,
      context: 'valid',
      notificationTime: admin.firestore.Timestamp.fromDate(now),
      skt: admin.firestore.Timestamp.fromDate(futureDate)
    });

    const response = await request(app)
      .get('/get-notifications')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.notifications.length).toBe(1);
    expect(response.body.notifications[0].context).toBe('valid');
    expect(response.body.total).toBe(1);
  });

  it('should not return notifications for other users', async () => {
    const otherUserHash = 'b'.repeat(64);
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Create notification for other user
    await db.collection('notifications').add({
      to: otherUserHash,
      context: 'other',
      notificationTime: admin.firestore.Timestamp.fromDate(now),
      skt: admin.firestore.Timestamp.fromDate(futureDate)
    });

    const response = await request(app)
      .get('/get-notifications')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.notifications.length).toBe(0);
    expect(response.body.total).toBe(0);
  });

  it('should respect limit parameter', async () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Create 5 notifications
    for (let i = 0; i < 5; i++) {
      await db.collection('notifications').add({
        to: userHash,
        context: `context${i}`,
        notificationTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + i * 1000)),
        skt: admin.firestore.Timestamp.fromDate(futureDate)
      });
    }

    const response = await request(app)
      .get('/get-notifications?limit=3')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.notifications.length).toBe(3);
    expect(response.body.limit).toBe(3);
    expect(response.body.total).toBe(5);
  });

  it('should respect offset parameter', async () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Create 5 notifications
    for (let i = 0; i < 5; i++) {
      await db.collection('notifications').add({
        to: userHash,
        context: `context${i}`,
        notificationTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + i * 1000)),
        skt: admin.firestore.Timestamp.fromDate(futureDate)
      });
    }

    const response = await request(app)
      .get('/get-notifications?limit=3&offset=2')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.notifications.length).toBe(3);
    expect(response.body.offset).toBe(2);
    expect(response.body.total).toBe(5);
  });

  it('should enforce max limit of 100', async () => {
    const response = await request(app)
      .get('/get-notifications?limit=200')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.limit).toBe(100);
  });

  it('should enforce min limit of 1', async () => {
    const response = await request(app)
      .get('/get-notifications?limit=0')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.limit).toBe(1);
  });

  it('should enforce min offset of 0', async () => {
    const response = await request(app)
      .get('/get-notifications?offset=-5')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.offset).toBe(0);
  });

  it('should return notifications ordered by notificationTime descending', async () => {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Create notifications with different times
    await db.collection('notifications').add({
      to: userHash,
      context: 'oldest',
      notificationTime: admin.firestore.Timestamp.fromDate(now),
      skt: admin.firestore.Timestamp.fromDate(futureDate)
    });

    await db.collection('notifications').add({
      to: userHash,
      context: 'newest',
      notificationTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 2000)),
      skt: admin.firestore.Timestamp.fromDate(futureDate)
    });

    await db.collection('notifications').add({
      to: userHash,
      context: 'middle',
      notificationTime: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 1000)),
      skt: admin.firestore.Timestamp.fromDate(futureDate)
    });

    const response = await request(app)
      .get('/get-notifications')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(200);

    expect(response.body.notifications.length).toBe(3);
    // Should be ordered descending (newest first)
    expect(response.body.notifications[0].context).toBe('newest');
    expect(response.body.notifications[1].context).toBe('middle');
    expect(response.body.notifications[2].context).toBe('oldest');
  });
});

