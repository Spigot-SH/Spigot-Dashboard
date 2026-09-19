import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <h1 className="text-4xl font-semibold text-main mb-2">404</h1>
      <p className="text-muted text-sm max-w-md mb-6">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-4 py-2 bg-panel border border-border hover:border-main rounded-md text-sm text-main transition-colors"
      >
        Return to Marketplace
      </Link>
    </div>
  );
}
