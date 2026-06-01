'use strict';

const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { errorResponse } = require('../utils/responseFormatter');

// ─────────────────────────────────────────────────────────────────────────────
//  PROTECT MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Verifies the Bearer JWT from the Authorization header.
 * On success, attaches the decoded user to req.user.
 * On failure, returns 401 Unauthorized.
 *
 * Usage: router.get('/protected', protect, handler)
 */
const protect = async (req, res, next) => {
  try {
    // 1. Extract token — cookie takes priority over Authorization header.
    //    Cookie:  set by login/register/refresh endpoints (httpOnly, not JS-readable)
    //    Header:  fallback for API clients (curl, Postman, mobile apps)
    let token = req.cookies?.ff_access_token;

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (!token) {
      return errorResponse(
        res,
        401,
        'Access denied. No token provided. Please log in.'
      );
    }

    // 2. Verify token (throws JsonWebTokenError or TokenExpiredError on failure)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Check that the user referenced by the token still exists and is active
    const currentUser = await User.findById(decoded.id);

    if (!currentUser) {
      return errorResponse(
        res,
        401,
        'The user associated with this token no longer exists.'
      );
    }

    if (!currentUser.isActive) {
      return errorResponse(
        res,
        403,
        'Your account has been deactivated. Please contact support.'
      );
    }

    // 4. Attach user to request object for downstream middleware and controllers
    req.user = currentUser;
    next();
  } catch (error) {
    // Let the global error handler normalize JWT-specific errors
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
//  AUTHORIZE ROLES MIDDLEWARE
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Role-based access control guard.
 * Must be used AFTER the protect middleware (req.user must exist).
 *
 * @param {...string} roles - Allowed roles, e.g. authorizeRoles('admin', 'driver')
 * @returns {import('express').RequestHandler}
 *
 * Usage: router.patch('/assign', protect, authorizeRoles('admin'), handler)
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return errorResponse(
        res,
        403,
        `Access denied. This action requires one of the following roles: ${roles.join(', ')}.`
      );
    }
    next();
  };
};

module.exports = { protect, authorizeRoles };
