import type { MarketplaceApi } from './client';

/**
 * Server-side marketplace fetch.
 *
 * `/` is the only public page, so it is the only page a crawler or an AI assistant can read.
 * Fetching in an effect returned an empty document to both. This runs on the server instead.
 *
 * The browser talks to the backend through the `/api` rewrite, but the server has no origin to
 * be relative to — it needs the absolute backend URL, the same one `next.config.ts` rewrites to.
 */
const BACKEND_ORIGIN = (process.env.BACKEND_ORIGIN || 'http://127.0.0.1:4402').replace(/\/$/, '');

/** Shape from the backend is snake_case and partially optional; normalise it in one place. */
export const normaliseApi = (api: Record<string, unknown>): MarketplaceApi => ({
  id: String(api.id ?? ''),
  name: String(api.name ?? ''),
  slug: String(api.slug ?? ''),
  publisherName: String(api.publisher_name ?? api.publisherName ?? 'Unknown'),
  description: String(api.description ?? `${api.name ?? 'This'} API`),
  pricePerRequest: Number(api.price_per_request ?? api.pricePerRequest ?? 0),
  avgLatency: Number(api.avg_latency ?? api.avgLatency ?? 0),
  uptime: Number(api.uptime ?? 100),
  skills:
    typeof api.skills === 'string'
      ? api.skills.split(',').filter(Boolean)
      : Array.isArray(api.skills)
        ? (api.skills as string[])
        : [],
});

/**
 * Returns [] rather than throwing: a marketplace that renders empty is recoverable, a page that
 * throws during render is a 500 for every visitor including crawlers.
 */
export const getMarketplaceApis = async (): Promise<MarketplaceApi[]> => {
  try {
    const res = await fetch(`${BACKEND_ORIGIN}/api/apis`, {
      // Listings change when publishers publish, not per request. Revalidating keeps the page
      // static and crawlable while staying fresh enough.
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const data: unknown = await res.json();
    return Array.isArray(data)
      ? data.map(item => normaliseApi(item as Record<string, unknown>))
      : [];
  } catch {
    return [];
  }
};
