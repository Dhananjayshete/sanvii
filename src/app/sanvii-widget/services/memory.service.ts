// ═══════════════════════════════════════════════════════════
//  MEMORY SERVICE — FIXED
//  ✅ Debounced saves (no localStorage spam during streaming)
//  ✅ saveHistoryNow() for immediate flush after stream ends
//  ✅ Schema versioning — old corrupt data wiped cleanly
//  ✅ Fact cap (50) with oldest-first eviction
//  ✅ try/catch on every read — one bad entry won't kill all memory
//  ✅ Quota exceeded handling
// ═══════════════════════════════════════════════════════════

import { Injectable } from '@angular/core';
import { SanviiMessage, SanviiMemory, MemoryFact, DEFAULT_MEMORY } from '../models/sanvii.models';

const KEYS = {
  HISTORY: 'sanvii_history_v2',
  MEMORY:  'sanvii_memory_v2',
  SCHEMA:  'sanvii_schema_ver',
};

const SCHEMA_VERSION = 2;
const MAX_HISTORY    = 100;
const MAX_FACTS      = 50;
const SAVE_DEBOUNCE  = 2000; // ms — won't hammer localStorage during streaming

@Injectable({ providedIn: 'root' })
export class MemoryService {

  private memory: SanviiMemory = { ...DEFAULT_MEMORY };
  private saveHistoryTimer: any = null;

  constructor() {
    this.migrateIfNeeded();
    this.memory = this.loadMemory();
  }

  // ════════════════════════════════════════════════════════
  //  SCHEMA MIGRATION
  // ════════════════════════════════════════════════════════

  private migrateIfNeeded(): void {
    try {
      const stored = parseInt(localStorage.getItem(KEYS.SCHEMA) || '0', 10);
      if (stored < SCHEMA_VERSION) {
        // Clear old v1 keys
        ['sanvii_history', 'sanvii_memory', 'sanvii_history_v1', 'sanvii_memory_v1']
          .forEach(k => localStorage.removeItem(k));
        localStorage.setItem(KEYS.SCHEMA, String(SCHEMA_VERSION));
        console.log('🧠 Memory: migrated to schema v' + SCHEMA_VERSION);
      }
    } catch (e) {
      console.warn('Memory migration failed:', e);
    }
  }

  // ════════════════════════════════════════════════════════
  //  HISTORY
  // ════════════════════════════════════════════════════════

  loadHistory(): SanviiMessage[] {
    try {
      const raw = localStorage.getItem(KEYS.HISTORY);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .filter((m: any) => m && typeof m.id === 'string' && typeof m.text === 'string')
        .slice(-MAX_HISTORY);

    } catch (e) {
      console.warn('⚠️ History load failed, resetting:', e);
      localStorage.removeItem(KEYS.HISTORY);
      return [];
    }
  }

  // Debounced — safe to call on every streaming token
  saveHistory(messages: SanviiMessage[]): void {
    if (this.saveHistoryTimer) clearTimeout(this.saveHistoryTimer);
    this.saveHistoryTimer = setTimeout(() => {
      this._flushHistory(messages);
    }, SAVE_DEBOUNCE);
  }

  // Immediate — call this after stream finishes (bypasses debounce)
  saveHistoryNow(messages: SanviiMessage[]): void {
    if (this.saveHistoryTimer) {
      clearTimeout(this.saveHistoryTimer);
      this.saveHistoryTimer = null;
    }
    this._flushHistory(messages);
  }

