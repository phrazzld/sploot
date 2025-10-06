import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuth } from "@/lib/auth/server";

export default async function Home() {
  const { userId } = await getAuth();

  // If user is authenticated, redirect to app
  if (userId) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-[#04060a] bg-[radial-gradient(circle_at_top,_rgba(124,92,255,0.12),_transparent_55%),radial-gradient(circle_at_bottom,_rgba(255,100,197,0.08),_transparent_50%)] text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center px-6 pb-16 pt-20 md:pt-24">
        <header className="w-full text-center">
          <span className="inline-flex items-center gap-2 border border-white/10 bg-white/5 px-4 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white/70">
            meme brain engaged
          </span>
          <h1 className="mt-6 text-6xl font-semibold lowercase tracking-tight text-white md:text-7xl">
            <span className="bg-gradient-to-r from-[#FF64C5] via-[#C399FF] to-[#7C5CFF] bg-clip-text text-transparent">
              sploot
            </span>
          </h1>
          <p className="mt-4 text-lg text-white/70 md:text-xl">
            your private meme search engine — find any reaction in seconds
          </p>
          <p className="mt-3 text-sm text-white/50 md:text-base">
            ai-powered search for your personal meme vault. type what you remember, get what you need.
          </p>

          <div className="mt-10 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="inline-flex w-full items-center justify-center bg-[#7C5CFF] px-8 py-3 text-base font-semibold lowercase text-white transition-all duration-200 hover:bg-[#6B4FE0] hover:shadow-[0_18px_38px_-20px_rgba(124,92,255,0.9)] sm:w-auto"
            >
              start collecting
            </Link>
            <Link
              href="/sign-in"
              className="inline-flex w-full items-center justify-center border border-white/15 bg-white/5 px-8 py-3 text-base font-semibold lowercase text-white/80 transition-all duration-200 hover:border-white/25 hover:text-white sm:w-auto"
            >
              sign in
            </Link>
          </div>
        </header>

        <section className="mt-16 grid w-full grid-cols-1 gap-6 text-left md:grid-cols-3">
          {[
            {
              emoji: '⚡',
              title: 'semantic search',
              blurb: 'type "disappointed drake" or "guy looking back" — our ai knows exactly what you mean.'
            },
            {
              emoji: '🛡️',
              title: 'private & secure',
              blurb: 'your collection stays locked behind auth. no algorithms, no timeline pollution, just your vault.'
            },
            {
              emoji: '📱',
              title: 'works everywhere',
              blurb: 'install on any device. stays fast whether you\'re on desktop, mobile, or that tablet from 2019.'
            }
          ].map((card) => (
            <div
              key={card.title}
              className="border border-white/8 bg-white/[0.04] p-6 shadow-[0_20px_45px_-30px_rgba(124,92,255,0.6)] backdrop-blur"
            >
              <div className="text-3xl">{card.emoji}</div>
              <h3 className="mt-4 text-lg font-semibold lowercase text-white">{card.title}</h3>
              <p className="mt-2 text-sm text-white/60">{card.blurb}</p>
            </div>
          ))}
        </section>

        <footer className="mt-14 w-full text-center text-xs lowercase text-white/40">
          built for the chronically online. save responsibly.
        </footer>
      </div>
    </div>
  );
}
