import { Injectable } from '@angular/core';
import { SanviiAction, SanviiMessage } from '../models/sanvii.models';
import { MemoryService } from './memory.service';
import { TodoService } from './todo.service';
import { SettingsService } from './settings.service';

// ═══════════════════════════════════════════════
//  AI SERVICE — FIXED & OPTIMIZED
//  ✅ Streaming support (word-by-word output)
//  ✅ Client-side history (no shared server state)
//  ✅ onToken callback for live rendering
//  ✅ Proper abort/cleanup on errors
// ═══════════════════════════════════════════════

export interface AIResponse {
  reply: string;
  action: SanviiAction | null;
  tokens?: any;
  model?: string;
  error?: string;
  isLocal: boolean;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;    // Called for each word/token
  onDone: (action: SanviiAction | null, fullReply: string) => void;  // Called when complete
  onError: (msg: string) => void;      // Called on failure
}

@Injectable({ providedIn: 'root' })
export class AIService {

  private readonly API_URL = 'http://localhost:3847/api';
  private backendAvailable = false;
  private lastCheck = 0;
  private checking = false;

  // ✅ Client-side history — each browser tab owns its own history
  private conversationHistory: { role: string; content: string }[] = [];
  private readonly MAX_HISTORY = 20;

  constructor(
    private memory: MemoryService,
    private todos: TodoService,
    private settings: SettingsService
  ) {
    this.checkBackend();
  }

  // ═══════════════════════════════════════
  //  CHECK BACKEND
  // ═══════════════════════════════════════

  async checkBackend(): Promise<boolean> {
    if (Date.now() - this.lastCheck < 30000 && this.lastCheck > 0) {
      return this.backendAvailable;
    }
    if (this.checking) return this.backendAvailable;

    this.checking = true;
    this.lastCheck = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const response = await fetch(`${this.API_URL}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.backendAvailable = !!data.hasApiKey;
        console.log(this.backendAvailable
          ? '🟣 Sanvii: ✅ Connected to Groq (FREE) — Streaming: ' + data.streaming
          : '🟣 Sanvii: ⚠️ Server running but no API key');
      } else {
        this.backendAvailable = false;
      }
    } catch {
      this.backendAvailable = false;
      console.log('🟣 Sanvii: 💡 Using local brain (server not running)');
    }

    this.checking = false;
    return this.backendAvailable;
  }

  // ═══════════════════════════════════════
  //  ✅ STREAMING CHAT — main method
  //  Returns true if streaming started, false if using local brain
  // ═══════════════════════════════════════

  async chatStream(message: string, callbacks: StreamCallbacks): Promise<boolean> {
    if (!this.backendAvailable) {
      this.checkBackend(); // Recheck in background
      return false; // Tell component to use local brain
    }

    try {
      const context = this.buildContext();

      const response = await fetch(`${this.API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: this.conversationHistory,   // ✅ Send history from client
          context
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Stream failed: ' + response.status);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullReply = '';

      // ✅ Add user message to local history immediately
      this.conversationHistory.push({ role: 'user', content: message });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          const rawData = line.slice(6).trim();
          if (!rawData) continue;

          try {
            const event = JSON.parse(rawData);

            if (event.token) {
              fullReply += event.token;
              callbacks.onToken(event.token);
            }

            if (event.done) {
              // ✅ Add AI reply to local history
              this.conversationHistory.push({
                role: 'assistant',
                content: event.fullReply || fullReply
              });

              // Trim history to max
              if (this.conversationHistory.length > this.MAX_HISTORY * 2) {
                this.conversationHistory = this.conversationHistory.slice(-this.MAX_HISTORY * 2);
              }

              callbacks.onDone(event.action || null, event.fullReply || fullReply);
            }

            if (event.error) {
              const errorMsg = event.reply || "Sorry Boss, something went wrong! 🤔";
              callbacks.onError(errorMsg);
              this.backendAvailable = false;
              this.lastCheck = 0;
              return true; // Was handled (even as error)
            }

          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      return true; // Stream completed successfully

    } catch (err) {
      console.warn('🟣 Stream failed, falling back to local brain:', err);
      this.backendAvailable = false;
      this.lastCheck = 0;
      return false; // Fall through to local brain
    }
  }

  // ═══════════════════════════════════════
  //  NON-STREAMING FALLBACK (kept for compat)
  // ═══════════════════════════════════════

  async chat(message: string): Promise<AIResponse> {
    if (!this.backendAvailable) {
      this.checkBackend();
      return { reply: '', action: null, isLocal: true };
    }

    try {
      const context = this.buildContext();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: this.conversationHistory,  // ✅ Send history from client
          context
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Server returned ' + response.status);

      const data = await response.json();

      // Update local history
      this.conversationHistory.push({ role: 'user', content: message });
      this.conversationHistory.push({ role: 'assistant', content: data.reply || '' });
      if (this.conversationHistory.length > this.MAX_HISTORY * 2) {
        this.conversationHistory = this.conversationHistory.slice(-this.MAX_HISTORY * 2);
      }

      return {
        reply: data.reply || '',
        action: data.action || null,
        tokens: data.tokens,
        model: data.model,
        error: data.error,
        isLocal: false
      };
    } catch (err) {
      console.warn('🟣 Groq failed, using local brain:', err);
      this.backendAvailable = false;
      this.lastCheck = 0;
      return { reply: '', action: null, isLocal: true };
    }
  }

  // ═══════════════════════════════════════
  //  BUILD CONTEXT from memory/settings
  // ═══════════════════════════════════════

  private buildContext() {
    return {
      ownerName: this.settings.get('ownerName'),
      facts: this.memory.getAllFacts().slice(0, 15),
      mood: this.memory.getMood(),
      pendingTodos: this.todos.getPending().length
    };
  }

  // ═══════════════════════════════════════
  //  CLEAR HISTORY
  // ═══════════════════════════════════════

  clearHistory(): void {
    this.conversationHistory = [];
    console.log('🟣 Client conversation history cleared');
  }

  // Kept for backward compat — no longer clears server (no server state)
  async clearServerHistory(): Promise<void> {
    this.clearHistory();
  }

  isGPTAvailable(): boolean {
    return this.backendAvailable;
  }
}