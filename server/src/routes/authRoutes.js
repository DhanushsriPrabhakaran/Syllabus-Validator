import express from 'express';
import {
  validateGooglePayload,
  verifyGoogleIdToken,
  authenticateFromPayload,
  TOKEN_COOKIE_NAME,
  SEVEN_DAYS_MS
} from '../services/authService.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const router = express.Router();

function setAuthCookie(res, token) {
  res.cookie(TOKEN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SEVEN_DAYS_MS
  });
}

/**
 * POST /api/auth/google
 * Exchange Google ID token for authenticated session
 */
router.post('/google', async (req, res, next) => {
  try {
    const { credential, idToken } = req.body;
    const tokenToVerify = credential || idToken;

    if (!tokenToVerify) {
      return res.status(400).json({ error: 'Google credential / idToken is required' });
    }

    const payload = await verifyGoogleIdToken(tokenToVerify);
    const validatedData = validateGooglePayload(payload);
    const { user, token } = await authenticateFromPayload(validatedData);

    setAuthCookie(res, token);

    return res.json({
      message: 'Authentication successful',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        picture: user.picture,
        department: user.department,
        role: user.role
      },
      token
    });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({ error: err.message });
    }
    return res.status(401).json({ error: err.message || 'Google token verification failed' });
  }
});

/**
 * GET /api/auth/me
 * Returns current authenticated user
 */
router.get('/me', requireAuth, (req, res) => {
  const user = req.user;
  res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      department: user.department,
      role: user.role
    }
  });
});

/**
 * POST /api/auth/logout
 * Clears authentication cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie(TOKEN_COOKIE_NAME, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax'
  });
  res.json({ message: 'Successfully signed out' });
});

/**
 * Development-only login endpoint (enabled in non-production)
 */
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev-login', async (req, res, next) => {
    try {
      const { email, name, role, department } = req.body;
      const normalizedEmail = (email || 'staff@tce.edu').toLowerCase().trim();

      // Enforce the same domain validation rules even in dev-login
      const payload = {
        sub: `dev-google-id-${Date.now()}`,
        email: normalizedEmail,
        email_verified: true,
        hd: 'tce.edu',
        name: name || 'TCE Faculty',
        picture: ''
      };

      const validatedData = validateGooglePayload(payload);
      const { user, token } = await authenticateFromPayload(validatedData);

      if (department) {
        user.department = department;
        await user.save();
      }
      if (role && ['staff', 'admin'].includes(role)) {
        user.role = role;
        await user.save();
      }

      setAuthCookie(res, token);

      return res.json({
        message: 'Dev login successful',
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          picture: user.picture,
          department: user.department,
          role: user.role
        },
        token
      });
    } catch (err) {
      next(err);
    }
  });
}

export default router;
