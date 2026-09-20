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
   * Only `API_KEY`, `BEARER` and `BASIC` are applied by `services/proxy.ts`, and those three
   * plus `NONE` are what `PUT /apis/:id/publish` accepts. `OAUTH` and `CUSTOM` were offered
   * by this select until 2026-09-20; publishing with either is refused server-side, because
   * the consumer would pay and then get a 401 from upstream.
   */
  authType?: 'NONE' | 'API_KEY' | 'BEARER' | 'BASIC';
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
