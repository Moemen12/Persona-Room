export type Mood = 'neutral' | 'happy' | 'surprised' | 'sad/thoughtful';

export interface MoodAnalysis {
  emotion: Mood;
  intensity: number;
}
