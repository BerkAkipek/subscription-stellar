interface CacheEnvelope<T> {
  value: T;
  expiresAt: number;
}

export function setCached<T>(key: string, value: T, ttlMs: number) {
  const payload: CacheEnvelope<T> = {
    value,
    expiresAt: Date.now() + ttlMs,
  };

  localStorage.setItem(key, JSON.stringify(payload));
}

export function getCached<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<T>;

    if (!parsed || typeof parsed.expiresAt !== "number") {
      localStorage.removeItem(key);
      return null;
    }

    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }

    return parsed.value;
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

export function removeCached(key: string) {
  localStorage.removeItem(key);
}