  private _flushHistory(messages: SanviiMessage[]): void {
    try {
      const toSave = messages.slice(-MAX_HISTORY).map(m => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        time: m.time,
        timestamp: m.timestamp,
        ...(m.action ? { action: m.action } : {}),
        ...(m.card   ? { card: m.card }     : {}),
      }));
      localStorage.setItem(KEYS.HISTORY, JSON.stringify(toSave));
    } catch (e: any) {
      if (e?.name === 'QuotaExceededError') {
        console.warn('⚠️ localStorage quota exceeded — emergency trim');
        try {
          localStorage.setItem(KEYS.HISTORY, JSON.stringify(messages.slice(-20)));
        } catch {
          localStorage.removeItem(KEYS.HISTORY);
        }
      } else {
        console.warn('History save failed:', e);
      }
    }
  }

  clearHistory(): void {
    if (this.saveHistoryTimer) clearTimeout(this.saveHistoryTimer);
    localStorage.removeItem(KEYS.HISTORY);
  }

  // ════════════════════════════════════════════════════════
  //  MEMORY FACTS
  // ════════════════════════════════════════════════════════

  private loadMemory(): SanviiMemory {
    try {
      const raw = localStorage.getItem(KEYS.MEMORY);
      if (!raw) return { ...DEFAULT_MEMORY };

      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_MEMORY,
        ...parsed,
        facts: Array.isArray(parsed.facts) ? parsed.facts.slice(0, MAX_FACTS) : [],
        favoriteTopics: Array.isArray(parsed.favoriteTopics) ? parsed.favoriteTopics : [],
        preferences: parsed.preferences || {},
      };
    } catch (e) {
      console.warn('⚠️ Memory load failed, resetting:', e);
      localStorage.removeItem(KEYS.MEMORY);
      return { ...DEFAULT_MEMORY };
    }
  }

  private saveMemory(): void {
    try {
      localStorage.setItem(KEYS.MEMORY, JSON.stringify(this.memory));
    } catch (e) {
      console.warn('Memory save failed:', e);
    }
  }

  // ════════════════════════════════════════════════════════
  //  PUBLIC API
  // ════════════════════════════════════════════════════════

  setOwnerName(name: string): void {
    this.memory.ownerName = name;
    this.learnFact('owner_name', name);
    this.saveMemory();
  }

  recallFact(key: string): string | null {
    return this.memory.facts.find(f => f.key === key)?.value || null;
  }

  learnFact(key: string, value: string): void {
    const existing = this.memory.facts.find(f => f.key === key);
    if (existing) {
      existing.value = value;
      existing.learnedAt = Date.now();
    } else {
      if (this.memory.facts.length >= MAX_FACTS) {
        this.memory.facts.sort((a, b) => a.learnedAt - b.learnedAt);
        this.memory.facts.shift();
      }
      this.memory.facts.push({ key, value, learnedAt: Date.now() });
    }
    this.saveMemory();
  }

  getAllFacts(): MemoryFact[] {
    return [...this.memory.facts];
  }

  recordInteraction(): void {
    this.memory.conversationCount++;
    this.memory.lastInteraction = Date.now();
    if (!this.memory.firstInteraction) this.memory.firstInteraction = Date.now();
    this.saveMemory();
  }

  getConversationCount(): number {
    return this.memory.conversationCount;
  }

  getTopTopics(n: number) {
    return [...this.memory.favoriteTopics]
      .sort((a, b) => b.count - a.count)
      .slice(0, n);
  }

  extractAndLearn(text: string): void {
    // Name
    const nameMatch = text.match(/(?:my name is|call me|i'?m)\s+([A-Z][a-z]+)/i);
    if (nameMatch) this.learnFact('owner_name', nameMatch[1]);

    // Location
    const locMatch = text.match(/(?:i(?:'?m| am) (?:from|in|based in)|i live in)\s+([A-Z][a-zA-Z\s,]+)/i);
    if (locMatch) this.learnFact('location', locMatch[1].trim());

    // Job
    const jobMatch = text.match(/(?:i(?:'?m| am) a(?:n)?|i work as a(?:n)?)\s+([a-zA-Z\s]+?)(?:\.|,|$)/i);
    if (jobMatch) this.learnFact('job', jobMatch[1].trim());

    // Age
    const ageMatch = text.match(/i(?:'?m| am)\s+(\d+)\s+years? old/i);
    if (ageMatch) this.learnFact('age', ageMatch[1]);

    // Topics
    const lower = text.toLowerCase();
    const topics = ['music', 'coding', 'gaming', 'fitness', 'cooking', 'travel', 'movies', 'books', 'sports', 'art'];
    for (const topic of topics) {
      if (lower.includes(topic)) {
        const existing = this.memory.favoriteTopics.find(t => t.topic === topic);
        if (existing) existing.count++;
        else this.memory.favoriteTopics.push({ topic, count: 1 });
      }
    }

    this.saveMemory();
  }
}