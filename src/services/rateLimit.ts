import { config } from "../config.js";

const hits = new Map<string, number[]>();

function websiteKey(website: string): string {
  return website.trim().toLowerCase();
}

function pruneExpired(cutoff: number): void {
  if (hits.size <= 200) {
    return;
  }

  for (const [key, times] of hits) {
    const recent = times.filter((at) => at > cutoff);
    if (recent.length === 0) {
      hits.delete(key);
    } else {
      hits.set(key, recent);
    }
  }
}

export function allowWebsite(website: string): boolean {
  const key = websiteKey(website);
  const now = Date.now();
  const cutoff = now - config.rateLimitWindowMs;
  pruneExpired(cutoff);
  const recent = (hits.get(key) ?? []).filter((at) => at > cutoff);

  if (recent.length >= config.rateLimitPerWebsite) {
    hits.set(key, recent);
    return false;
  }

  recent.push(now);
  hits.set(key, recent);
  return true;
}

export function retryAfterSeconds(): number {
  return Math.ceil(config.rateLimitWindowMs / 1000);
}
