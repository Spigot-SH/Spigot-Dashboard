import type { Metadata } from 'next';
import MagicLinkCallback from '../../../views/MagicLinkCallback';

export const metadata: Metadata = { title: 'Signing in' };

export default function Page() {
  return <MagicLinkCallback />;
}
