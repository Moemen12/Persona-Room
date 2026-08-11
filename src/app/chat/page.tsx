'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/presentation/contexts/AuthContext';
import { useChat } from '@/presentation/hooks/useChat';
import { RinaAvatar } from '@/presentation/components/RinaAvatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function ChatPage() {
  const router = useRouter();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const { sessionId, messages, currentMood, loading, error, initSession, sendMessage, loadHistory } = useChat();
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/auth/signin');
    }
  }, [authLoading, isAuthenticated, router]);

  // Initialize session on mount
  useEffect(() => {
    if (isAuthenticated && !sessionId) {
      (async () => {
        try {
          const newSessionId = await initSession(true);
          await loadHistory();
        } catch (err) {
          console.error('Failed to initialize session:', err);
        }
      })();
    }
  }, [isAuthenticated, sessionId, initSession, loadHistory]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isSending || !sessionId) return;

    setIsSending(true);
    try {
      await sendMessage(inputValue);
      setInputValue('');
      await loadHistory();
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setIsSending(false);
    }
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <header className="border-b border-purple-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Chat with Rina
          </h1>
          <div className="text-sm text-gray-600">
            {user && <span>Welcome, {user.name}</span>}
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Rina Avatar and Info */}
          <div className="lg:col-span-1 flex flex-col items-center space-y-6">
            <RinaAvatar mood={currentMood} size="lg" animated={true} />
            <Card className="w-full">
              <CardHeader>
                <CardTitle className="text-lg">Rina's Mood</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 capitalize">{currentMood}</p>
              </CardContent>
            </Card>
          </div>

          {/* Chat Messages */}
          <div className="lg:col-span-2 flex flex-col h-[600px]">
            <Card className="flex-1 flex flex-col">
              <CardHeader>
                <CardTitle>Conversation</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1 pr-4 mb-4">
                  <div className="space-y-4">
                    {messages.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <p>Start a conversation with Rina...</p>
                      </div>
                    ) : (
                      messages.map((msg, idx) => (
                        <div
                          key={idx}
                          className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`max-w-xs px-4 py-2 rounded-lg ${
                              msg.role === 'user'
                                ? 'bg-purple-600 text-white'
                                : 'bg-gray-200 text-gray-900'
                            }`}
                          >
                            <p className="text-sm">{msg.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                    {loading && (
                      <div className="flex justify-start">
                        <div className="bg-gray-200 text-gray-900 px-4 py-2 rounded-lg">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      </div>
                    )}
                  </div>
                </ScrollArea>

                {/* Message Input */}
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="Type your message..."
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    disabled={isSending || loading || !sessionId}
                  />
                  <Button
                    type="submit"
                    disabled={isSending || loading || !sessionId || !inputValue.trim()}
                    size="icon"
                  >
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>

                {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
