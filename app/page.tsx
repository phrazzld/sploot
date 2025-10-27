import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuth } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { OverlappingCircles } from "@/components/landing/overlapping-circles";
import { SearchInput } from "@/components/landing/search-input";
import { FeatureCard } from "@/components/landing/feature-card";
import { ThemeToggle } from "@/components/theme-toggle";
import { Search, Lock, Zap, ChevronDown } from "lucide-react";

export default async function Home() {
  const { userId } = await getAuth();

  // If user is authenticated, redirect to app
  if (userId) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top navigation */}
      <nav className="fixed top-0 right-0 z-50 p-6 flex items-center gap-4">
        <ThemeToggle />
        <Link
          href="/sign-in"
          className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          sign in
        </Link>
      </nav>

      {/* Hero section - centered, minimal */}
      <section className="min-h-screen flex flex-col items-center justify-center px-6 py-20">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center space-y-12 text-center">
          {/* Overlapping circles logo */}
          <OverlappingCircles
            size={224}
            strokeWidth={3}
            className="opacity-0 animate-[fadeIn_1s_ease-out_forwards]"
          />

          {/* Heading */}
          <div className="space-y-4 opacity-0 animate-[fadeIn_1s_ease-out_0.15s_forwards]">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-light tracking-tight">
              sploot
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground font-normal">
              find your memes
            </p>
          </div>

          {/* Search input (visual only) */}
          <div className="w-full opacity-0 animate-[fadeIn_1s_ease-out_0.3s_forwards]">
            <SearchInput placeholder="disappointed drake..." />
          </div>

          {/* CTA */}
          <div className="opacity-0 animate-[fadeIn_1s_ease-out_0.45s_forwards]">
            <Button
              asChild
              variant="outline"
              size="lg"
              className="font-mono text-sm px-8 py-6"
            >
              <Link href="/sign-up">create free account</Link>
            </Button>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <ChevronDown className="h-6 w-6 text-muted-foreground" />
        </div>
      </section>

      {/* Features section */}
      <section className="px-6 py-24 border-t border-border">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <FeatureCard
              icon={Search}
              title="semantic search"
              description="type what you remember, get what you need. our ai understands context and meaning, not just tags."
            />
            <FeatureCard
              icon={Lock}
              title="private & secure"
              description="your collection stays locked behind auth. no algorithms, no timeline pollution, just your vault."
            />
            <FeatureCard
              icon={Zap}
              title="works everywhere"
              description="install on any device. stays fast whether you're on desktop, mobile, or that tablet from 2019."
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-12 border-t border-border">
        <div className="max-w-6xl mx-auto text-center">
          <p className="font-mono text-xs text-muted-foreground">
            built with ❤️ for meme enthusiasts everywhere
          </p>
        </div>
      </footer>
    </div>
  );
}
