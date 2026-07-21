type RateLimitEntry = {
  count: number
  resetAt: number
}

const store = new Map<string, RateLimitEntry>()

/**
 * Checks rate limit for a given key. Returns { allowed: boolean, retryAfterMs: number }.
 * Uses a sliding window counter approach.
 */
export function checkRateLimit(
  key: string,
  maxRequests: number = 100,
  windowMs: number = 60_000
): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now()
  const entry = store.get(key)

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now }
  }

  entry.count++
  return { allowed: true, retryAfterMs: 0 }
}

/**
 * Cleanup stale entries every N minutes. Call once at startup or periodically.
 */
export function cleanupRateLimit(maxAgeMs: number = 300_000): void {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt + maxAgeMs) {
      store.delete(key)
    }
  }
}

// Auto-cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => cleanupRateLimit(), 300_000)
}
