import { Features } from '../components/landing/Features';

export default function LandingPage() {
  return (
    <main>
      <section className="bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-24 text-white">
        <h1 className="text-4xl font-bold">Search every catalog in one place</h1>
        <p className="mt-4 max-w-xl">Find products across stores and compare prices before you buy.</p>
        <a href="/search" className="mt-8 inline-block rounded-md bg-surface-default px-5 py-3 text-fg-primary">
          Start searching
        </a>
      </section>
      <Features />
    </main>
  );
}
