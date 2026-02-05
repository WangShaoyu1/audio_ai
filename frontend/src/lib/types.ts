export type MessageRole = 'user' | 'assistant' | 'system';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  intent?: string;
  functionCall?: {
    name: string;
    arguments: Record<string, any>;
  };
  latency?: number;
  ttft?: number;
  confidence?: number;
  metadata?: any;
  isError?: boolean;
  feedback?: 'like' | 'dislike' | null;
}

export interface SystemState {
  isListening: boolean;
  isProcessing: boolean;
  currentIntent: string | null;
  activeFunction: string | null;
  microwaveState: {
    status: 'idle' | 'cooking' | 'paused' | 'finished';
    mode: string | null;
    temperature: number | null;
    duration: number | null; // in seconds
    remaining: number | null; // in seconds
    firepower: 'low' | 'medium' | 'high' | null;
  };
}

export const SAMPLE_PROMPTS = [
  "Start cooking with high fire for 5 minutes",
  "Pause cooking",
  "How do I make spicy chicken wings?",
  "What's the weather like today?",
  "Set temperature to 180 degrees",
  "Search for a recipe for beef stew"
];
