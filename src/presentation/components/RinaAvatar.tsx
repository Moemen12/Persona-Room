'use client';

import React from 'react';
import { Mood } from '@/lib/errors';
import './RinaAvatar.css';

interface RinaAvatarProps {
  mood: Mood;
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export function RinaAvatar({ mood, size = 'md', animated = true }: RinaAvatarProps) {
  const sizeClasses = {
    sm: 'w-16 h-16',
    md: 'w-32 h-32',
    lg: 'w-48 h-48',
  };

  const getMoodEmoji = (m: Mood): string => {
    switch (m) {
      case 'happy':
        return '😊';
      case 'surprised':
        return '😮';
      case 'sad/thoughtful':
        return '🤔';
      case 'neutral':
      default:
        return '😌';
    }
  };

  const getMoodColor = (m: Mood): string => {
    switch (m) {
      case 'happy':
        return 'from-amber-300 to-yellow-200';
      case 'surprised':
        return 'from-blue-300 to-cyan-200';
      case 'sad/thoughtful':
        return 'from-slate-300 to-slate-200';
      case 'neutral':
      default:
        return 'from-purple-300 to-pink-200';
    }
  };

  return (
    <div
      className={`
        rina-avatar
        ${sizeClasses[size]}
        bg-gradient-to-br ${getMoodColor(mood)}
        rounded-full
        flex items-center justify-center
        shadow-lg
        text-6xl
        ${animated ? 'mood-transition' : ''}
      `}
      data-mood={mood}
    >
      {getMoodEmoji(mood)}
    </div>
  );
}
