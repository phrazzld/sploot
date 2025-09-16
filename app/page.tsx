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
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex items-center justify-center">
      <div className="max-w-4xl mx-auto px-4 py-16 text-center">
        <h1 className="text-6xl md:text-8xl font-bold mb-6">
          <span className="bg-gradient-to-r from-violet-500 to-violet-700 bg-clip-text text-transparent">
            Sploot
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-400 mb-4">
          Your personal meme library with lightning-fast semantic search
        </p>

        <p className="text-lg text-gray-500 mb-12 max-w-2xl mx-auto">
          Store, organize, and instantly find any meme in your collection using natural language.
          No more endless scrolling through folders.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          <Link
            href="/sign-up"
            className="px-8 py-4 bg-violet-600 hover:bg-violet-700 rounded-lg font-semibold text-lg transition-colors duration-200 inline-block"
          >
            Get Started
          </Link>
          <Link
            href="/sign-in"
            className="px-8 py-4 bg-gray-800 hover:bg-gray-700 rounded-lg font-semibold text-lg transition-colors duration-200 inline-block border border-gray-700"
          >
            Sign In
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-left">
          <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-lg border border-gray-800">
            <div className="text-3xl mb-3">⚡</div>
            <h3 className="text-xl font-semibold mb-2 text-violet-400">Lightning Fast</h3>
            <p className="text-gray-400">
              Find any meme in milliseconds with AI-powered semantic search
            </p>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-lg border border-gray-800">
            <div className="text-3xl mb-3">🔒</div>
            <h3 className="text-xl font-semibold mb-2 text-violet-400">Private & Secure</h3>
            <p className="text-gray-400">
              Your personal collection, accessible from anywhere
            </p>
          </div>

          <div className="bg-gray-900/50 backdrop-blur-sm p-6 rounded-lg border border-gray-800">
            <div className="text-3xl mb-3">📱</div>
            <h3 className="text-xl font-semibold mb-2 text-violet-400">Works Everywhere</h3>
            <p className="text-gray-400">
              Progressive web app works on desktop and mobile
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
