export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="mb-6 font-mono text-xs uppercase tracking-eyebrow text-mist">
        HYPE Production
      </p>
      <h1 className="max-w-2xl font-display text-4xl leading-tight text-bone sm:text-6xl">
        A private screening room for your work.
      </h1>
      <p className="mt-6 max-w-md text-mist">
        Open the link you were sent to view your project. Each portal lives at
        its own address.
      </p>
      <code className="mt-8 rounded-full border border-ink-line px-5 py-2 font-mono text-sm text-bone">
        /p/your-project
      </code>
    </main>
  );
}
