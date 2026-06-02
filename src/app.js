'use strict';

const express        = require('express');
const cors           = require('cors');
const helmet         = require('helmet');
const pinoHttp       = require('pino-http');
const cookieParser   = require('cookie-parser');
const mongoSanitize  = require('express-mongo-sanitize');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const { buildAllowedOrigins, configureTrustProxy } = require('./config/security');
const logger = require('./config/logger');
const healthRoutes = require('./routes/healthRoutes');
const metricsRoutes = require('./routes/metricsRoutes');
const { requestId } = require('./middlewares/requestId');
const { csrfProtection } = require('./middlewares/csrfProtection');
const { generalLimiter } = require('./middlewares/rateLimiters');
const { requestMetricsMiddleware } = require('./services/metricsService');

const app = express();

configureTrustProxy(app);

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet());

// ─── Request Correlation + Structured Logging ────────────────────────────────
app.use(requestId);
app.use(
  pinoHttp({
    logger,
    genReqId: (req) => req.id,
    customProps: (req) => ({ requestId: req.id }),
    quietReqLogger: true,
  })
);
app.use(requestMetricsMiddleware);

// ─── Cookie Parser (MUST be before routes so req.cookies is populated) ───────
app.use(cookieParser());

// ─── CORS ────────────────────────────────────────────────────────────────────
// Accepts an array of allowed origins via CLIENT_URL (comma-separated for multi).
// NEVER returns '*' — wildcard is incompatible with credentialed cookie requests.
// In production set CLIENT_URL to your exact Render frontend URL.
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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'Idempotency-Key'],
    credentials:    true,
  })
);

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── NoSQL Injection Sanitization ────────────────────────────────────────────
// Strips MongoDB operator keys ($gt, $ne, etc.) from req.body, req.query,
// and req.params AFTER body parsing so all three are available.
// replaceWith: '_' — substitutes operators instead of silently removing them,
// making injection attempts visible in logs rather than transparently ignored.
app.use(mongoSanitize({ replaceWith: '_' }));

// ─── CSRF Protection ─────────────────────────────────────────────────────────
// Cookie-based auth needs a CSRF header on unsafe methods. GET/HEAD/OPTIONS and
// the token bootstrap endpoint remain open so the SPA can initialize safely.
app.use(csrfProtection);

// ─── Health / Readiness Routes ────────────────────────────────────────────────
app.use('/api', healthRoutes);
app.use('/api', metricsRoutes);

// ─── API Routes ───────────────────────────────────────────────────────────────
const authRoutes     = require('./routes/authRoutes');
const shipmentRoutes = require('./routes/shipmentRoutes');
const adminRoutes    = require('./routes/adminRoutes');
const driverRoutes   = require('./routes/driverRoutes');
const paymentRoutes  = require('./routes/paymentRoutes');

app.use('/api/auth',      authRoutes);                     // authRoutes applies strict/refresh limits per endpoint
app.use('/api/shipments', generalLimiter, shipmentRoutes); // 100 req/15min — business routes
app.use('/api/admin',     generalLimiter, adminRoutes);    // 100 req/15min — business routes
app.use('/api/driver',    generalLimiter, driverRoutes);   // 100 req/15min — business routes
app.use('/api/payments',  generalLimiter, paymentRoutes);  // 100 req/15min — business routes

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use(notFound);

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
