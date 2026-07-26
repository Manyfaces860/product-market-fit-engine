import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { rateLimit, handleRateLimitResponse } from '@/lib/rate-limit';

describe('Sliding Window Rate Limiter', () => {
  let originalDateNow: typeof Date.now;
  let customTime: number;

  before(() => {
    originalDateNow = Date.now;
  });

  after(() => {
    Date.now = originalDateNow;
  });

  beforeEach(() => {
    // Reset env vars to defaults
    process.env.RATE_LIMIT_MAX_REQUESTS = '10';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    process.env.RATE_LIMIT_DAILY_MAX_REQUESTS = '100';
    customTime = 1710000000000; // Fixed starting timestamp
    Date.now = () => customTime;
  });

  test('should allow requests within the limit and decrement remaining count', async () => {
    const id = 'test_user_basic';
    
    for (let i = 1; i <= 10; i++) {
      const res = await rateLimit(id);
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.limit, 10);
      assert.strictEqual(res.remaining, 10 - i);
      assert.strictEqual(res.reset, customTime + 60000);
      // Advance time slightly between requests
      customTime += 100;
    }
  });

  test('should block requests that exceed the limit', async () => {
    const id = 'test_user_exceed';
    
    // Fill up the limit
    for (let i = 0; i < 10; i++) {
      await rateLimit(id);
    }

    // This 11th request should be blocked
    const res = await rateLimit(id);
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.remaining, 0);
    // The reset time should be based on the oldest timestamp (first request)
    // The first request was made at 1710000000000, so reset should be 1710000000000 + 60000
    assert.strictEqual(res.reset, 1710000000000 + 60000);
  });

  test('should unblock requests as the sliding window moves forward', async () => {
    const id = 'test_user_sliding';
    
    // 1. Send 10 requests, 1 second apart
    const firstRequestTime = customTime;
    for (let i = 0; i < 10; i++) {
      await rateLimit(id);
      customTime += 1000; // 1 second
    }

    // 2. 11th request should be blocked
    const blockedRes = await rateLimit(id);
    assert.strictEqual(blockedRes.success, false);

    // 3. Move time forward so only the first request falls out of the 60s window
    // First request was at firstRequestTime (t=0s), second was at t=1s.
    // If we move to firstRequestTime + 60.5s, the first request is expired, but the other 9 are still active.
    customTime = firstRequestTime + 60500;

    // 4. Send request - should succeed now because we have 1 slot open
    const allowedRes = await rateLimit(id);
    assert.strictEqual(allowedRes.success, true);
    assert.strictEqual(allowedRes.remaining, 0); // remaining is 0 since we filled the slot

    // 5. Another immediate request should be blocked again
    const reblockedRes = await rateLimit(id);
    assert.strictEqual(reblockedRes.success, false);
  });

  test('should isolate rate limits between different identifiers', async () => {
    const userA = 'user_A';
    const userB = 'user_B';

    // Fully consume userA's limit
    for (let i = 0; i < 10; i++) {
      await rateLimit(userA);
    }

    // userA is blocked
    const resA = await rateLimit(userA);
    assert.strictEqual(resA.success, false);

    // userB should still be completely unaffected
    const resB = await rateLimit(userB);
    assert.strictEqual(resB.success, true);
    assert.strictEqual(resB.remaining, 9);
  });

  test('should respect dynamic configuration from environment variables', async () => {
    const id = 'test_dynamic_env';
    
    // Set custom strict limits
    process.env.RATE_LIMIT_MAX_REQUESTS = '3';
    process.env.RATE_LIMIT_WINDOW_MS = '15000'; // 15 seconds

    // 1st request
    const res1 = await rateLimit(id);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.limit, 3);
    assert.strictEqual(res1.remaining, 2);

    // 2nd and 3rd requests
    await rateLimit(id);
    await rateLimit(id);

    // 4th request should be blocked
    const res4 = await rateLimit(id);
    assert.strictEqual(res4.success, false);
    assert.strictEqual(res4.reset, 1710000000000 + 15000);
  });

  test('should enforce the daily rate limit when daily max requests is exceeded', async () => {
    const id = 'test_user_daily_exceed';
    
    // Set daily limit to 3, and minute limit higher (e.g. 10) so it doesn't block first
    process.env.RATE_LIMIT_MAX_REQUESTS = '10';
    process.env.RATE_LIMIT_DAILY_MAX_REQUESTS = '3';

    // 1st, 2nd, and 3rd requests should succeed
    const res1 = await rateLimit(id);
    assert.strictEqual(res1.success, true);
    const res2 = await rateLimit(id);
    assert.strictEqual(res2.success, true);
    const res3 = await rateLimit(id);
    assert.strictEqual(res3.success, true);

    // 4th request should exceed the daily limit and be blocked
    const res4 = await rateLimit(id);
    assert.strictEqual(res4.success, false);
    // The reset time should be customTime + 24 hours (86,400,000 ms)
    assert.strictEqual(res4.reset, 1710000000000 + 24 * 60 * 60 * 1000);
  });
});

describe('handleRateLimitResponse', () => {
  let originalDateNow: typeof Date.now;

  before(() => {
    originalDateNow = Date.now;
    Date.now = () => 1000000; // Fixed mock time
  });

  after(() => {
    Date.now = originalDateNow;
  });

  test('should build a 429 response with appropriate headers and body', async () => {
    const resetTime = 1005500; // 5.5 seconds in the future
    const response = handleRateLimitResponse(resetTime);

    // Check status
    assert.strictEqual(response.status, 429);

    // Check headers (Retry-After should be Math.ceil(5.5) = 6 seconds)
    assert.strictEqual(response.headers.get('Retry-After'), '6');
    assert.strictEqual(response.headers.get('X-RateLimit-Reset'), resetTime.toString());

    // Check body content
    const body = await response.json();
    assert.deepStrictEqual(body, {
      error: 'Rate limit exceeded',
      message: 'Too many requests. Please try again in 6 seconds.',
    });
  });

  test('should build a 429 response with appropriate hour/minute formatting for daily limits', async () => {
    // Current mock time is 1000000 in handleRateLimitResponse tests.
    // Set resetTime to 1000000 + 4 * 3600 * 1000 + 5 * 60 * 1000 (4 hours and 5 minutes in the future)
    const resetTime = 1000000 + 4 * 3600 * 1000 + 5 * 60 * 1000;
    const response = handleRateLimitResponse(resetTime);

    assert.strictEqual(response.status, 429);

    const body = await response.json();
    assert.deepStrictEqual(body, {
      error: 'Rate limit exceeded',
      message: 'Daily validation limit reached. Please try again in 4h 5m.',
    });
  });
});
