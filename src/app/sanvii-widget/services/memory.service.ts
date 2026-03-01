import { Injectable } from '@angular/core';
import {
  SanviiMemory,
  SanviiMessage,
  MemoryFact,
  FavoriteTopic,
  DEFAULT_MEMORY
} from '../models/sanvii.models';

@Injectable({ providedIn: 'root' })
export class MemoryService {

  private readonly MEMORY_KEY = 'sanvii_memory';
  private readonly HISTORY_KEY = 'sanvii_history';
  private readonly MAX_HISTORY = 500;

  private memory: SanviiMemory;

  constructor() {
    this.memory = this.loadMemory();
  }

  private loadMemory(): SanviiMemory {
    try {
      const saved = localStorage.getItem(this.MEMORY_KEY);
      return saved ? { ...DEFAULT_MEMORY, ...JSON.parse(saved) } : { ...DEFAULT_MEMORY };
    } catch {
      return { ...DEFAULT_MEMORY };
    }
  }

  private saveMemory(): void {
    localStorage.setItem(this.MEMORY_KEY, JSON.stringify(this.memory));
  }

  // ── Owner Name ──
  getOwnerName(): string {
    return this.memory.ownerName;
  }

  setOwnerName(name: string): void {
    this.memory.ownerName = name;
    this.saveMemory();
  }

  // ── Facts ──
  learnFact(key: string, value: string): void {
    const existing = this.memory.facts.findIndex(
      (f: MemoryFact) => f.key.toLowerCase() === key.toLowerCase()
    );

    if (existing >= 0) {
      this.memory.facts[existing].value = value;
      this.memory.facts[existing].learnedAt = Date.now();
    } else {
      this.memory.facts.push({ key, value, learnedAt: Date.now() });
    }

    this.saveMemory();
  }

  recallFact(key: string): string | null {
    const fact = this.memory.facts.find(
      (f: MemoryFact) => f.key.toLowerCase().includes(key.toLowerCase())
    );
    return fact?.value || null;
  }

  getAllFacts(): { key: string; value: string }[] {
    return this.memory.facts.map((f: MemoryFact) => ({
      key: f.key,
      value: f.value
    }));
  }

  // ── Conversation Tracking ──
  recordInteraction(): void {
    this.memory.conversationCount++;
    this.memory.lastInteraction = Date.now();
    this.saveMemory();
  }

  getConversationCount(): number {
    return this.memory.conversationCount;
  }

  getDaysSinceFirstMeet(): number {
    const diff = Date.now() - this.memory.firstInteraction;
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  // ── Topic Tracking ──
  trackTopic(topic: string): void {
    const existing = this.memory.favoriteTopics.find(
      (t: FavoriteTopic) => t.topic.toLowerCase() === topic.toLowerCase()
    );

    if (existing) {
      existing.count++;
    } else {
      this.memory.favoriteTopics.push({ topic, count: 1 });
    }

    this.memory.favoriteTopics.sort(
      (a: FavoriteTopic, b: FavoriteTopic) => b.count - a.count
    );
    this.saveMemory();
  }

  getTopTopics(n = 5): FavoriteTopic[] {
    return this.memory.favoriteTopics.slice(0, n);
  }

  // ── Mood ──
  setMood(mood: string): void {
    this.memory.mood = mood;
    this.saveMemory();
  }

  getMood(): string {
    return this.memory.mood;
  }

  // ── Preferences ──
  setPreference(key: string, value: any): void {
    this.memory.preferences[key] = value;
    this.saveMemory();
  }

  getPreference(key: string): any {
    return this.memory.preferences[key];
  }

  // ── Chat History ──
  saveHistory(messages: SanviiMessage[]): void {
    const trimmed = messages.slice(-this.MAX_HISTORY);
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(trimmed));
  }

  loadHistory(): SanviiMessage[] {
    try {
      const saved = localStorage.getItem(this.HISTORY_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  clearHistory(): void {
    localStorage.removeItem(this.HISTORY_KEY);
  }

  // ── Extract facts from user messages ──
  extractAndLearn(userText: string): void {
    const text = userText.toLowerCase();

    const nameMatch = text.match(/my name is (\w+)/i);
    if (nameMatch) {
      this.setOwnerName(nameMatch[1]);
      this.learnFact('owner_name', nameMatch[1]);
    }

    const likeMatch = text.match(/i (?:like|love|enjoy) (.+)/i);
    if (likeMatch) {
      this.learnFact('likes_' + Date.now(), likeMatch[1].trim());
    }

    const jobMatch = text.match(/i (?:am a|work as|work at|am an?) (.+)/i);
    if (jobMatch) {
      this.learnFact('occupation', jobMatch[1].trim());
    }

    const locationMatch = text.match(/i live in (.+)/i);
    if (locationMatch) {
      this.learnFact('location', locationMatch[1].trim());
    }

    const favMatch = text.match(/my fav(?:orite|ourite)? (\w+) is (.+)/i);
    if (favMatch) {
      this.learnFact('favorite_' + favMatch[1], favMatch[2].trim());
    }

    const rememberMatch = text.match(/remember (?:that |this:? )?(.+)/i);
    if (rememberMatch && !text.includes('remind')) {
      this.learnFact('remembered_' + Date.now(), rememberMatch[1].trim());
    }

    const topics = ['music', 'coding', 'weather', 'news', 'sports', 'movies',
                     'food', 'travel', 'work', 'study', 'games'];
    topics.forEach((t: string) => {
      if (text.includes(t)) this.trackTopic(t);
    });
  }

  resetAll(): void {
    this.memory = { ...DEFAULT_MEMORY };
    this.saveMemory();
    this.clearHistory();
  }
}