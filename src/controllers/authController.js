'use strict';

const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const User = require('../models/User');
const { successResponse, errorResponse } = require('../utils/responseFormatter');
const {
  OK, CREATED, BAD_REQUEST, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, UNPROCESSABLE,
} = require('../utils/httpStatus');

// ─── Helper: Sign JWT ─────────────────────────────────────────────────────────
const signToken = (userId) =>
  jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// ─── Helper: Safe User Object ─────────────────────────────────────────────────
const sanitizeUser = (user) => {
  const obj = user.toJSON();
  delete obj.password;
  return obj;
};

// ─────────────────────────────────────────────────────────────────────────────
//  REGISTER
// ─────────────────────────────────────────────────────────────────────────────
/**
 * POST /api/auth/register
 * Accepts: name, email, password, role ('shipper' | 'driver')
 * Admin accounts cannot be created through this endpoint.
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

    const user  = await User.create({ name, email, password, role });
    const token = signToken(user._id);

    return successResponse(res, CREATED, 'Account created successfully.', {
      token,
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
 * Returns: JWT token and user details (no password)
 */
const login = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return errorResponse(res, UNPROCESSABLE, errors.array()[0].msg);
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');

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

    const token = signToken(user._id);

    return successResponse(res, OK, 'Logged in successfully.', {
      token,
      user: {
        id:    user._id,
        name:  user.name,
        email: user.email,
        role:  user.role,
      },
    });
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
 * Requires: protect middleware (req.user is populated)
 */
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return errorResponse(res, NOT_FOUND, 'User not found.');
    }

    return successResponse(res, OK, 'Profile retrieved successfully.', {
      user: sanitizeUser(user),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getMe };
