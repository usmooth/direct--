# Deployment Guide

This guide covers deploying the backend application to production using Railway or Render.

## Overview

The application consists of:
- **Backend**: Express.js server with Firebase Firestore
- **Database**: Firebase Firestore (cloud-hosted, no deployment needed)
- **Frontend**: Expo React Native app (deployment not covered in this guide)

## Prerequisites

1. Node.js 20+ installed locally
2. Firebase project created and configured
3. Firebase service account key
4. Account on Railway or Render (free tier available)

## Cost Information (Without SMS Service)

### Railway
- **Free Plan**: 
  - $5 credit/month (approximately 100 hours of runtime)
  - Sleep mode: Goes to sleep after 30 minutes of inactivity
  - **Cost**: Completely free without SMS service (within credit limit)

### Render
- **Free Plan**:
  - Unlimited runtime
  - Sleep mode: Goes to sleep after 15 minutes of inactivity (slow start on first request)
  - **Cost**: Completely free without SMS service

### Firebase (Already in Use)
- **Firestore**: 
  - Free tier: 50K reads, 20K writes/day
  - Paid: $0.06/100K reads, $0.18/100K writes
  - **Cost**: Free for low traffic, low cost for high traffic

### SMS Service Costs (Future)
- **Twilio**: ~$0.0075/SMS (for Turkey)
- **AWS SNS**: ~$0.00645/SMS (for Turkey)
- **Firebase Cloud Messaging**: Free (push notifications, not SMS)

## Environment Variables

Create a `.env` file in the `backend` directory (or set in deployment platform):

```bash
NODE_ENV=production
PORT=3000  # Railway/Render will set this automatically
JWT_SECRET=your-strong-random-secret-key-here
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project-id",...}
```

### Generating JWT Secret

```bash
# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using OpenSSL
openssl rand -hex 32
```

## Deployment to Railway

### Step 1: Prepare Repository

1. Ensure `Procfile` exists in `backend/` directory:
   ```
   web: npm start
   ```

2. Ensure `package.json` has build script:
   ```json
   "scripts": {
     "start": "ts-node index.ts",
     "build": "tsc"
   }
   ```

### Step 2: Deploy to Railway

1. Go to [Railway](https://railway.app) and sign up/login
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your repository
4. Railway will auto-detect the backend directory
5. Set environment variables in Railway dashboard:
   - `NODE_ENV=production`
   - `JWT_SECRET=<your-secret>`
   - `FIREBASE_SERVICE_ACCOUNT=<your-json-string>`
6. Railway will automatically set `PORT` environment variable
7. Deploy!

### Step 3: Verify Deployment

1. Check Railway logs for "Server running on port XXXX"
2. Test health endpoint: `https://your-app.railway.app/health`
3. Should return: `{"status":"ok","timestamp":"..."}`

## Deployment to Render

### Step 1: Prepare Repository

Same as Railway - ensure `Procfile` and build script exist.

### Step 2: Deploy to Render

1. Go to [Render](https://render.com) and sign up/login
2. Click "New" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: direct--backend (or your preferred name)
   - **Root Directory**: `direct--/backend`
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
5. Set environment variables:
   - `NODE_ENV=production`
   - `JWT_SECRET=<your-secret>`
   - `FIREBASE_SERVICE_ACCOUNT=<your-json-string>`
6. Render will automatically set `PORT`
7. Click "Create Web Service"

### Step 3: Verify Deployment

1. Check Render logs
2. Test health endpoint: `https://your-app.onrender.com/health`
3. Should return: `{"status":"ok","timestamp":"..."}`

## Post-Deployment

### 1. Test API Endpoints

```bash
# Health check
curl https://your-app.railway.app/health

# Register request (replace with your URL)
curl -X POST https://your-app.railway.app/register-request \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"+1234567890"}'
```

### 2. Monitor Logs

- Railway: Dashboard → Your Service → Logs
- Render: Dashboard → Your Service → Logs

### 3. Set Up Custom Domain (Optional)

Both platforms support custom domains:
- Railway: Settings → Domains
- Render: Settings → Custom Domains

## Troubleshooting

### Common Issues

1. **Port Error**: Ensure `PORT` is read from `process.env.PORT || 3000`
2. **Firebase Error**: Verify `FIREBASE_SERVICE_ACCOUNT` is valid JSON string
3. **Build Fails**: Check that all dependencies are in `package.json`
4. **App Sleeps**: Free tier apps sleep after inactivity (Render: 15min, Railway: 30min)

### Debugging

1. Check application logs in platform dashboard
2. Verify environment variables are set correctly
3. Test locally with same environment variables
4. Check Firebase console for database access issues

## Security Checklist

- [ ] JWT_SECRET is strong and random
- [ ] FIREBASE_SERVICE_ACCOUNT is set as environment variable (not in code)
- [ ] CORS is configured for production (update in `index.ts` if needed)
- [ ] All sensitive data is in environment variables
- [ ] `.env` file is in `.gitignore`

## Next Steps

1. Set up SMS service integration (Twilio/AWS SNS)
2. Configure CORS for your frontend domain
3. Set up monitoring and alerts
4. Configure custom domain
5. Set up CI/CD for automatic deployments

## Support

For issues:
- Check platform documentation: [Railway Docs](https://docs.railway.app) | [Render Docs](https://render.com/docs)
- Review application logs
- Test endpoints using curl or Postman

