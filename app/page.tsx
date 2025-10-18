import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuth } from "@/lib/auth/server";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default async function Home() {
  const { userId } = await getAuth();

  // If user is authenticated, redirect to app
  if (userId) {
    redirect("/app");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Status bar */}
      <div className="border-b border-border bg-background px-6 py-2">
        <div className="mx-auto max-w-4xl font-mono text-xs">
          <Badge variant="outline" className="font-mono text-xs">
            [SYSTEM ONLINE] SPLOOT v1.0.0 [READY]
          </Badge>
        </div>
      </div>

      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        {/* Hero section - NAME */}
        <Card>
          <CardContent className="p-8 md:p-12">
            <div className="mb-6 font-mono text-xs uppercase text-muted-foreground">
              NAME
            </div>
            <h1 className="font-mono text-4xl uppercase leading-tight tracking-wider md:text-6xl">
              SPLOOT
            </h1>
            <p className="mt-4 font-mono text-lg md:text-xl">
              your private meme search engine
            </p>
            <p className="mt-2 font-mono text-sm text-muted-foreground md:text-base">
              find any reaction in seconds. ai-powered search for your personal meme vault.
            </p>
          </CardContent>
        </Card>

        {/* Synopsis section - CTAs */}
        <Card className="mt-6">
          <CardContent className="p-8 md:p-12">
            <div className="mb-6 font-mono text-xs uppercase text-muted-foreground">
              SYNOPSIS
            </div>
            <div className="space-y-3">
              <Button asChild variant="outline" className="w-full justify-start font-mono">
                <Link href="/sign-up">
                  $ sploot init # start your collection
                </Link>
              </Button>
              <Button asChild variant="outline" className="w-full justify-start font-mono">
                <Link href="/sign-in">
                  $ sploot login # sign in to existing account
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Description section */}
        <Card className="mt-6">
          <CardContent className="p-8 md:p-12">
            <div className="mb-6 font-mono text-xs uppercase text-muted-foreground">
              DESCRIPTION
            </div>
            <p className="font-mono text-sm leading-relaxed text-muted-foreground md:text-base">
              type what you remember, get what you need. semantic search understands context — search for "disappointed drake" or "guy looking back" and sploot knows exactly what you mean. no manual tagging required.
            </p>
          </CardContent>
        </Card>

        {/* Features section */}
        <Card className="mt-6">
          <CardContent className="p-8 md:p-12">
            <div className="mb-6 font-mono text-xs uppercase text-muted-foreground">
              FEATURES
            </div>
            <div className="space-y-6">
              {/* Semantic Search */}
              <div>
                <div className="mb-2 font-mono text-sm font-semibold">
                  [+] SEMANTIC SEARCH
                </div>
                <div className="space-y-1 pl-4 font-mono text-sm text-muted-foreground">
                  <p>type "disappointed drake" or "guy looking back"</p>
                  <p>our ai knows exactly what you mean</p>
                </div>
              </div>

              {/* Private & Secure */}
              <div>
                <div className="mb-2 font-mono text-sm font-semibold">
                  [+] PRIVATE & SECURE
                </div>
                <div className="space-y-1 pl-4 font-mono text-sm text-muted-foreground">
                  <p>your collection stays locked behind auth</p>
                  <p>no algorithms, no timeline pollution, just your vault</p>
                </div>
              </div>

              {/* Works Everywhere */}
              <div>
                <div className="mb-2 font-mono text-sm font-semibold">
                  [+] WORKS EVERYWHERE
                </div>
                <div className="space-y-1 pl-4 font-mono text-sm text-muted-foreground">
                  <p>install on any device. stays fast whether</p>
                  <p>you're on desktop, mobile, or that tablet from 2019</p>
                  <p>built for the chronically online. save responsibly.</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
