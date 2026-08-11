import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { RinaAvatar } from '@/presentation/components/RinaAvatar';
import type { Mood } from '@/shared/types';
import { Send, Share2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mood?: string | null;
}

export default function Chat() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentMood, setCurrentMood] = useState<Mood>('neutral');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const createSessionMutation = trpc.chat.createSession.useMutation();
  const sendMessageMutation = trpc.chat.sendMessage.useMutation({
    onError: () => {
      setIsLoading(false);
    },
  });
  const getHistoryQuery = trpc.chat.getHistory.useQuery(
    sessionId ? { sessionId, limit: 50 } : { sessionId: '', limit: 50 },
    { enabled: !!sessionId },
  );

  // Initialize session
  useEffect(() => {
    if (!user) return;

    const initSession = async () => {
      try {
        const result = await createSessionMutation.mutateAsync({ audienceEnabled: true });
        setSessionId(result.sessionId);
        toast.success('Chat session created! Share the link with others to watch.');
      } catch (error) {
        toast.error('Failed to create chat session');
        console.error(error);
      }
    };

    initSession();
  }, [user]);

  // Load conversation history
  useEffect(() => {
    if (getHistoryQuery.data && getHistoryQuery.data.length > 0) {
      const formattedMessages = getHistoryQuery.data.map((msg) => ({
        id: `${msg.id}`,
        role: msg.role as 'user' | 'assistant',
        content: msg.content,
        mood: msg.mood || undefined,
      }));
      setMessages(formattedMessages);
      
      // Set current mood from last assistant message
      const reversed = [...formattedMessages].reverse();
      const lastAssistantMsg = reversed.find((m) => m.role === 'assistant');
      if (lastAssistantMsg?.mood) {
        setCurrentMood(lastAssistantMsg.mood as Mood);
      }
    }
  }, [getHistoryQuery.data]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !sessionId || isLoading) return;

    const userMessage = inputValue;
    setInputValue('');
    setIsLoading(true);

    // Add user message optimistically
    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', content: userMessage }]);

    try {
      const result = await sendMessageMutation.mutateAsync({
        message: userMessage,
        sessionId,
      });

      // Add assistant message
      const assistantMsgId = `assistant-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMsgId,
          role: 'assistant',
          content: result.response,
          mood: result.moodAnalysis.emotion,
        },
      ]);

      // Update mood
      setCurrentMood(result.moodAnalysis.emotion as Mood);
    } catch (error) {
      toast.error('Failed to send message');
      console.error(error);
      // Remove optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== userMsgId));
    } finally {
      setIsLoading(false);
    }
  };

  if (!user || !sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <div className="border-b border-purple-500/20 bg-slate-900/50 backdrop-blur px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Chat with Rina</h1>
          <Button
            variant="outline"
            size="sm"
            className="border-purple-400 text-purple-400 hover:bg-purple-400/10"
            onClick={() => {
              const url = `${window.location.origin}/audience/${sessionId}`;
              navigator.clipboard.writeText(url);
              toast.success('Audience link copied!');
            }}
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share with Audience
          </Button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
          {/* Avatar Section */}
          <div className="flex justify-center py-8">
            <RinaAvatar mood={currentMood} size="lg" />
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Card className="bg-slate-800/50 border-purple-500/20 p-8 text-center max-w-md">
                  <p className="text-purple-200 text-lg mb-2">Hey — you found me.</p>
                  <p className="text-slate-400">
                    Tell me one thing about yourself, and I promise I'll remember it.
                  </p>
                </Card>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-purple-600 text-white'
                          : 'bg-slate-700 text-slate-100'
                      }`}
                    >
                      <p className="text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-purple-500/20 bg-slate-800/50 backdrop-blur p-4">
            <form onSubmit={handleSendMessage} className="flex gap-2">
              <Input
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Tell Rina something..."
                disabled={isLoading}
                className="bg-slate-700 border-purple-500/30 text-white placeholder:text-slate-400"
              />
              <Button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className="bg-purple-600 hover:bg-purple-700"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
