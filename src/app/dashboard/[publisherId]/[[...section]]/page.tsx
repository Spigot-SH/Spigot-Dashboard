import Dashboard from '../../../../views/Dashboard';

/**
 * Was `/dashboard/:publisherId/*`.
 *
 * The optional catch-all preserves the sidebar's /apis, /analytics and /settings links, which
 * under react-router all matched the splat and rendered this same component.
 */
export default async function Page({ params }: { params: Promise<{ publisherId: string }> }) {
  const { publisherId } = await params;
  return <Dashboard publisherId={publisherId} />;
}
