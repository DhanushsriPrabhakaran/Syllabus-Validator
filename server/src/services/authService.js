import { OAuth2Client } from 'google-auth-library';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import pino from 'pino';

const logger = pino({ name: 'authService' });
const oauthClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const EXACT_TCE_EMAIL_REGEX = /^[^@\s]+@tce\.edu$/;
const TOKEN_COOKIE_NAME = 'tce_auth_token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export { TOKEN_COOKIE_NAME, SEVEN_DAYS_MS };

/**
 * Validates Google payload according to TCE strict guidelines:
 * 1. email_verified === true
 * 2. hd === 'tce.edu'
 * 3. email matches /^[^@\s]+@tce\.edu$/ (exact domain, rejecting student.tce.edu)
 */
export function validateGooglePayload(payload) {
  if (!payload) {
    throw new Error('Invalid token payload');
  }

  const { email, email_verified, hd, sub, name, picture } = payload;
  const normalizedEmail = (email || '').toLowerCase().trim();

  if (!email_verified) {
    const err = new Error('Google account email is not verified');
    err.status = 403;
    throw err;
  }

  const expectedDomain = process.env.ALLOWED_DOMAIN || 'tce.edu';
  if (hd !== expectedDomain) {
    const err = new Error(`Only TCE staff accounts (@${expectedDomain}) are allowed`);
    err.status = 403;
    throw err;
  }

  if (!EXACT_TCE_EMAIL_REGEX.test(normalizedEmail)) {
    const err = new Error('Only TCE staff accounts (@tce.edu) are allowed');
    err.status = 403;
    throw err;
  }

  return {
    googleId: sub,
    email: normalizedEmail,
    name: name || normalizedEmail.split('@')[0],
    picture: picture || ''
  };
}

/**
 * Verifies Google ID Token via Google API (or test verifier in unit tests)
 */
export async function verifyGoogleIdToken(idToken, customVerifier = null) {
  if (customVerifier) {
    return await customVerifier(idToken);
  }

  const ticket = await oauthClient.verifyIdToken({
    idToken,
    audience: process.env.GOOGLE_CLIENT_ID
  });
  return ticket.getPayload();
}

/**
 * Determines role from ADMIN_EMAILS environment variable
 */
export function determineRole(email) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.toLowerCase()) ? 'admin' : 'staff';
}

/**
 * Signs JWT token with 7-day expiration
 */
export function signJwtToken(user) {
  const secret = process.env.JWT_SECRET || 'fallback_secret_for_development_2026';
  return jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      department: user.department
    },
    secret,
    { expiresIn: '7d' }
  );
}

/**
 * Authenticates user from verified payload: upserts user and generates JWT
 */
export async function authenticateFromPayload(validatedData) {
  const { googleId, email, name, picture } = validatedData;
  const role = determineRole(email);

  let user = await User.findOne({ email });

  if (user) {
    user.lastLoginAt = new Date();
    user.name = name || user.name;
    user.picture = picture || user.picture;
    if (user.role !== 'admin' && role === 'admin') {
      user.role = 'admin';
    }
    await user.save();
  } else {
    user = await User.create({
      googleId,
      email,
      name,
      picture,
      role,
      lastLoginAt: new Date()
    });
    logger.info({ userId: user._id, email: user.email, role: user.role }, 'New TCE staff account created');
  }

  const token = signJwtToken(user);
  return { user, token };
}
