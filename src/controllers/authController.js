'use strict';

const crypto = require('crypto');
const jwt    = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const {
  OK, CREATED, BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE,
} = require('../utils/httpStatus');

// ─── Cookie Configuration ──────────────────────────────────────────────────────
const COOKIE_ACCESS_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   15 * 60 * 1000,              // 15 minutes
};

const COOKIE_REFRESH_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge:   7 * 24 * 60 * 60 * 1000,    // 7 days
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Sign a 15-minute JWT access token. */
const signAccessToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, { expiresIn: '15m' });

/**
 * Generate a cryptographically random refresh token.
 * Returns the raw token (sent as httpOnly cookie) and its SHA-256 hash (stored in DB).
 * SHA-256 is sufficient here — refresh tokens are already 320-bit entropy values,
 * making brute-force infeasible regardless of hash speed.
 */
const generateRefreshToken = () => {
  const raw  = crypto.randomBytes(40).toString('hex'); // 80-char hex, 320 bits
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
};

/** Set both auth cookies on a response. */
const setAuthCookies = (res, accessToken, rawRefreshToken) => {
  res.cookie('ff_access_token',  accessToken,      COOKIE_ACCESS_OPTS);
  res.cookie('ff_refresh_token', rawRefreshToken,   COOKIE_REFRESH_OPTS);
};

/** Clear both auth cookies (used by logout). */
const clearAuthCookies = (res) => {
  res.clearCookie('ff_access_token',  { ...COOKIE_ACCESS_OPTS,  maxAge: 0 });
  res.clearCookie('ff_refresh_token', { ...COOKIE_REFRESH_OPTS, maxAge: 0 });
};

/** Return a safe user object (no password, no refreshToken hash). */
const sanitizeUser = (user) => ({
  _id:       user._id,
  name:      user.name,
  email:     user.email,
  role:      user.role,
  isActive:  user.isActive,
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

// ─────────────────────────────────────────────────────────────────────────────
//  REGISTER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/register
 * Accepts: name, email, password, role ('shipper' | 'driver')
 * Sets httpOnly cookies on success. Returns user object (no token in body).
 */
const register = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, UNPROCESSABLE, errors.array()[0].msg);
    }

    const { name, email, password, role } = req.body;

    if (role === 'admin') {
      return errorResponse(
        res,
        FORBIDDEN,
        'Admin accounts cannot be created through registration. Contact your system administrator.'
      );
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return errorResponse(res, CONFLICT, 'An account with this email already exists.');
    }

    const user = await User.create({ name, email, password, role });

    // Issue tokens and set cookies
    const accessToken              = signAccessToken(user._id);
    const { raw, hash }            = generateRefreshToken();
    user.refreshToken              = hash;
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, accessToken, raw);

    return successResponse(res, CREATED, 'Account created successfully.', {
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  LOGIN
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/login
 * Accepts: email, password
 * Sets httpOnly cookies on success. Returns user object (no token in body).
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, UNPROCESSABLE, errors.array()[0].msg);
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password +refreshToken');

    if (!user || !(await user.comparePassword(password))) {
      return errorResponse(res, UNAUTHORIZED, 'Invalid email or password.');
    }

    if (!user.isActive) {
      return errorResponse(
        res,
        FORBIDDEN,
        'Your account has been deactivated. Please contact support.'
      );
    }

    // Issue tokens and set cookies
    const accessToken   = signAccessToken(user._id);
    const { raw, hash } = generateRefreshToken();
    user.refreshToken   = hash;
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, accessToken, raw);

    return successResponse(res, OK, 'Logged in successfully.', {
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  LOGOUT
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/logout
 * Requires: valid access token (protect middleware sets req.user).
 * Clears the DB refresh token hash and both cookies.
 */
const logout = async (req, res, next) => {
  try {
    // req.user is already the full Mongoose document — no second DB query needed
    req.user.refreshToken = null;
    await req.user.save({ validateBeforeSave: false });

    clearAuthCookies(res);

    return successResponse(res, OK, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  REFRESH TOKEN
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/refresh
 * Public endpoint — no protect middleware.
 * Reads ff_refresh_token cookie, verifies against DB hash, rotates both tokens.
 */
const refresh = async (req, res, next) => {
  try {
    const rawToken = req.cookies?.ff_refresh_token;

    if (!rawToken) {
      return errorResponse(res, UNAUTHORIZED, 'No refresh token provided. Please log in again.');
    }

    const hash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // Find user whose stored refresh token hash matches
    const user = await User.findOne({ refreshToken: hash }).select('+refreshToken');

    if (!user) {
      // Token not found — either already rotated (reuse attempt) or never issued
      return errorResponse(res, UNAUTHORIZED, 'Invalid or expired refresh token. Please log in again.');
    }

    if (!user.isActive) {
      return errorResponse(res, FORBIDDEN, 'Your account has been deactivated. Please contact support.');
    }

    // Rotate: issue new access token + new refresh token (single-use invalidation)
    const accessToken              = signAccessToken(user._id);
    const { raw: newRaw, hash: newHash } = generateRefreshToken();
    user.refreshToken              = newHash;
    await user.save({ validateBeforeSave: false });

    setAuthCookies(res, accessToken, newRaw);

    return successResponse(res, OK, 'Token refreshed successfully.');
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  GET ME
// ─────────────────────────────────────────────────────────────────────────────
/**
 * GET /api/auth/me
 * Returns the profile of the currently authenticated user.
 * Uses req.user from protect middleware — no second DB query needed.
 */
const getMe = async (req, res, next) => {
  try {
    // req.user is already set by protect middleware — no additional DB call required
    return successResponse(res, OK, 'Profile retrieved successfully.', {
      user: sanitizeUser(req.user),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, logout, refresh, getMe };
