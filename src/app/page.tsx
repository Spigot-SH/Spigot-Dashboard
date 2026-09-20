import { Spinner } from '../components/common/Spinner';

/**
 * The console root. It renders nothing but the wait.
 *
 * `ConsoleGate` in `app/providers.tsx` sends a signed-out visitor to `/login` and a signed-in
 * one to `/dashboard`, so there is no content here to show and no point prerendering any.
 */
export default function Page() {
  return (
    <div className="flex flex-1 items-center justify-center py-20">
      <Spinner size={24} className="text-muted" />
    </div>
  );
}
