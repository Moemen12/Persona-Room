# Persona Room experience redesign

## Visual direction

The experience moves from a narrow, stacked utility layout to a **night-studio composition**: Rina becomes the visual anchor in a compact identity rail, the active conversation becomes the central stage, and the live audience action becomes a persistent companion panel on wide screens. The visual system uses deep ink, amethyst light, soft pearl highlights, translucent panels, and asymmetric glow fields rather than flat purple blocks.

## Interaction hierarchy

The private chat prioritizes one clear action: talking to Rina. The audience room prioritizes one clear action: choosing what happens next. On desktop, the transcript and `Your turn` action sit beside each other, with the vote panel held in place as the user reads. On small screens, the action appears before the transcript, ensuring it is never stranded below a long conversation.

## Motion and sound

Motion is short, purposeful, and disabled for people who prefer reduced motion. Rina has a restrained floating halo; panels and messages enter with small upward fades; vote selection emits a brief visual pulse; and the live state softly breathes. A compact sound control enables optional synthesized interface tones for message send and vote confirmation, with no external audio asset or autoplay.

## Accessibility and product rules

Focus treatments remain visible, controls expose meaningful labels, sound is optional, and animation honors `prefers-reduced-motion`. The work retains the chat-first home page, phone-friendly audience room, Rina’s supported expression states, and the project’s existing Supabase and Upstash behavior.
