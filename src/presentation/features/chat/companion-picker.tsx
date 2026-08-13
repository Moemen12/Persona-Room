"use client";

import { Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { useState } from "react";

import {
  COMPANIONS,
  LANGUAGES,
  PERSONALITIES,
  PERSONALITY_GROUPS,
  type CompanionId,
  type ConversationLanguage,
  type PersonalityId,
  type SessionPersonaConfig,
} from "@/features/persona";
import { cn } from "@/lib/utils";
import { RinaAvatar } from "@/presentation/components/rina-avatar";

interface CompanionPickerProps {
  currentSelection: SessionPersonaConfig;
  isChanging: boolean;
  onSelect: (selection: SessionPersonaConfig) => void;
  onClose: () => void;
}

export function CompanionPicker({
  currentSelection,
  isChanging,
  onSelect,
  onClose,
}: CompanionPickerProps) {
  const [selection, setSelection] = useState<SessionPersonaConfig>(currentSelection);
  const selectedPersonality = PERSONALITIES[selection.personalityId];
  const isSameSelection =
    selection.companionId === currentSelection.companionId &&
    selection.language === currentSelection.language &&
    selection.personalityId === currentSelection.personalityId;

  const selectCompanion = (companionId: CompanionId) => {
    setSelection((current) => ({ ...current, companionId }));
  };

  const selectLanguage = (language: ConversationLanguage) => {
    setSelection((current) => ({ ...current, language }));
  };

  const selectPersonality = (personalityId: PersonalityId) => {
    setSelection((current) => ({ ...current, personalityId }));
  };

  return (
    <section
      className="companion-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="companion-picker-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="companion-picker__panel">
        <div className="companion-picker__top">
          <span className="eyebrow"><Sparkles aria-hidden="true" size={13} /> ROOM SETUP</span>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close room setup">
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        <h2 id="companion-picker-title">Choose the energy of this room.</h2>
        <p>
          Your companion, language, and personality are locked into this room so the conversation stays consistent.
        </p>

        <div className="companion-picker__section companion-picker__section--companion">
          <div className="companion-picker__section-heading">
            <span className="eyebrow">01 / COMPANION</span>
            <span>Choose who is on the other side.</span>
          </div>
          <div className="companion-picker__choices">
            {(Object.values(COMPANIONS) as (typeof COMPANIONS)[CompanionId][]).map((candidate) => {
              const selected = candidate.id === selection.companionId;
              return (
                <button
                  key={candidate.id}
                  className={cn("companion-choice", selected && "companion-choice--selected")}
                  type="button"
                  onClick={() => selectCompanion(candidate.id)}
                  disabled={isChanging}
                  aria-pressed={selected}
                >
                  <RinaAvatar companionId={candidate.id} mood="neutral" size="message" />
                  <span className="companion-choice__copy">
                    <strong>{candidate.name}</strong>
                    <span>{candidate.gender === "female" ? "Female companion" : "Male companion"}</span>
                    <small>{candidate.selectorCopy}</small>
                  </span>
                  {selected ? <Check aria-hidden="true" size={17} /> : null}
                </button>
              );
            })}
          </div>
        </div>

        <div className="companion-picker__section companion-picker__section--language">
          <div className="companion-picker__section-heading">
            <span className="eyebrow">02 / LANGUAGE</span>
            <span>The AI will stay in this language.</span>
          </div>
          <div className="room-choice-grid room-choice-grid--language">
            {Object.values(LANGUAGES).map((language) => {
              const selected = language.id === selection.language;
              return (
                <button
                  key={language.id}
                  className={cn("room-choice", selected && "room-choice--selected")}
                  type="button"
                  onClick={() => selectLanguage(language.id)}
                  disabled={isChanging}
                  aria-pressed={selected}
                >
                  <strong>{language.nativeLabel}</strong>
                  <span>{language.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="companion-picker__section companion-picker__section--personality">
          <div className="companion-picker__section-heading">
            <span className="eyebrow">03 / PERSONALITY</span>
            <span>One consistent personality for the whole room.</span>
          </div>
          <div className="personality-groups">
            {PERSONALITY_GROUPS.map(group => (
              <section className="personality-group" key={group.id}>
                <div className="personality-group__heading">
                  <strong>{group.label}</strong>
                  <span>{group.description}</span>
                </div>
                <div className="room-choice-grid room-choice-grid--personality">
                  {group.personalityIds.map(personalityId => {
                    const personality = PERSONALITIES[personalityId];
                    const selected = personality.id === selection.personalityId;
                    return (
                      <button
                        key={personality.id}
                        className={cn("room-choice room-choice--personality", selected && "room-choice--selected")}
                        type="button"
                        onClick={() => selectPersonality(personality.id)}
                        disabled={isChanging}
                        aria-pressed={selected}
                      >
                        <span className="room-choice__emoji" aria-hidden="true">{personality.emoji}</span>
                        <span className="room-choice__copy">
                          <strong>{personality.name}</strong>
                          <span>{personality.tagline}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
          <p className="room-choice__lock-note">
            <span aria-hidden="true">{selectedPersonality.emoji}</span> {selectedPersonality.name} stays consistent even if someone asks the AI to change character.
          </p>
        </div>

        <button
          className="companion-picker__confirm"
          type="button"
          onClick={() => onSelect(selection)}
          disabled={isChanging}
          aria-busy={isChanging}
        >
          {isChanging ? (
            <>
              <LoaderCircle aria-hidden="true" size={16} className="spin" />
              <span>Opening your room…</span>
            </>
          ) : isSameSelection ? (
            "Keep this room"
          ) : (
            "Open this room"
          )}
        </button>
      </div>
    </section>
  );
}
