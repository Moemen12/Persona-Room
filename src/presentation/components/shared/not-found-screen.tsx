import { Compass, House, Sparkles } from "lucide-react";
import Link from "next/link";

export function NotFoundScreen() {
  return (
    <main className="not-found-screen">
      <div className="not-found-screen__card" role="status">
        <div className="not-found-screen__icon" aria-hidden="true">
          <Compass size={24} />
        </div>
        <span className="eyebrow not-found-screen__eyebrow">
          <Sparkles aria-hidden="true" size={13} />
          ROOM NOT FOUND
        </span>
        <div className="not-found-screen__copy">
          <h1>This room is no longer available.</h1>
          <p>
            The link may be expired, private, or typed incorrectly. Start a new room or return to Persona Room.
          </p>
        </div>
        <div className="not-found-screen__actions">
          <Link className="not-found-screen__primary" href="/">
            <House aria-hidden="true" size={15} />
            <span>Return home</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
