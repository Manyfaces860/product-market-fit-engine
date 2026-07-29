import { NextResponse } from 'next/server';
import { isMongoDbLive, isPineconeLive } from './mongodb';

/**
 * A highly resilient response helper that wraps NextResponse.json.
 * Automatically appends custom HTTP headers indicating whether databases are live or emulated,
 * and sets the HTTP status to 203 (Non-Authoritative Information) if either database fell back.
 */
export function createResponse(data: any, init?: ResponseInit) {
  const mongoLive = isMongoDbLive();
  const pineconeLive = isPineconeLive();

  // If a request was successful (200), but was served from an emulator fallback,
  // we elevate the status code to 203 (Non-Authoritative Information) for debugging transparency!
  const isSuccess = !init?.status || (init.status >= 200 && init.status < 300);
  const isFallback = !mongoLive || !pineconeLive;
  const status = (isSuccess && isFallback) ? 203 : (init?.status || 200);

  const headers = new Headers(init?.headers);
  headers.set('X-MongoDB-Status', mongoLive ? 'live' : 'emulated');
  headers.set('X-Pinecone-Status', pineconeLive ? 'live' : 'emulated');

  return NextResponse.json(data, {
    ...init,
    status,
    headers,
  });
}