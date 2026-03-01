// ═══════════════════════════════════════════════
//  ALL INTERFACES & TYPES FOR SANVII
// ═══════════════════════════════════════════════

export interface SanviiMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  time: string;
  timestamp: number;
  action?: SanviiAction;
  card?: SanviiCard;
  mood?: string;
}

export interface SanviiAction {
  type: string;
  url?: string;
  label?: string;
  data?: any;
}

export interface SanviiCard {
  type: 'weather' | 'news' | 'todo' | 'note' | 'reminder' | 'stats' | 'briefing' | 'currency' | 'timer';
  data: any;
}

export interface SanviiReminder {
  id: string;
  message: string;
  time: number;
  timeStr: string;
  active: boolean;
  fired: boolean;
}

export interface SanviiTodo {
  id: string;
  text: string;
  done: boolean;
  createdAt: number;
  completedAt?: number;
}

export interface SanviiNote {
  id: string;
  text: string;
  createdAt: number;
  tags?: string[];
}

export interface MemoryFact {
  key: string;
  value: string;
  learnedAt: number;
}

export interface FavoriteTopic {
  topic: string;
  count: number;
}

export interface SanviiMemory {
  ownerName: string;
  facts: MemoryFact[];
  conversationCount: number;
  firstInteraction: number;
  lastInteraction: number;
  favoriteTopics: FavoriteTopic[];
  mood: string;
  preferences: Record<string, any>;
}

export interface SanviiSettings {
  ownerName: string;
  language: string;
  voiceType: string;
  voiceSpeed: number;
  voicePitch: number;
  autoSpeak: boolean;
  wakeWordEnabled: boolean;
  theme: string;
  avatarPosition: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  chatWidth: number;
  animations: boolean;
  soundEffects: boolean;
  reminderAlerts: boolean;
  dailyBriefing: boolean;
  responseLength: 'short' | 'medium' | 'long';
  personality: 'friendly' | 'professional' | 'funny' | 'calm';
}

export interface WeatherData {
  city: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  wind: number;
  description: string;
  icon: string;
  forecast?: WeatherForecast[];
}

export interface WeatherForecast {
  day: string;
  temp: number;
  desc: string;
}

export interface NewsItem {
  title: string;
  source: string;
  url: string;
  publishedAt: string;
  description?: string;
}

export interface ProductivityStats {
  date: string;
  activeTime: number;
  conversations: number;
  tasksCompleted: number;
  tasksTotal: number;
  searchesMade: number;
  websitesOpened: number;
  songsPlayed: number;
  remindersSet: number;
  score: number;
}

export interface TimerData {
  id: string;
  label: string;
  duration: number;
  remaining: number;
  active: boolean;
  startedAt: number;
}

export const DEFAULT_SETTINGS: SanviiSettings = {
  ownerName: 'Boss',
  language: 'en-US',
  voiceType: 'default',
  voiceSpeed: 1.05,
  voicePitch: 1.1,
  autoSpeak: true,
  wakeWordEnabled: false,
  theme: 'dark',
  avatarPosition: 'bottom-right',
  chatWidth: 380,
  animations: true,
  soundEffects: true,
  reminderAlerts: true,
  dailyBriefing: true,
  responseLength: 'medium',
  personality: 'friendly'
};

export const DEFAULT_MEMORY: SanviiMemory = {
  ownerName: 'Boss',
  facts: [],
  conversationCount: 0,
  firstInteraction: Date.now(),
  lastInteraction: Date.now(),
  favoriteTopics: [],
  mood: 'neutral',
  preferences: {}
};