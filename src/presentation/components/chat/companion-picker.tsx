import { Sparkles, X } from "lucide-react";

import { COMPANIONS, type CompanionId } from "@/features/persona/persona.types";
import { cn } from "@/lib/utils";
import { RinaAvatar } from "@/presentation/components/rina-avatar";

interface CompanionPickerProps {
  currentCompanionId: CompanionId;
  isChanging: boolean;
  onSelect: (companionId: CompanionId) => void;
  onClose: () => void;
}

export function CompanionPicker({
  currentCompanionId,
  isChanging,
  onSelect,
  onClose,
}: CompanionPickerProps) {
  return (
    <section
      className="companion-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="companion-picker-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="companion-picker__panel">
        <div className="companion-picker__top">
          <span className="eyebrow"><Sparkles aria-hidden="true" size={13} /> YOUR PRIVATE ROOM</span>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close companion picker"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>
        <h2 id="companion-picker-title">Who do you want to talk with?</h2>
        <p>Choose a companion for this room. You can change your choice later from the profile card.</p>
        <div className="companion-picker__choices">
          {(Object.values(COMPANIONS) as (typeof COMPANIONS)[CompanionId][]).map((candidate) => (
            <button
              key={candidate.id}
              className={cn("companion-choice", candidate.id === currentCompanionId && "companion-choice--selected")}
              type="button"
              onClick={() => void onSelect(candidate.id)}
              disabled={isChanging}
            >
              <RinaAvatar companionId={candidate.id} mood="neutral" size="message" />
              <span className="companion-choice__copy">
                <strong>{candidate.name}</strong>
                <span>{candidate.gender === "female" ? "Female companion" : "Male companion"}</span>
                <small>{candidate.selectorCopy}</small>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
