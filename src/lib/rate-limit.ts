import { Redis } from '@upstash/redis';
import { NextResponse } from 'next/server';

// -------------------------------------------------------------
// 🛡️ UPSTASH REDIS MOCK FOR TESTING / LOCAL DEVS WITHOUT ENVS
// -------------------------------------------------------------
function createMockRedis() {
  const store = new Map<string, Array<{ score: number; member: string }>>();

  const zremrangebyscore = (key: string, min: number, max: number) => {
    let set = store.get(key) || [];
    const lenBefore = set.length;
    set = set.filter(item => item.score < min || item.score > max);
    store.set(key, set);
    return lenBefore - set.length;
  };

  const zadd = (key: string, data: { score: number; member: string }) => {
    let set = store.get(key) || [];
    set.push(data);
    set.sort((a, b) => a.score - b.score);
    store.set(key, set);
    return 1;
  };

  const zcard = (key: string) => {
    const set = store.get(key) || [];
    return set.length;
  };

  const zrange = (key: string, start: number, stop: number) => {
    const set = store.get(key) || [];
    const slice = set.slice(start, stop === -1 ? undefined : stop + 1);
    return slice.map(item => item.member);
  };

  const zrem = (key: string, member: string) => {
    let set = store.get(key) || [];
    const lenBefore = set.length;
    set = set.filter(item => item.member !== member);
    store.set(key, set);
    return lenBefore - set.length;
  };

  return {
    zrem,
    pipeline() {
      const commands: Array<() => any> = [];
      return {
        zremrangebyscore(key: string, min: number, max: number) {
          commands.push(() => zremrangebyscore(key, min, max));
          return this;
        },
        zadd(key: string, data: { score: number; member: string }) {
          commands.push(() => zadd(key, data));
          return this;
        },
        zcard(key: string) {
          commands.push(() => zcard(key));
          return this;
        },
        zrange(key: string, start: number, stop: number) {
          commands.push(() => zrange(key, start, stop));
          return this;
        },
        expire(key: string, seconds: number) {
          commands.push(() => 1);
          return this;
        },
        async exec() {
          return commands.map(cmd => cmd());
        }
      };
    }
  };
}

let redis: any;
if (process.env.NODE_ENV === 'test' || (!process.env.UPSTASH_REDIS_REST_URL && !process.env.UPSTASH_REDIS_REST_TOKEN)) {
  redis = createMockRedis();
} else {
  redis = Redis.fromEnv();
}

// -------------------------------------------------------------
// ⚙️ SLIDING WINDOW HELPER FOR A SPECIFIC WINDOW
// -------------------------------------------------------------
async function checkWindow(
  identifier: string,
  windowName: string,
  limit: number,
  windowMs: number
): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  const now = Date.now();
  const minTime = now - windowMs;
  const key = `rate_limit:${windowName}:${identifier}`;
  const member = `${now}_${Math.random().toString(36).substring(2, 7)}`;

  try {
    const p = redis.pipeline();
    p.zremrangebyscore(key, 0, minTime);
    p.zadd(key, { score: now, member });
    p.zcard(key);
    p.zrange(key, 0, 0);
    p.expire(key, Math.ceil(windowMs / 1000));

    const results = await p.exec();
    const count = results[2] as number;
    const oldestArray = results[3] as string[];
    const oldestTimestamp = oldestArray && oldestArray.length > 0 ? Number(oldestArray[0].split('_')[0]) : minTime;

    if (count > limit) {
      // Blocked. Clean up the added member so blocked tries are not accumulated.
      await redis.zrem(key, member);
      return {
        success: false,
        limit,
        remaining: 0,
        reset: oldestTimestamp + windowMs,
      };
    }

    return {
      success: true,
      limit,
      remaining: limit - count,
      reset: now + windowMs,
    };
  } catch (error) {
    console.error(`[RateLimit] Error checking window ${windowName} for key ${key}:`, error);
    // Graceful fallback: allow request on Upstash errors to prevent lockouts
    return {
      success: true,
      limit,
      remaining: 1,
      reset: now + windowMs,
    };
  }
}

// -------------------------------------------------------------
// 🚀 DUAL-WINDOW RATE LIMITER (MINUTE + DAILY)
// -------------------------------------------------------------
export async function rateLimit(identifier: string): Promise<{
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}> {
  // 1. Check Minute Limit
  const minLimit = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 10);
  const minWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60000);
  
  const minResult = await checkWindow(identifier, 'min', minLimit, minWindowMs);
  if (!minResult.success) {
    return minResult;
  }

  // 2. Check Daily Limit
  const dayLimit = Number(process.env.RATE_LIMIT_DAILY_MAX_REQUESTS || 10);
  const dayWindowMs = 24 * 60 * 60 * 1000; // 24 hours
  
  const dayResult = await checkWindow(identifier, 'day', dayLimit, dayWindowMs);
  if (!dayResult.success) {
    return dayResult;
  }

  // If both succeed, return the smaller remaining count (to be safe)
  // and the minute reset time (since that's the next expected rate limit update event).
  return {
    success: true,
    limit: minLimit,
    remaining: Math.min(minResult.remaining, dayResult.remaining),
    reset: minResult.reset,
  };
}

export function handleRateLimitResponse(resetTime: number) {
  const secondsLeft = Math.ceil((resetTime - Date.now()) / 1000);
  let message = `Too many requests. Please try again in ${secondsLeft} seconds.`;
  
  if (secondsLeft > 3600) {
    const hours = Math.floor(secondsLeft / 3600);
    const minutes = Math.ceil((secondsLeft % 3600) / 60);
    message = `Daily validation limit reached. Please try again in ${hours}h ${minutes}m.`;
  } else if (secondsLeft > 60) {
    const minutes = Math.ceil(secondsLeft / 60);
    message = `Too many requests. Please try again in ${minutes} minutes.`;
  }

  return NextResponse.json(
    {
      error: 'Rate limit exceeded',
      message,
    },
    {
      status: 429,
      headers: {
        'Retry-After': secondsLeft.toString(),
        'X-RateLimit-Reset': resetTime.toString(),
      },
    }
  );
}
