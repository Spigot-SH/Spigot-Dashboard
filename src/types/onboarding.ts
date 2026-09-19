import type { ApiEndpoint } from '../api/client';

/**
 * The publisher wizard's accumulated state.
 *
 * `views/Onboarding.tsx` holds one object and threads it through ten steps, each of which
 * fills in a few fields and reads a few others. Every field is optional because the object
 * genuinely is partial until the final step — that is the shape of a wizard, not a
 * shortcoming. Typing it means a renamed field is a compile error instead of a silently
 * undefined value at the Publish step.
 *
 * Derived from actual usage across `components/steps/*`; keep it in sync when a step starts
 * reading or writing a new field.
 */
export interface OnboardingData {
  // Step 1 — publisher details
  publisherName?: string;
  type?: 'Company' | 'Individual';
  description?: string;
  email?: string;
  website?: string;
  domain?: string;
  logoUrl?: string;
  githubUrl?: string;
  /** Set once the publisher record exists server-side. */
  publisherId?: string;
  /** Returned with the publisher record; used for `X-API-Key` on later steps. */
  apiKey?: string;

  // Step 2 — domain verification
  domainVerified?: boolean;

  // Step 3 — API configuration
  apiName?: string;
  apiVersion?: string;
  baseUrl?: string;
  apiDocsUrl?: string;
  /**
   * Only `API_KEY`, `BEARER` and `BASIC` are actually applied by `services/proxy.ts`.
   * `OAUTH` and `CUSTOM` are offered by the UI but unimplemented — publishing with them is
   * blocked server-side, because the consumer would pay and then get a 401 from upstream.
   * `'None'` is the legacy spelling the select still emits; the backend expects `'NONE'`.
   */
  authType?: 'NONE' | 'None' | 'API_KEY' | 'BEARER' | 'BASIC' | 'OAUTH' | 'CUSTOM';
  apiKeyHeader?: string;
  apiKeyValue?: string;
  bearerToken?: string;
  basicUser?: string;
  basicPass?: string;
  /** Set once the API record exists server-side. */
  apiId?: string;
  /** Slug the gateway routes on, returned alongside `apiId`. */
  apiSlug?: string;

  // Step 4 — endpoints
  endpoints?: ApiEndpoint[];

  // Step 6 — skills
  skills?: string[];

  // Step 7 — pricing and settlement
  pricingModel?: 'PayPerUse' | 'Subscription';
  pricePerRequest?: number | string;
  monthlyPrice?: number | string;
  includedRequests?: number | string;
  overagePrice?: number | string;
  rateLimit?: number | string;
  settlementAddress?: string;
  settlementChain?: string;
  settlementFrequency?: string;
  minPayout?: number | string;
}

/** Shared prop contract for every wizard step. */
export interface OnboardingStepProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}
