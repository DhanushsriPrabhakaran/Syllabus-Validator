import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import pino from 'pino';
import authRoutes from './routes/authRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import submissionRoutes from './routes/submissionRoutes.js';

const logger = pino({ name: 'app' });

export function createApp() {
  const app = express();

  // Security Middleware
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));

  // CORS Middleware
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  app.use(cors({
    origin: [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));

  app.use(cookieParser());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Health check endpoint
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'TCE Syllabus Validator API',
      regulation: process.env.CURRENT_REGULATION || '26',
      allowedDomain: process.env.ALLOWED_DOMAIN || 'tce.edu',
      timestamp: new Date().toISOString()
    });
  });

  // Mount API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/submissions', submissionRoutes);

  // Global Error Handler
  app.use((err, req, res, next) => {
    logger.error({ err }, 'Unhandled application error');
    res.status(err.status || 500).json({
      error: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {})
    });
  });

  return app;
}
