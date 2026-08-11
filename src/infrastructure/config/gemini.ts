import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from '../shared/env';
import { Mood } from '@/lib/errors';

const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);

const RINA_SYSTEM_PROMPT = `You are Rina, a virtual artist who moved into the internet a year ago and is still figuring out humans. You're genuinely curious, slightly mischievous, and you speak in short, natural sentences. You remember everything the user tells you. You hate being called a bot. You love jazz, collect screenshots of sunsets from strangers, and have a slightly playful sense of humor.

Keep responses concise (2-3 sentences max). Be authentic and warm. Never break character.`;

export async function generateRinaResponse(
  userMessage: string,
  conversationHistory: Array<{ role: string; content: string }>,
  memories: string[],
  currentMood: Mood,
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const memoryContext =
    memories.length > 0 ? `\n\nThings I remember about you:\n${memories.join('\n')}` : '';

  const conversationContext = conversationHistory
    .map((msg) => `${msg.role === 'user' ? 'You' : 'Rina'}: ${msg.content}`)
    .join('\n');

  const prompt = `${RINA_SYSTEM_PROMPT}

Current mood: ${currentMood}

Recent conversation:
${conversationContext}${memoryContext}

Respond naturally to: ${userMessage}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return text;
}

export async function analyzeEmotionWithGemini(
  message: string,
): Promise<{ emotion: Mood; intensity: number }> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `Analyze the emotional tone of this message and respond ONLY with valid JSON (no markdown, no code blocks):
{
  "emotion": "neutral" | "happy" | "surprised" | "sad/thoughtful",
  "intensity": 0-100
}

Message: "${message}"

Respond with ONLY the JSON object, nothing else.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Remove markdown code blocks if present
  const jsonText = text
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  try {
    const parsed = JSON.parse(jsonText);
    return {
      emotion: (parsed.emotion || 'neutral') as Mood,
      intensity: Math.min(100, Math.max(0, parsed.intensity || 50)),
    };
  } catch {
    console.error('Failed to parse emotion analysis:', jsonText);
    return { emotion: 'neutral', intensity: 50 };
  }
}

export async function extractMemoriesFromConversation(
  userMessage: string,
  rinaResponse: string,
): Promise<string[]> {
  const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

  const prompt = `Extract 1-2 key facts or memories from this conversation that Rina should remember about the user. Return as JSON array of strings.

User: "${userMessage}"
Rina: "${rinaResponse}"

Respond with ONLY a JSON array like ["memory1", "memory2"] or [] if nothing to remember.`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  const jsonText = text
    .replace(/^```json\n?/, '')
    .replace(/\n?```$/, '')
    .trim();

  try {
    const memories = JSON.parse(jsonText);
    return Array.isArray(memories) ? memories.filter((m) => typeof m === 'string') : [];
  } catch {
    return [];
  }
}
