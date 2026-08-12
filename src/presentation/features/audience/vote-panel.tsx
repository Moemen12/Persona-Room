"use client";

import { useOptimistic, useState, useTransition } from "react";

import { submitVoteAction } from "@/actions/audience.actions";
import type { VoteTally } from "@/features/audience";
import { COMPANIONS, type CompanionId } from "@/features/persona";
import { VOTE_OPTIONS, type VoteOption } from "@/lib/config/app";
import { cn } from "@/lib/utils";
import { useInterfaceSound } from "@/presentation/hooks/use-interface-sound";

interface VotePanelProps {
  roomId: string;
  companionId: CompanionId;
  initialTally: VoteTally;
}

function createVoterToken() {
  const randomUuid = globalThis.crypto?.randomUUID?.();
  return `persona-room-voter-${randomUuid ?? Math.random().toString(36).slice(2)}`;
}

export function VotePanel({ roomId, companionId, initialTally }: VotePanelProps) {
  const [voterToken] = useState(createVoterToken);
  const companion = COMPANIONS[companionId];
  const { play } = useInterfaceSound();
  const [submittingOption, setSubmittingOption] = useState<VoteOption>();
  const [errorMessage, setErrorMessage] = useState<string>();
  const [isVotePending, startVoteTransition] = useTransition();

  const [optimisticTally, setOptimisticTally] = useOptimistic(
    initialTally,
    (currentTally, votedOption: VoteOption) => ({
      ...currentTally,
      [votedOption]: (currentTally[votedOption] ?? 0) + 1,
    })
  );

  const highestVote = Math.max(1, ...Object.values(optimisticTally).map(Number));

  const handleVote = (option: VoteOption) => {
    if (submittingOption || isVotePending) return;
    play("vote");
    setSubmittingOption(option);
    setErrorMessage(undefined);

    startVoteTransition(async () => {
      setOptimisticTally(option);

      try {
        const result = await submitVoteAction(roomId, option, voterToken);
        if (!result.success) {
          setErrorMessage(result.error);
        }
      } catch {
        setErrorMessage("That vote did not land. Try again.");
      } finally {
        setSubmittingOption(undefined);
      }
    });
  };

  return (
    <section className="vote-panel" aria-labelledby="vote-title">
      <div className="vote-panel__header">
        <div>
          <span className="eyebrow">AUDIENCE VOTE</span>
          <h2 id="vote-title">Direct {companion.name}</h2>
        </div>
        <span>Live poll</span>
      </div>
      <p className="vote-panel__description">
        Cast your vote to shape {companion.name}&apos;s next response in the conversation.
      </p>

      {errorMessage && (
        <div className="error-message" role="alert">
          <p>{errorMessage}</p>
        </div>
      )}

      <div className="vote-options">
        {VOTE_OPTIONS.map((candidate) => {
          const count = optimisticTally[candidate.value] ?? 0;
          const percentage = Math.round((count / highestVote) * 100);
          const isSelected = submittingOption === candidate.value;
          return (
            <button
              key={candidate.value}
              className={cn("vote-option", isSelected && "vote-option--selected")}
              type="button"
              onClick={() => handleVote(candidate.value)}
              disabled={Boolean(submittingOption || isVotePending)}
            >
              <span className="vote-option__main">
                <span className="vote-option__emoji" aria-hidden="true">{candidate.emoji}</span>
                <span>{candidate.label}</span>
              </span>
              <span className="vote-option__count">{count}</span>
              <span className="vote-option__track" aria-hidden="true">
                <span style={{ width: `${Math.max(6, percentage)}%` }} />
              </span>
            </button>
          );
        })}
      </div>

      <footer className="vote-panel__foot">
        <span className="presence-pulse" aria-hidden="true" />
        <span>Votes sync instantly via Supabase & Upstash</span>
      </footer>
    </section>
  );
}
