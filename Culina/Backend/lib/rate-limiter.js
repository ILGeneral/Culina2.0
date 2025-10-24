import rateLimit from 'express-rate-limit';

/**
 * General API rate limiter
 * Applied to most endpoints
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // 30 requests per minute per IP
  message: {
    error: 'Too many requests from this IP. Please try again later.',
    retryAfter: '1 minute',
  },
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  // Store in memory (OK for Vercel serverless, resets on cold start)
  skip: (req) => {
    // Skip rate limiting for OPTIONS preflight requests
    return req.method === 'OPTIONS';
  },
});

/**
 * Chatbot-specific rate limiter
 * More restrictive due to expensive LLM calls
 */
export const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 chatbot messages per minute
  message: {
    error: 'Too many chatbot requests. Please slow down.',
    limit: '10 messages per minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

//Image upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5, // 5 uploads per min
  message: {
    error: 'Too many uploads. Please wait before uploading again.',
    limit: '5 uploads per minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Image detection rate limiter
export const clarifaiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15, // 15 image recognitions per minute
  message: {
    error: 'Too many image detection requests.',
    limit: '15 requests per minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Recipe generation rate limiter
export const recipeGenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 8, // 8 recipe generations per minute
  message: {
    error: 'Too many recipe generation requests.',
    limit: '8 requests per minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
});
