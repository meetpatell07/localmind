/**
 * Hot Memory Layer — in-process TTL cache simulating Cloudflare KV.
 * Sub-millisecond access for profile + entity context injected on every request.
 * Auto-expires entries; cold reads fall through to Postgres.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class HotMemoryCache {
  private store = new Map<string, CacheEntry<unknown>>();

  set<T>(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) this.store.delete(key);
    }
  }

  /** Evict all expired entries (call periodically if needed). */
  evict(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) this.store.delete(key);
    }
  }

  get size(): number {
    return this.store.size;
  }
}

// Singleton — shared across all requests in the same Node.js process
export const hot = new HotMemoryCache();

// ── TTL Constants ─────────────────────────────────────────────────────────────
export const HOT_TTL = {
  PROFILE:  5 * 60 * 1_000,  // 5 min  — rebuilt every 50 interactions
  ENTITIES: 2 * 60 * 1_000,  // 2 min  — changes on every extraction run
  SESSIONS: 1 * 60 * 1_000,  // 1 min  — session list changes frequently
  GRAPH:    3 * 60 * 1_000,  // 3 min  — graph topology changes slowly
} as const;

// ── Key helpers ───────────────────────────────────────────────────────────────
export const HOT_KEY = {
  profile:      () => "profile:summary",
  profileFacts: () => "profile:facts",
  graphNodes:   () => "graph:nodes",
  entity:       (id: string) => `entity:${id}`,
} as const;
