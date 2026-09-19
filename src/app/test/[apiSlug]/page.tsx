import ConsumerTest from '../../../views/ConsumerTest';

/** Was `/test/:apiSlug` under react-router. The slug now arrives as a prop, not a hook. */
export default async function Page({ params }: { params: Promise<{ apiSlug: string }> }) {
  const { apiSlug } = await params;
  return <ConsumerTest apiSlug={apiSlug} />;
}
