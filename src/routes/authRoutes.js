'use strict';

const express    = require('express');
const { body }   = require('express-validator');
const { register, login, logout, refresh, getMe, getCsrfToken } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');
const { authLimiter, refreshLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

// ─── Validation Rules ─────────────────────────────────────────────────────────

const registerValidation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required.')
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters.'),

  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required.')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .isLength({ max: 128 })
    .withMessage('Password cannot exceed 128 characters.'),

  body('role')
    .optional()
    .isIn(['shipper', 'driver'])
    .withMessage("Role must be either 'shipper' or 'driver'."),
];

const loginValidation = [
  body('email')
    .trim()
    .notEmpty()
    .withMessage('Email is required.')
    .isEmail()
    .withMessage('Please provide a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty()
    .withMessage('Password is required.'),
];

// ─── Routes ───────────────────────────────────────────────────────────────────

// @route   GET /api/auth/csrf
// @desc    Issue CSRF token cookie + response body token for unsafe requests
// @access  Public
router.get('/csrf', getCsrfToken);

// @route   POST /api/auth/register
// @desc    Register a new shipper or driver — sets httpOnly auth cookies
// @access  Public
router.post('/register', authLimiter, registerValidation, register);

// @route   POST /api/auth/login
// @desc    Authenticate user — sets httpOnly auth cookies, returns user object
// @access  Public
router.post('/login', authLimiter, loginValidation, login);

// @route   POST /api/auth/refresh
// @desc    Rotate refresh token — issues new 15-min access + 7-day refresh cookies
// @access  Public (reads ff_refresh_token cookie)
// NOTE: Uses its own 60 req/15min limiter — higher than the 10 req/15min authLimiter
//       applied in app.js, because automated token rotation fires without user action.
router.post('/refresh', refreshLimiter, refresh);

// @route   POST /api/auth/logout
// @desc    Invalidate refresh token in DB + clear both auth cookies
// @access  Private (requires valid access token cookie)
router.post('/logout', protect, logout);

// @route   GET /api/auth/me
// @desc    Get currently authenticated user's profile
// @access  Private (all roles)
router.get('/me', protect, getMe);

module.exports = router;
