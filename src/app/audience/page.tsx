'use client';

import React, { useEffect, useState } from 'react';
import { submitAudienceVote, getAudienceVoteTally, getAudienceTranscript } from '@/server/actions/audience.actions';
import { RinaAvatar } from '@/presentation/components/RinaAvatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, ThumbsUp } from 'lucide-react';
import { VoteTally, Transcript } from '@/features/audience/audience.types';
import { Mood } from '@/lib/errors';

const VOTE_OPTIONS = ['Sing a song', 'Tell a joke', 'Show your art', 'Surprise us'] as const;

export default function AudiencePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<Transcript[]>([]);
  const [voteTally, setVoteTally] = useState<VoteTally | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState(false);
  const [voterFingerprint, setVoterFingerprint] = useState<string>('');
  const [currentMood, setCurrentMood] = useState<Mood>('neutral');

  // Generate or retrieve voter fingerprint
  useEffect(() => {
    const stored = localStorage.getItem('voterFingerprint');
    if (stored) {
      setVoterFingerprint(stored);
    } else {
      const fingerprint = `voter-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('voterFingerprint', fingerprint);
      setVoterFingerprint(fingerprint);
    }
  }, []);

  // Load session and data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Try to get the latest active session from URL or default
        const params = new URLSearchParams(window.location.search);
        const sid = params.get('sessionId') || 'default-session';
        setSessionId(sid);

        // Load transcript and votes
        const transcriptResponse = await getAudienceTranscript({ sessionId: sid });
        if (transcriptResponse.success && transcriptResponse.data) {
          setTranscript(transcriptResponse.data);
          // Get latest mood from last assistant message
          const lastAssistant = transcriptResponse.data.find((m) => m.role === 'assistant');
          if (lastAssistant?.mood) {
            setCurrentMood(lastAssistant.mood as Mood);
          }
        }

        const tallyResponse = await getAudienceVoteTally({ sessionId: sid });
        if (tallyResponse.success && tallyResponse.data) {
          setVoteTally(tallyResponse.data);
        }
      } catch (error) {
        console.error('Failed to load audience data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();

    // Poll for updates every 3 seconds
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleVote = async (option: (typeof VOTE_OPTIONS)[number]) => {
    if (!sessionId || !voterFingerprint) return;

    setVoting(true);
    try {
      const response = await submitAudienceVote({
        sessionId,
        option,
        voterFingerprint,
      });

      if (response.success) {
        // Refresh tally
        const tallyResponse = await getAudienceVoteTally({ sessionId });
        if (tallyResponse.success && tallyResponse.data) {
          setVoteTally(tallyResponse.data);
        }
      }
    } catch (error) {
      console.error('Failed to submit vote:', error);
    } finally {
      setVoting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header */}
      <header className="border-b border-purple-100 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Audience Room
          </h1>
          <p className="text-sm text-gray-600 mt-1">Watch Rina live and vote on what happens next</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Rina Avatar and Voting */}
          <div className="lg:col-span-1 space-y-6">
            <div className="flex justify-center">
              <RinaAvatar mood={currentMood} size="lg" animated={true} />
            </div>

            {/* Voting Section */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What should Rina do?</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {VOTE_OPTIONS.map((option) => (
                  <Button
                    key={option}
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => handleVote(option)}
                    disabled={voting}
                  >
                    <ThumbsUp className="mr-2 h-4 w-4" />
                    {option}
                    {voteTally && voteTally[option] > 0 && (
                      <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                        {voteTally[option]}
                      </span>
                    )}
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Vote Tally */}
            {voteTally && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Vote Tally</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {VOTE_OPTIONS.map((option) => (
                    <div key={option} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{option}</span>
                        <span className="font-semibold">{voteTally[option]}</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (voteTally[option] / Math.max(1, Object.values(voteTally).reduce((a, b) => a + b, 0))) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Live Transcript */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] flex flex-col">
              <CardHeader>
                <CardTitle>Live Transcript</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col overflow-hidden">
                <ScrollArea className="flex-1 pr-4">
                  <div className="space-y-4">
                    {transcript.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-500">
                        <p>Waiting for Rina to start speaking...</p>
                      </div>
                    ) : (
                      transcript.map((msg, idx) => (
                        <div key={idx} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm">
                              {msg.role === 'user' ? 'Audience Member' : 'Rina'}
                            </span>
                            {msg.mood && (
                              <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded capitalize">
                                {msg.mood}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-700 leading-relaxed">{msg.content}</p>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
