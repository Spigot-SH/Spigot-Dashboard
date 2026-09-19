import type { Metadata } from 'next';
import Marketplace from '../views/Marketplace';
import { getMarketplaceApis } from '../api/marketplace';

/**
 * Server component. `/` is the only public route, so it is the only thing a crawler or an AI
 * assistant can read — the listing has to be in the HTML, not fetched after hydration.
 */
export const metadata: Metadata = {
  title: 'Paid APIs, metered per call',
  description:
    'Browse APIs you can call without a subscription or a signup. Publishers list any HTTP endpoint and set a price per request — you pay only for the calls you make.',
};

export const revalidate = 0;

export default async function Page() {
  const apis = await getMarketplaceApis();
  return <Marketplace initialApis={apis} />;
}
