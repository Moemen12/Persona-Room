import { useState, useEffect, useRef } from 'react';
import { useParams } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RinaAvatar } from '@/presentation/components/RinaAvatar';
import type { Mood } from '@/shared/types';
import { Loader2, Users } from 'lucide-react';
import { toast } from 'sonner';

const VOTE_OPTIONS = ['Sing a song', 'Tell a joke', 'Show your art', 'Surprise us'] as const;

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mood?: string | null;
}

export default function Audience() {
  const params = useParams();
  const sessionId = params?.id as string;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [voteTally, setVoteTally] = useState<Record<string, number>>({
    'Sing a song': 0,
    'Tell a joke': 0,
    'Show your art': 0,
    'Surprise us': 0,
  });
  const [currentMood, setCurrentMood] = useState<Mood>('neutral');
  const [voterFingerprint, setVoterFingerprint] = useState<string>('');
  const [isVoting, setIsVoting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const getTranscriptQuery = trpc.audience.getTranscript.useQuery(
    sessionId ? { sessionId } : { sessionId: '' },
    { enabled: !!sessionId, refetchInterval: 2000 },
  );

  const getVoteTallyQuery = trpc.audience.getVoteTally.useQuery(
    sessionId ? { sessionId } : { sessionId: '' },
    { enabled: !!sessionId, refetchInterval: 1000 },
  );

  const submitVoteMutation = trpc.audience.submitVote.useMutation();

  // Initialize voter fingerprint
  useEffect(() => {
    const stored = localStorage.getItem('voterFingerprint');
    if (stored) {
      setVoterFingerprint(stored);
    } else {
      const newFingerprint = crypto.randomUUID();
      localStorage.setItem('voterFingerprint', newFingerprint);
      setVoterFingerprint(newFingerprint);
    }
  }, []);

  // Load transcript
  useEffect(() => {
    if (getTranscriptQuery.data) {
      const formattedMessages = getTranscriptQuery.data.map((msg) => ({
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
  }, [getTranscriptQuery.data]);

  // Load vote tally
  useEffect(() => {
    if (getVoteTallyQuery.data) {
      setVoteTally(getVoteTallyQuery.data);
    }
  }, [getVoteTallyQuery.data]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleVote = async (option: typeof VOTE_OPTIONS[number]) => {
    if (!sessionId || !voterFingerprint || isVoting) return;

    setIsVoting(true);
    try {
      const result = await submitVoteMutation.mutateAsync({
        sessionId,
        option,
        voterFingerprint,
      });

      if (result.success) {
        toast.success(`Voted for: ${option}`);
        // Refetch tally
        getVoteTallyQuery.refetch();
      } else {
        toast.error('Vote rate limited. Please wait a few seconds.');
      }
    } catch (error) {
      toast.error('Failed to submit vote');
      console.error(error);
    } finally {
      setIsVoting(false);
    }
  };

  if (!sessionId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="text-center">
          <p className="text-white text-lg">Invalid session</p>
        </div>
      </div>
    );
  }

  const totalVotes = Object.values(voteTally).reduce((a, b) => a + b, 0);
  const maxVotes = Math.max(...Object.values(voteTally), 1);

  return (
    <div className="flex flex-col h-screen bg-gradient-to-b from-slate-900 to-slate-800">
      {/* Header */}
      <div className="border-b border-purple-500/20 bg-slate-900/50 backdrop-blur px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Watching Rina Live</h1>
          <div className="flex items-center gap-2 text-purple-300">
            <Users className="w-5 h-5" />
            <span className="text-sm">Audience Room</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <div className="max-w-4xl mx-auto w-full h-full flex flex-col">
          {/* Avatar Section */}
          <div className="flex justify-center py-6">
            <RinaAvatar mood={currentMood} size="lg" />
          </div>

          {/* Transcript Area */}
          <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-3 min-h-0">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <Card className="bg-slate-800/50 border-purple-500/20 p-8 text-center max-w-md">
                  <p className="text-purple-200">Waiting for someone to talk to Rina…</p>
                </Card>
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs px-3 py-2 rounded text-sm ${
                        msg.role === 'user'
                          ? 'bg-purple-600/30 text-purple-100'
                          : 'bg-slate-700/30 text-slate-100'
                      }`}
                    >
                      <p className="leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Voting Section */}
          <div className="border-t border-purple-500/20 bg-slate-800/50 backdrop-blur p-4">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-purple-300">What should Rina do?</p>
              <div className="grid grid-cols-2 gap-2">
                {VOTE_OPTIONS.map((option) => {
                  const voteCount = voteTally[option] || 0;
                  const percentage = totalVotes > 0 ? (voteCount / maxVotes) * 100 : 0;

                  return (
                    <div key={option}>
                      <Button
                        onClick={() => handleVote(option)}
                        disabled={isVoting}
                        className="w-full bg-purple-600 hover:bg-purple-700 text-sm h-auto py-2"
                      >
                        {option}
                      </Button>
                      <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-500 transition-all duration-300"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{voteCount} votes</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
