'use strict';

const express    = require('express');
const cors       = require('cors');
const helmet     = require('helmet');
const morgan     = require('morgan');
const rateLimit  = require('express-rate-limit');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { successResponse }        = require('./utils/responseFormatter');

const app = express();

// ─── Security Middleware ────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS ───────────────────────────────────────────────────────────────────
// Accepts an array of allowed origins via CLIENT_URL (comma-separated for multi).
// Falls back to * in development if not set.
// In production set CLIENT_URL to your exact Render frontend URL.
const buildAllowedOrigins = () => {
  const raw = process.env.CLIENT_URL || '';
  if (!raw || raw === '*') return null; // null → allow all (dev fallback)
  return raw.split(',').map(o => o.trim()).filter(Boolean);
};

const allowedOrigins = buildAllowedOrigins();

app.use(
  cors({
    origin: allowedOrigins
      ? (origin, callback) => {
          // Allow requests with no origin (curl, mobile apps, Render health checks)
          if (!origin) return callback(null, true);
          if (allowedOrigins.includes(origin)) return callback(null, true);
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      : '*',
    methods:        ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials:    true,
  })
);

// ─── Request Logging ─────────────────────────────────────────────────────────
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ─── Body Parsing ────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Auth Rate Limiter ───────────────────────────────────────────────────────
// Applies ONLY to /api/auth routes — 10 requests per 15-minute window per IP.
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

// ─── Health Check Route ──────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  successResponse(res, 200, 'FreightFlow API is healthy', {
    status:      'UP',
    environment: process.env.NODE_ENV || 'development',
    timestamp:   new Date().toISOString(),
    uptime:      `${Math.floor(process.uptime())}s`,
  });
});

// ─── API Routes ──────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const driverRoutes   = require('./routes/driverRoutes');
const paymentRoutes  = require('./routes/paymentRoutes');

app.use('/api/auth',      authLimiter, authRoutes);  // rate-limited
app.use('/api/shipments', shipmentRoutes);
app.use('/api/admin',     adminRoutes);
app.use('/api/driver',    driverRoutes);
app.use('/api/payments',  paymentRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use(notFound);

// ─── Global Error Handler ────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
