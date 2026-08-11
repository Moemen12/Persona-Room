import { useState, useEffect } from 'react';
import type { Mood } from '../../shared/types';
import './RinaAvatar.css';

interface RinaAvatarProps {
  mood: Mood;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

const MOOD_COLORS: Record<Mood, string> = {
  neutral: '#9CA3AF',
  happy: '#FBBF24',
  surprised: '#A78BFA',
  'sad/thoughtful': '#60A5FA',
};

const MOOD_EMOJIS: Record<Mood, string> = {
  neutral: '😐',
  happy: '😊',
  surprised: '😲',
  'sad/thoughtful': '🤔',
};

const SIZE_CLASSES: Record<string, string> = {
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-32 h-32',
};

export function RinaAvatar({ mood, size = 'md', animated = true }: RinaAvatarProps) {
  const [prevMood, setPrevMood] = useState<Mood>(mood);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (prevMood !== mood && animated) {
      setIsTransitioning(true);
      const timer = setTimeout(() => {
        setPrevMood(mood);
        setIsTransitioning(false);
      }, 300);
      return () => clearTimeout(timer);
    } else {
      setPrevMood(mood);
    }
  }, [mood, animated, prevMood]);

  return (
    <div className={`rina-avatar-container ${SIZE_CLASSES[size]}`}>
      <div
        className={`rina-avatar ${isTransitioning ? 'rina-avatar-transitioning' : ''}`}
        style={{
          backgroundColor: MOOD_COLORS[mood],
          opacity: isTransitioning ? 0.5 : 1,
        }}
      >
        <span className="rina-avatar-emoji text-4xl">{MOOD_EMOJIS[mood]}</span>
      </div>
      <div className="rina-mood-label text-sm font-medium text-slate-400 mt-2">
        {mood === 'sad/thoughtful' ? 'Thoughtful' : mood.charAt(0).toUpperCase() + mood.slice(1)}
      </div>
    </div>
  );
}
