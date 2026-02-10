/**
 * Rate Limiting Service
 * Prevents abuse by limiting requests per IP address
 */

import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Strict limiter for file uploads
export const uploadLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // Limit each IP to 50 uploads per windowMs
    message: 'Too many file uploads, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Session creation limiter
export const sessionLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // Limit each IP to 10 session creations per hour
    message: 'Too many sessions created, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});

// Analytics endpoint limiter (more permissive)
export const analyticsLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
});
