'use strict';

const express = require('express');
const { body } = require('express-validator');
const { register, login, logout, refresh, getMe } = require('../controllers/authController');
const { protect } = require('../middlewares/auth');

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
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long.'),

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

// @route   POST /api/auth/register
// @desc    Register a new shipper or driver — sets httpOnly auth cookies
// @access  Public
router.post('/register', registerValidation, register);

// @route   POST /api/auth/login
// @desc    Authenticate user — sets httpOnly auth cookies, returns user object
// @access  Public
router.post('/login', loginValidation, login);

// @route   POST /api/auth/refresh
// @desc    Rotate refresh token — issues new 15-min access + 7-day refresh cookies
// @access  Public (reads ff_refresh_token cookie)
// NOTE: The refreshLimiter (60/15min) is applied in app.js before this router.
router.post('/refresh', refresh);

// @route   POST /api/auth/logout
// @desc    Invalidate refresh token in DB + clear both auth cookies
// @access  Private (requires valid access token cookie)
router.post('/logout', protect, logout);

// @route   GET /api/auth/me
// @desc    Get currently authenticated user's profile
// @access  Private (all roles)
router.get('/me', protect, getMe);

module.exports = router;
