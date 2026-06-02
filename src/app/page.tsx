// Public landing page. Intentionally bare and unbranded — the real app lives
// behind the secret admin URL, and invitees only ever see their /rsvp/<token>.
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="text-center text-stone-500">
        <p className="text-sm">Nothing to see here.</p>
      </div>
    </main>
  );
}
