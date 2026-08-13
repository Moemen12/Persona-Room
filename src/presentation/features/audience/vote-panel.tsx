"use client";

import { useOptimistic, useState, useTransition } from "react";

import { submitVoteAction } from "@/actions/audience.actions";
import type { VoteTally } from "@/features/audience";
import { COMPANIONS, type CompanionId } from "@/features/persona";
import { VOTE_OPTIONS, type VoteOption } from "@/lib/config/app";
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
  const [errorMessage, setErrorMessage] = useState<string>();
  const [, startVoteTransition] = useTransition();

  const [optimisticTally, setOptimisticTally] = useOptimistic(
    initialTally,
    (currentTally, votedOption: VoteOption) => ({
      ...currentTally,
      [votedOption]: (currentTally[votedOption] ?? 0) + 1,
    }),
  );

  const highestVote = Math.max(1, ...Object.values(optimisticTally).map(Number));

  const handleCue = (option: VoteOption) => {
    play("vote");
    setErrorMessage(undefined);

    startVoteTransition(async () => {
      setOptimisticTally(option);

      try {
        const result = await submitVoteAction(roomId, option, voterToken);
        if (!result.success) setErrorMessage(result.error);
      } catch {
        setErrorMessage("That room cue did not land. Try again.");
      }
    });
  };

  return (
    <section className="vote-panel" aria-labelledby="vote-title">
      <div className="vote-panel__header">
        <div>
          <span className="eyebrow">SHAPE THE MOMENT</span>
          <h2 id="vote-title">Give {companion.name} a cue</h2>
        </div>
        <span>Room prompt</span>
      </div>
      <p className="vote-panel__description">
        You are not just watching. Send one direction and {companion.name} will fold the room&apos;s choice into the next live moment.
      </p>

      {errorMessage ? (
        <div className="error-message" role="alert">
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <div className="vote-options">
        {VOTE_OPTIONS.map((candidate) => {
          const count = optimisticTally[candidate.value] ?? 0;
          const percentage = Math.round((count / highestVote) * 100);
          return (
            <button
              key={candidate.value}
              className="vote-option"
              type="button"
              onClick={() => handleCue(candidate.value)}
              aria-label={`Send cue: ${candidate.label}`}
            >
              <span className="vote-option__main">
                <span className="vote-option__emoji" aria-hidden="true">{candidate.emoji}</span>
                <span>
                  <strong>{candidate.shortLabel}</strong>
                  <small>{candidate.label}</small>
                </span>
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
        <span>Each cue becomes part of the shared room story.</span>
      </footer>
    </section>
  );
}
