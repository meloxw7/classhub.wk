import Redis from 'ioredis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
let redis: Redis | null = null;
let redisAvailable = false;

export function getRedis(): Redis | null {
  if (!redisAvailable) return null;
  return redis;
}

export async function initRedis(): Promise<void> {
  try {
    redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });
    redis.on('error', () => {
      redisAvailable = false;
    });
    redis.on('connect', () => {
      redisAvailable = true;
    });
    await redis.connect();
    redisAvailable = true;
    console.log('Redis conectado para rate limiting');
  } catch (error) {
    console.warn('Redis não disponível, usando rate limiter em memória:', error);
    redisAvailable = false;
  }
}

export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    redisAvailable = false;
  }
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export async function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowSec = Math.ceil(windowMs / 1000);
  const redisClient = getRedis();

  if (redisClient && redisAvailable) {
    try {
      const pipeline = redisClient.pipeline();
      pipeline.incr(key);
      pipeline.pttl(key);
      if (await redisClient.ttl(key) === -1) {
        pipeline.expire(key, windowSec);
      }
      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number;
      const ttl = results?.[1]?.[1] as number;
      const resetTime = now + (ttl > 0 ? ttl : windowMs);
      return {
        allowed: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
        resetTime,
      };
    } catch {
      // fallback to memory
    }
  }

  return memoryRateLimit(key, maxRequests, windowMs);
}

const memoryStore = new Map<string, { count: number; resetTime: number }>();

function memoryRateLimit(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);
  if (!entry || now > entry.resetTime) {
    memoryStore.set(key, { count: 1, resetTime: now + windowMs });
    if (memoryStore.size > 10000) {
      for (const [k, v] of memoryStore.entries()) {
        if (now > v.resetTime) memoryStore.delete(k);
      }
    }
    return { allowed: true, remaining: maxRequests - 1, resetTime: now + windowMs };
  }
  entry.count++;
  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
    resetTime: entry.resetTime,
  };
}

export function createRateLimiter(
  maxRequests: number,
  windowMs: number,
  keyPrefix: string
) {
  return async (req: any, res: any, next: any) => {
    const ip = req.ip || 'unknown';
    const key = `${keyPrefix}:${ip}`;
    const result = await rateLimit(key, maxRequests, windowMs);
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000));
    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);
      return res.status(429).json({
        message: 'Muitas requisições. Tente novamente em instantes.',
        retryAfter,
      });
    }
    next();
  };
}

export interface WsRateLimitResult {
  allowed: boolean;
  remaining: number;
}

const wsMemoryStore = new Map<string, { count: number; resetTime: number }>();

export async function wsRateLimit(
  userId: string,
  maxRequests: number,
  windowMs: number
): Promise<WsRateLimitResult> {
  const key = `ws:${userId}`;
  const redisClient = getRedis();

  if (redisClient && redisAvailable) {
    try {
      const pipeline = redisClient.pipeline();
      pipeline.incr(key);
      pipeline.pttl(key);
      if (await redisClient.ttl(key) === -1) {
        pipeline.expire(key, Math.ceil(windowMs / 1000));
      }
      const results = await pipeline.exec();
      const count = results?.[0]?.[1] as number;
      return {
        allowed: count <= maxRequests,
        remaining: Math.max(0, maxRequests - count),
      };
    } catch {
      // fallback to memory
    }
  }

  return wsMemoryRateLimit(key, maxRequests, windowMs);
}

function wsMemoryRateLimit(key: string, maxRequests: number, windowMs: number): WsRateLimitResult {
  const now = Date.now();
  const entry = wsMemoryStore.get(key);
  if (!entry || now > entry.resetTime) {
    wsMemoryStore.set(key, { count: 1, resetTime: now + windowMs });
    if (wsMemoryStore.size > 5000) {
      for (const [k, v] of wsMemoryStore.entries()) {
        if (now > v.resetTime) wsMemoryStore.delete(k);
      }
    }
    return { allowed: true, remaining: maxRequests - 1 };
  }
  entry.count++;
  return {
    allowed: entry.count <= maxRequests,
    remaining: Math.max(0, maxRequests - entry.count),
  };
}