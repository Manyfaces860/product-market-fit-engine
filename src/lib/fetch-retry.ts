/**
 * Exponential Backoff with Jitter Fetch Utility
 * Wraps standard HTTP fetch operations inside active AbortControllers (Timeouts)
 * and progressively retries failed/throttled operations with exponential wait times.
 * Prevents "Ghost" infinite loading spinners on bad networks.
 */

export interface FetchRetryOptions extends RequestInit {
  maxRetries?: number;
  initialDelayMs?: number;
  timeoutMs?: number; // Request timeout limit (defaults to 8000ms)
  onRetry?: (attempt: number, error: Error) => void; // Optional progress callback
}

/**
 * A highly resilient fetch wrapper that implements Exponential Backoff with Jitter
 * and active request timeouts.
 */
export async function fetchWithRetry(
  url: string,
  options: FetchRetryOptions = {},
  timeout: number = 20000
): Promise<Response> {
  // Auto-escalate the default timeout for heavy batch actions like seeding or admin stats
  let defaultTimeout = timeout;
  if (url.includes('/api/seed') || url.includes('/api/admin/stats')) {
    defaultTimeout = 60000; // 🚀 60 seconds comfortable breathing room
  }

  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    timeoutMs = defaultTimeout,
    onRetry,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const signal = controller.signal;

    // Set active AbortController timeout
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    try {
      if (attempt > 0) {
        console.log(`[Resilience] Retrying request to ${url} (Attempt ${attempt}/${maxRetries})...`);
        if (onRetry) {
          onRetry(attempt, lastError || new Error('Transient network latency.'));
        }
      }

      const response = await fetch(url, {
        ...fetchOptions,
        signal,
      });

      // Clear timeout immediately upon response resolution
      clearTimeout(timeoutId);

      // If response is successful, return it immediately
      if (response.ok) {
        return response;
      }

      // If we got a client-side error (4xx) that is NOT a transient block,
      // don't retry as it is a permanent request format error (e.g. 401, 400, 404, or explicit 429 rate limits).
      if (response.status >= 400 && response.status < 500 && response.status !== 408) {
        return response; 
      }

      throw new Error(`Server returned status ${response.status}: ${response.statusText}`);

    } catch (error: any) {
      clearTimeout(timeoutId);
      lastError = error;

      const isAbort = error.name === 'AbortError';
      const errorMessage = isAbort 
        ? `Request timed out after ${timeoutMs}ms.` 
        : error?.message || 'Network error occurred.';

      console.warn(
        `[Resilience] Attempt ${attempt} failed for ${url}. Error: ${errorMessage}`
      );

      // If we have exhausted all retries, break out of loop
      if (attempt === maxRetries) {
        break;
      }

      // Calculate Exponential Backoff with Jitter:
      // Delay = (initialDelay * 2^attempt) + randomJitter (+/- 15% of current delay)
      const baseDelay = initialDelayMs * Math.pow(2, attempt);
      const jitterRange = baseDelay * 0.15; // 15% jitter
      const jitter = (Math.random() * 2 - 1) * jitterRange; // Random value between -jitterRange and +jitterRange
      const finalDelay = Math.max(100, Math.round(baseDelay + jitter));

      console.log(`[Resilience] Waiting ${finalDelay}ms before next retry...`);
      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }
  }

  // Throw final aggregated error if all retries failed
  throw lastError || new Error(`Failed to complete request to ${url} after ${maxRetries} retries.`);
}
