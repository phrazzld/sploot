import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuth } from "@/lib/auth/server";
import { CornerBrackets } from "@/components/chrome/corner-brackets";

export default async function Home() {
  const { userId } = await getAuth();

  // If user is authenticated, redirect to app
  if (userId) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Corner brackets for terminal aesthetic */}
      <CornerBrackets />

      {/* Status bar */}
      <div className="border-b border-[#1A1A1A] bg-black px-6 py-2">
        <div className="mx-auto max-w-4xl font-mono text-xs text-[var(--color-terminal-green)]">
          [SYSTEM ONLINE] SPLOOT v1.0.0 [READY]
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        {/* Hero section - NAME */}
        <section className="border border-[#1A1A1A] bg-black p-8 md:p-12">
          <div className="mb-6 font-mono text-xs uppercase text-[var(--color-terminal-gray)]">
            NAME
          </div>
          <h1 className="font-mono text-4xl uppercase leading-tight tracking-wider text-[var(--color-terminal-green)] md:text-6xl">
            SPLOOT
          </h1>
          <p className="mt-4 font-mono text-lg text-white md:text-xl">
            your private meme search engine
          </p>
          <p className="mt-2 font-mono text-sm text-[var(--color-terminal-gray)] md:text-base">
            find any reaction in seconds. ai-powered search for your personal meme vault.
          </p>
        </section>

        {/* Synopsis section - CTAs */}
        <section className="mt-6 border border-[#1A1A1A] bg-black p-8 md:p-12">
          <div className="mb-6 font-mono text-xs uppercase text-[var(--color-terminal-gray)]">
            SYNOPSIS
          </div>
          <div className="space-y-3">
            <Link
              href="/sign-up"
              className="block border-2 border-[var(--color-terminal-green)] bg-black px-6 py-3 font-mono text-sm uppercase text-[var(--color-terminal-green)] transition-colors hover:bg-[var(--color-terminal-green)] hover:text-black md:text-base"
            >
              $ sploot init        <span className="text-[var(--color-terminal-gray)]"># start your collection</span>
            </Link>
            <Link
              href="/sign-in"
              className="block border border-[#333333] bg-black px-6 py-3 font-mono text-sm uppercase text-white transition-colors hover:border-white md:text-base"
            >
              $ sploot login       <span className="text-[var(--color-terminal-gray)]"># sign in to existing account</span>
            </Link>
          </div>
        </section>

        {/* Description section */}
        <section className="mt-6 border border-[#1A1A1A] bg-black p-8 md:p-12">
          <div className="mb-6 font-mono text-xs uppercase text-[var(--color-terminal-gray)]">
            DESCRIPTION
          </div>
          <p className="font-mono text-sm leading-relaxed text-white md:text-base">
            type what you remember, get what you need. semantic search understands context —
            search for "disappointed drake" or "guy looking back" and sploot knows exactly
            what you mean. no manual tagging required.
          </p>
        </section>

        {/* Features section */}
        <section className="mt-6 border border-[#1A1A1A] bg-black p-8 md:p-12">
          <div className="mb-6 font-mono text-xs uppercase text-[var(--color-terminal-gray)]">
            FEATURES
          </div>

          <div className="space-y-6">
            {/* Semantic search */}
            <div>
              <div className="font-mono text-sm text-[var(--color-terminal-green)] md:text-base">
                [+] SEMANTIC SEARCH
              </div>
              <div className="ml-4 mt-2 font-mono text-sm leading-relaxed text-[var(--color-terminal-gray)]">
                type "disappointed drake" or "guy looking back"<br/>
                our ai knows exactly what you mean
              </div>
            </div>

            {/* Private & secure */}
            <div>
              <div className="font-mono text-sm text-[var(--color-terminal-green)] md:text-base">
                [+] PRIVATE & SECURE
              </div>
              <div className="ml-4 mt-2 font-mono text-sm leading-relaxed text-[var(--color-terminal-gray)]">
                your collection stays locked behind auth<br/>
                no algorithms, no timeline pollution, just your vault
              </div>
            </div>

            {/* Works everywhere */}
            <div>
              <div className="font-mono text-sm text-[var(--color-terminal-green)] md:text-base">
                [+] WORKS EVERYWHERE
              </div>
              <div className="ml-4 mt-2 font-mono text-sm leading-relaxed text-[var(--color-terminal-gray)]">
                install on any device. stays fast whether<br/>
                you&apos;re on desktop, mobile, or that tablet from 2019
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 border-t border-[#1A1A1A] pt-6">
          <div className="font-mono text-xs text-[var(--color-terminal-gray)]">
            built for the chronically online. save responsibly.
          </div>
        </footer>
      </div>
    </div>
  );
}
