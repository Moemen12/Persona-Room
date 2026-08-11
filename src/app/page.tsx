'use client';

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RinaAvatar } from '@/presentation/components/RinaAvatar';
import { useAuth } from '@/presentation/contexts/AuthContext';
import { Sparkles, Users, MessageCircle } from 'lucide-react';

export default function LandingPage() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Navigation */}
      <nav className="border-b border-purple-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Persona Room
          </div>
          <div className="flex gap-4">
            {isAuthenticated ? (
              <Link href="/chat">
                <Button variant="default">Go to Chat</Button>
              </Link>
            ) : (
              <>
                <Link href="/auth/signin">
                  <Button variant="outline">Sign In</Button>
                </Link>
                <Link href="/auth/signup">
                  <Button variant="default">Sign Up</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <div>
              <h1 className="text-5xl sm:text-6xl font-bold text-gray-900 mb-4">
                Meet <span className="bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Rina</span>
              </h1>
              <p className="text-xl text-gray-600">
                A virtual artist who moved into the internet a year ago. She's curious, playful, and genuinely interested in getting to know you.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">What is Persona Room?</h2>
              <p className="text-gray-700 leading-relaxed">
                Persona Room is a unique space where you can have real conversations with Rina, an AI persona with genuine personality. She remembers what you tell her, reacts authentically to your emotions, and grows with each conversation.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {isAuthenticated ? (
                <Link href="/chat" className="col-span-full">
                  <Button size="lg" className="w-full">
                    <MessageCircle className="mr-2 h-5 w-5" />
                    Start Chatting with Rina
                  </Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth/signin">
                    <Button size="lg" className="w-full">
                      <MessageCircle className="mr-2 h-5 w-5" />
                      Sign In to Chat
                    </Button>
                  </Link>
                  <Link href="/auth/signup">
                    <Button size="lg" variant="outline" className="w-full">
                      <Sparkles className="mr-2 h-5 w-5" />
                      Create Account
                    </Button>
                  </Link>
                </>
              )}
              <Link href="/audience" className="col-span-full">
                <Button size="lg" variant="outline" className="w-full">
                  <Users className="mr-2 h-5 w-5" />
                  Join Audience Room
                </Button>
              </Link>
            </div>
          </div>

          <div className="flex justify-center">
            <RinaAvatar mood="happy" size="lg" animated={false} />
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-white/50 backdrop-blur-sm py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl font-bold text-center mb-12 text-gray-900">Why Rina?</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                  Authentic Personality
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Rina isn't a corporate chatbot. She's playful, curious, and genuinely interested in understanding you.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageCircle className="h-5 w-5 text-pink-600" />
                  Real Conversations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Have meaningful conversations that feel natural. Rina remembers what you tell her and builds on it.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  Live Audience
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Your conversations can be watched live by others. Vote on what Rina should do next.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-purple-100 bg-white/50 backdrop-blur-sm py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-gray-600">
          <p>© 2026 Persona Room. Made with care by humans and AI.</p>
        </div>
      </footer>
    </div>
  );
}
