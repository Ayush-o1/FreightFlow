'use strict';

const express      = require('express');
const cors         = require('cors');
const helmet       = require('helmet');
const morgan       = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit    = require('express-rate-limit');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { successResponse }        = require('./utils/responseFormatter');

const app = express();

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());

// ─── Cookie Parser (MUST be before routes so req.cookies is populated) ───────
app.use(cookieParser());

// ─── CORS ────────────────────────────────────────────────────────────────────
// Accepts an array of allowed origins via CLIENT_URL (comma-separated for multi).
// NEVER returns '*' — wildcard is incompatible with credentialed cookie requests.
// In production set CLIENT_URL to your exact Render frontend URL.
const buildAllowedOrigins = () => {
  const raw = process.env.CLIENT_URL || '';
  if (!raw || raw === '*') {
    // Dev fallback — localhost Vite ports only (never wildcard with credentials)
    return process.env.NODE_ENV === 'production'
      ? []  // Production MUST set CLIENT_URL explicitly
      : ['http://localhost:5173', 'http://localhost:5174'];
  }
  return raw.split(',').map((o) => o.trim()).filter(Boolean);
};

const allowedOrigins = buildAllowedOrigins();

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, mobile apps, Render health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:    true,
  })
);

// ─── Request Logging ──────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Rate Limiters ────────────────────────────────────────────────────────────

// Auth routes: 10 requests per 15-minute window per IP (login, register, logout, me)
const authLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    res.status(429).json({
      success:    false,
      statusCode: 429,
      message:    'Too many requests. Please try again after 15 minutes.',
    });
  },
});

// Refresh endpoint: 60 requests per 15-minute window per IP
// Higher limit — automated token refresh fires without user action.
const refreshLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  handler: (req, res) => {
    res.status(429).json({
      success:    false,
      statusCode: 429,
      message:    'Too many token refresh attempts. Please try again later.',
    });
  },
});

// ─── Health Check Route ───────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  successResponse(res, 200, 'FreightFlow API is healthy', {
    status:      'UP',
    environment: process.env.NODE_ENV || 'development',
    timestamp:   new Date().toISOString(),
    uptime:      `${Math.floor(process.uptime())}s`,
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const driverRoutes   = require('./routes/driverRoutes');
const paymentRoutes  = require('./routes/paymentRoutes');

// Token refresh route gets its own higher-ceiling limiter, applied before the router.
// POST /api/auth/refresh is mounted via authRoutes but needs a different rate limit,
// so we apply refreshLimiter as a path-specific middleware here, before authRoutes.
app.use('/api/auth/refresh', refreshLimiter);

app.use('/api/auth',      authLimiter, authRoutes);  // login, register, logout, me (10/15min)
app.use('/api/shipments', shipmentRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/driver',    driverRoutes);
app.use('/api/payments',  paymentRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use(notFound);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
