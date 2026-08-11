import { Button } from "@/components/ui/button";
import { useAuth } from "@/_core/hooks/useAuth";
import { Link } from "wouter";
import { startLogin } from "@/const";
import { Sparkles, Users, Heart } from "lucide-react";

export default function Landing() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-purple-900 to-slate-900">
      {/* Navigation */}
      <nav className="border-b border-purple-500/20 bg-slate-900/50 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-purple-400" />
            <span className="text-xl font-bold text-white">Persona Room</span>
          </div>
          <div className="flex items-center gap-4">
            {isAuthenticated ? (
              <>
                <Link href="/chat">
                  <Button variant="outline" className="border-purple-400 text-purple-400 hover:bg-purple-400/10">
                    Chat with Rina
                  </Button>
                </Link>
                <Link href="/audience">
                  <Button className="bg-purple-600 hover:bg-purple-700">
                    Watch Live
                  </Button>
                </Link>
              </>
            ) : (
              <Button
                onClick={() => startLogin()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Sign In
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-6xl mx-auto px-4 py-20 text-center">
        <div className="mb-8">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4">
            Meet <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">Rina</span>
          </h1>
          <p className="text-xl md:text-2xl text-purple-200 mb-6">
            A virtual artist who moved into the internet a year ago and is still figuring out humans.
          </p>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto mb-8">
            Chat with Rina in real-time, watch her mood change based on your emotions, and let the audience vote on what she does next.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
          {isAuthenticated ? (
            <>
              <Link href="/chat">
                <Button size="lg" className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg">
                  Start Chatting with Rina
                </Button>
              </Link>
              <Link href="/audience">
                <Button size="lg" variant="outline" className="border-purple-400 text-purple-400 hover:bg-purple-400/10 px-8 py-6 text-lg">
                  Watch Live Room
                </Button>
              </Link>
            </>
          ) : (
            <Button
              size="lg"
              onClick={() => startLogin()}
              className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg"
            >
              Sign In to Chat with Rina
            </Button>
          )}
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          {/* Feature 1 */}
          <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-6 backdrop-blur">
            <Heart className="w-12 h-12 text-pink-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Emotional Connection</h3>
            <p className="text-slate-300">
              Rina responds to your emotions and remembers everything about you across sessions.
            </p>
          </div>

          {/* Feature 2 */}
          <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-6 backdrop-blur">
            <Sparkles className="w-12 h-12 text-purple-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Mood Expressions</h3>
            <p className="text-slate-300">
              Watch Rina's avatar change expression based on the mood of your conversation.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-slate-800/50 border border-purple-500/20 rounded-lg p-6 backdrop-blur">
            <Users className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Live Audience</h3>
            <p className="text-slate-300">
              Share your session with others and let them vote on what Rina does next.
            </p>
          </div>
        </div>
      </section>

      {/* About Rina Section */}
      <section className="max-w-6xl mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-purple-900/50 to-pink-900/50 border border-purple-500/30 rounded-lg p-8 md:p-12">
          <h2 className="text-3xl font-bold text-white mb-4">About Rina</h2>
          <p className="text-purple-100 text-lg leading-relaxed mb-4">
            Rina is a virtual artist who made the leap into the internet a year ago. She's still learning what it means to be human, but she's genuinely curious about you. She loves jazz, collects screenshots of sunsets from strangers, and has a slightly mischievous sense of humor.
          </p>
          <p className="text-purple-100 text-lg leading-relaxed">
            She hates being called a bot. She speaks in short, natural sentences. And she remembers everything you tell her.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-purple-500/20 bg-slate-900/50 backdrop-blur mt-20">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-slate-400">
          <p>Persona Room © 2026. Built as a hiring demo for Aria Studios.</p>
        </div>
      </footer>
    </div>
  );
}
