import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuth } from "@/lib/auth/server";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Search,
  Lock,
  Zap,
  Sparkles,
  ArrowRight,
  LogIn,
  Upload as UploadIcon,
  Brain,
  Download,
  CheckCircle2
} from "lucide-react";

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
        <div className="mx-auto max-w-6xl font-mono text-xs flex items-center justify-between">
          <Badge variant="outline" className="font-mono text-xs">
            [system online] sploot v1.0.0 [ready]
          </Badge>
          <div className="hidden md:flex gap-2">
            <Badge variant="secondary" className="font-mono text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              ai-powered
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs gap-1">
              <Lock className="h-3 w-3" />
              private
            </Badge>
            <Badge variant="secondary" className="font-mono text-xs gap-1">
              <Zap className="h-3 w-3" />
              blazing fast
            </Badge>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-12 md:py-16 space-y-8">
        {/* Hero section */}
        <Card>
          <CardHeader>
            <div className="font-mono text-xs text-muted-foreground mb-2">
              name
            </div>
            <CardTitle className="font-mono text-4xl leading-tight tracking-wider md:text-6xl">
              sploot
            </CardTitle>
            <CardDescription className="font-mono text-lg md:text-xl mt-4">
              your private meme search engine
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="font-mono text-sm text-muted-foreground md:text-base">
              find any reaction in seconds. ai-powered search for your personal meme vault.
            </p>
          </CardContent>
          <CardFooter className="flex-col sm:flex-row gap-3">
            <Button asChild className="w-full sm:w-auto gap-2 font-mono">
              <Link href="/sign-up">
                <ArrowRight className="h-4 w-4" />
                start your collection
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto gap-2 font-mono">
              <Link href="/sign-in">
                <LogIn className="h-4 w-4" />
                sign in
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Separator />

        {/* Value proposition alert */}
        <Alert>
          <Sparkles className="h-4 w-4" />
          <AlertDescription className="font-mono text-sm">
            type what you remember, get what you need. semantic search understands context — search for "disappointed drake" or "guy looking back" and sploot knows exactly what you mean. no manual tagging required.
          </AlertDescription>
        </Alert>

        {/* Features grid */}
        <div className="space-y-4">
          <h2 className="font-mono text-xs text-muted-foreground">features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Semantic Search */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    <Search className="h-5 w-5" />
                  </div>
                </div>
                <CardTitle className="font-mono text-sm">semantic search</CardTitle>
                <CardDescription className="font-mono text-xs">
                  type "disappointed drake" or "guy looking back" — our ai knows exactly what you mean
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Private & Secure */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    <Lock className="h-5 w-5" />
                  </div>
                </div>
                <CardTitle className="font-mono text-sm">private & secure</CardTitle>
                <CardDescription className="font-mono text-xs">
                  your collection stays locked behind auth. no algorithms, no timeline pollution, just your vault
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Works Everywhere */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <div className="p-2 rounded-md bg-primary/10 text-primary">
                    <Zap className="h-5 w-5" />
                  </div>
                </div>
                <CardTitle className="font-mono text-sm">works everywhere</CardTitle>
                <CardDescription className="font-mono text-xs">
                  install on any device. stays fast whether you're on desktop, mobile, or that tablet from 2019
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>

        <Separator />

        {/* How it works */}
        <div className="space-y-6">
          <h2 className="font-mono text-xs text-muted-foreground">how it works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative">
                <div className="p-4 rounded-lg bg-primary/10 text-primary">
                  <UploadIcon className="h-8 w-8" />
                </div>
                <Badge className="absolute -top-2 -right-2 font-mono h-6 w-6 flex items-center justify-center p-0">
                  1
                </Badge>
              </div>
              <div className="space-y-1">
                <h3 className="font-mono text-sm font-semibold">upload</h3>
                <p className="font-mono text-xs text-muted-foreground">
                  drop your memes. paste from clipboard. drag and drop. whatever works.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative">
                <div className="p-4 rounded-lg bg-primary/10 text-primary">
                  <Brain className="h-8 w-8" />
                </div>
                <Badge className="absolute -top-2 -right-2 font-mono h-6 w-6 flex items-center justify-center p-0">
                  2
                </Badge>
              </div>
              <div className="space-y-1">
                <h3 className="font-mono text-sm font-semibold">ai understands</h3>
                <p className="font-mono text-xs text-muted-foreground">
                  our models analyze each image. no tagging needed. it just works.
                </p>
              </div>
            </div>

            <div className="flex flex-col items-center text-center space-y-3">
              <div className="relative">
                <div className="p-4 rounded-lg bg-primary/10 text-primary">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <Badge className="absolute -top-2 -right-2 font-mono h-6 w-6 flex items-center justify-center p-0">
                  3
                </Badge>
              </div>
              <div className="space-y-1">
                <h3 className="font-mono text-sm font-semibold">instant results</h3>
                <p className="font-mono text-xs text-muted-foreground">
                  type what you remember. find it in milliseconds. copy and paste anywhere.
                </p>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Demo section */}
        <div className="space-y-4">
          <h2 className="font-mono text-xs text-muted-foreground">what it looks like</h2>
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                <Search className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono text-sm text-muted-foreground">
                  guy tapping head meme...
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-md bg-muted border flex items-center justify-center"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      result {i}
                    </span>
                  </div>
                ))}
              </div>
              <p className="font-mono text-xs text-muted-foreground text-center">
                search thousands of memes in milliseconds
              </p>
            </CardContent>
          </Card>
        </div>

        <Separator />

        {/* Final CTA */}
        <Card>
          <CardHeader>
            <CardTitle className="font-mono text-lg">ready to start?</CardTitle>
            <CardDescription className="font-mono text-sm">
              built for the chronically online. save responsibly.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-col sm:flex-row gap-3">
            <Button asChild className="w-full sm:w-auto gap-2 font-mono">
              <Link href="/sign-up">
                <ArrowRight className="h-4 w-4" />
                create free account
              </Link>
            </Button>
            <Button asChild variant="outline" className="w-full sm:w-auto gap-2 font-mono">
              <Link href="/sign-in">
                <LogIn className="h-4 w-4" />
                sign in
              </Link>
            </Button>
          </CardFooter>
        </Card>

        {/* Footer */}
        <div className="pt-8 pb-4 text-center">
          <p className="font-mono text-xs text-muted-foreground">
            built with ❤️ for meme enthusiasts everywhere
          </p>
        </div>
      </div>
    </div>
  );
}
