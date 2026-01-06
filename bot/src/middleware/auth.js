import jwt from 'jsonwebtoken';
import logger from '../utils/logger.js';

const authMiddleware = (req, res, next) => {
  try {
    // Check for API key in header (for GitHub Actions)
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.API_KEY) {
      req.authType = 'api-key';
      return next();
    }

    // Check for Bearer token (for admin dashboard)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    req.authType = 'jwt';

    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Middleware to verify user session (JWT or API key)
 * Same as authMiddleware but exported as named export for clarity
 */
export const verifySession = (req, res, next) => {
  try {
    // Check for API key in header (for GitHub Actions)
    const apiKey = req.headers['x-api-key'];
    if (apiKey && apiKey === process.env.API_KEY) {
      req.authType = 'api-key';
      return next();
    }

    // Check for Bearer token (for admin dashboard)
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    req.authType = 'jwt';

    next();
  } catch (error) {
    logger.error('Authentication error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }

    res.status(500).json({ error: 'Authentication error' });
  }
};

/**
 * Middleware to require admin privileges
 * Must be used after verifySession
 */
export const requireAdmin = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Check if user has admin role
    const isAdmin = req.user.isAdmin === true ||
                    req.user.role === 'admin' ||
                    (typeof req.user.isAdmin === 'function' && req.user.isAdmin());

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    logger.error('Admin check error:', error);
    res.status(500).json({ error: 'Authorization error' });
  }
};

export default authMiddleware;