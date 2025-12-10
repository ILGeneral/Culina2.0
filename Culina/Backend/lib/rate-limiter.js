import rateLimit from 'express-rate-limit';

/**
 * Helper function to generate rate limit key based on user ID from auth token
 * Falls back to IP address if no valid auth token is present
 */
const getUserKeyGenerator = (req) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.split('Bearer ')[1];
      // Decode JWT payload without verification (verification happens in API handlers)
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      return payload.uid || payload.user_id || req.ip; // Fall back to IP if no UID
    } catch (e) {
      // If token parsing fails, fall back to IP
      return req.ip;
    }
  }
  // If no auth header, use IP address
  return req.ip;
};

/**
 * General API rate limiter
 * Applied to most endpoints
 */
export const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute window
  max: 30, // 30 requests per min per IP
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

// Chatbot Limiter
export const chatbotLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 chatbot messages per minute per user
  message: {
    error: 'Too many chatbot requests. Please slow down.',
    limit: '10 messages per minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserKeyGenerator,
});

//Image upload rate limiter
export const uploadLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 min
  max: 5, // 5 uploads per min per user
  message: {
    error: 'Too many uploads. Please wait before uploading again.',
    limit: '5 uploads per minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserKeyGenerator,
});

// Recipe gen rate limiter
export const recipeGenLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15, // 15 requests per minute per user accounts for retries
  message: {
    error: 'You\'re generating recipes too quickly. Please wait a moment and try again.',
    limit: '15 requests per minute',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: getUserKeyGenerator,
  // Don't count requests that fail due to Groq rate limits
  skipFailedRequests: true,
});
