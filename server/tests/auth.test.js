import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { User } from '../src/models/User.js';
import { validateGooglePayload } from '../src/services/authService.js';

describe('Phase 2: Authentication & Domain Restriction Tests', () => {
  let app;

  beforeAll(async () => {
    process.env.ADMIN_EMAILS = 'admin@tce.edu,hod.cse@tce.edu';
    process.env.ALLOWED_DOMAIN = 'tce.edu';
    app = createApp();
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await User.deleteMany({});
  });

  describe('Unit: validateGooglePayload', () => {
    it('rejects unverified Google emails with 403', () => {
      expect(() => {
        validateGooglePayload({
          email: 'prof@tce.edu',
          email_verified: false,
          hd: 'tce.edu',
          sub: '123'
        });
      }).toThrowError(/not verified/);
    });

    it('rejects accounts without tce.edu hd claim with 403', () => {
      expect(() => {
        validateGooglePayload({
          email: 'prof@tce.edu',
          email_verified: true,
          hd: 'gmail.com',
          sub: '123'
        });
      }).toThrowError(/Only TCE staff accounts/);
    });

    it('rejects general gmail.com emails with 403', () => {
      expect(() => {
        validateGooglePayload({
          email: 'prof@gmail.com',
          email_verified: true,
          hd: 'gmail.com',
          sub: '123'
        });
      }).toThrowError(/Only TCE staff accounts/);
    });

    it('rejects subdomain emails such as student.tce.edu with 403', () => {
      expect(() => {
        validateGooglePayload({
          email: 'student@student.tce.edu',
          email_verified: true,
          hd: 'student.tce.edu',
          sub: '123'
        });
      }).toThrowError(/Only TCE staff accounts/);
    });

    it('accepts valid @tce.edu staff email', () => {
      const result = validateGooglePayload({
        email: 'P.Sharmila@tce.edu',
        email_verified: true,
        hd: 'tce.edu',
        sub: 'google-sub-456',
        name: 'Dr. P. Sharmila'
      });

      expect(result.email).toBe('p.sharmila@tce.edu');
      expect(result.googleId).toBe('google-sub-456');
      expect(result.name).toBe('Dr. P. Sharmila');
    });
  });

  describe('Integration: Auth Flow & Session Management', () => {
    it('POST /api/auth/dev-login rejects invalid domain and does NOT create a user record', async () => {
      const res = await request(app)
        .post('/api/auth/dev-login')
        .send({
          email: 'hacker@gmail.com',
          name: 'External User'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only TCE staff accounts');

      const userInDb = await User.findOne({ email: 'hacker@gmail.com' });
      expect(userInDb).toBeNull();
    });

    it('POST /api/auth/dev-login rejects student.tce.edu and creates no record', async () => {
      const res = await request(app)
        .post('/api/auth/dev-login')
        .send({
          email: 'student22@student.tce.edu',
          name: 'Student'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Only TCE staff accounts');

      const userInDb = await User.findOne({ email: 'student22@student.tce.edu' });
      expect(userInDb).toBeNull();
    });

    it('POST /api/auth/dev-login succeeds for valid staff and sets httpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/auth/dev-login')
        .send({
          email: 'faculty@tce.edu',
          name: 'TCE Faculty'
        });

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe('faculty@tce.edu');
      expect(res.body.user.role).toBe('staff');
      expect(res.body.token).toBeDefined();

      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('tce_auth_token');
      expect(cookies[0].toLowerCase()).toContain('httponly');

      // Verify user in DB
      const user = await User.findOne({ email: 'faculty@tce.edu' });
      expect(user).not.toBeNull();
      expect(user.role).toBe('staff');
    });

    it('assigns admin role to users listed in ADMIN_EMAILS', async () => {
      const res = await request(app)
        .post('/api/auth/dev-login')
        .send({
          email: 'admin@tce.edu',
          name: 'TCE Admin'
        });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe('admin');
    });

    it('GET /api/auth/me returns 401 when not authenticated', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Authentication required');
    });

    it('GET /api/auth/me returns user profile when authenticated with cookie', async () => {
      const loginRes = await request(app)
        .post('/api/auth/dev-login')
        .send({
          email: 'faculty@tce.edu',
          name: 'TCE Faculty'
        });

      const cookie = loginRes.headers['set-cookie'];

      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Cookie', cookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user.email).toBe('faculty@tce.edu');
    });

    it('PUT /api/profile updates user department from allowed list', async () => {
      const loginRes = await request(app)
        .post('/api/auth/dev-login')
        .send({
          email: 'prof.ca@tce.edu',
          name: 'CA Professor'
        });

      const cookie = loginRes.headers['set-cookie'];

      // Attempt invalid department
      const invalidRes = await request(app)
        .put('/api/profile')
        .set('Cookie', cookie)
        .send({ department: 'INVALID_DEPT' });

      expect(invalidRes.status).toBe(400);
      expect(invalidRes.body.error).toContain('Invalid department code');

      // Set valid department CA
      const validRes = await request(app)
        .put('/api/profile')
        .set('Cookie', cookie)
        .send({ department: 'CA' });

      expect(validRes.status).toBe(200);
      expect(validRes.body.user.department).toBe('CA');

      // Verify in DB
      const user = await User.findOne({ email: 'prof.ca@tce.edu' });
      expect(user.department).toBe('CA');
    });

    it('POST /api/auth/logout clears auth cookie', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies[0]).toContain('tce_auth_token=;');
    });
  });
});
