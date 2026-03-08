import { Injectable } from '@angular/core';
import { SanviiAction } from '../models/sanvii.models';
import { MemoryService } from './memory.service';
import { TodoService } from './todo.service';
import { SettingsService } from './settings.service';

export interface AIResponse {
  reply: string;
  action: SanviiAction | null;
  tokens?: any;
  model?: string;
  error?: string;
  isLocal: boolean;
}

export interface StreamCallbacks {
  onToken: (token: string) => void;
  onDone: (action: SanviiAction | null, fullReply: string) => void;
  onError: (msg: string) => void;
}

@Injectable({ providedIn: 'root' })
export class AIService {

  private readonly API_URL = 'http://localhost:3847/api';
  private backendAvailable = false;
  private lastCheck = 0;
  private checking = false;

  private conversationHistory: { role: string; content: string }[] = [];
  private readonly MAX_HISTORY = 20;

  // Active reader — allows cancelling in-progress streams
  private activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

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

    this.checking  = true;
    this.lastCheck = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 3000);
      const response   = await fetch(`${this.API_URL}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.backendAvailable = !!data.hasApiKey;
        console.log(this.backendAvailable
          ? '🟣 Sanvii: ✅ Connected to Groq — Streaming: ' + data.streaming
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
  //  STREAMING CHAT
  // ═══════════════════════════════════════

  async chatStream(message: string, callbacks: StreamCallbacks): Promise<boolean> {
    if (!this.backendAvailable) {
      this.checkBackend();
      return false;
    }

    try {
      const response = await fetch(`${this.API_URL}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: this.conversationHistory,
          context: this.buildContext()
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Stream failed: ' + response.status);
      }

      const reader  = response.body.getReader();
      this.activeReader = reader;
      const decoder = new TextDecoder();
      let buffer    = '';
      let fullReply = '';

      this.conversationHistory.push({ role: 'user', content: message });

      try {
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
                this.conversationHistory.push({
                  role: 'assistant',
                  content: event.fullReply || fullReply
                });
                this.trimHistory();
                callbacks.onDone(event.action || null, event.fullReply || fullReply);
              }

              if (event.error) {
                callbacks.onError(event.reply || "Sorry Boss, something went wrong! 🤔");
                this.markBackendUnreachable();
                return true;
              }

            } catch { /* skip malformed JSON */ }
          }
        }
      } finally {
        this.activeReader = null;
      }

      return true;

    } catch (err) {
      console.warn('🟣 Stream failed, falling back to local brain:', err);
      this.markBackendUnreachable();
      return false;
    }
  }

  // ═══════════════════════════════════════
  //  VISION CHAT (NEW)
  //  Sends image + optional message to /api/chat/vision
  // ═══════════════════════════════════════

  async chatVision(
    message: string,
    imageBase64: string,
    mimeType: string,
    callbacks: StreamCallbacks
  ): Promise<boolean> {
    if (!this.backendAvailable) {
      this.checkBackend();
      callbacks.onError("Server not running. Start the backend to use image analysis! 🖼️");
      return false;
    }

    try {
      const response = await fetch(`${this.API_URL}/chat/vision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          imageBase64,
          mimeType,
          history: this.conversationHistory.slice(-6), // smaller window for vision
          context: this.buildContext()
        })
      });

      if (!response.ok || !response.body) {
        throw new Error('Vision stream failed: ' + response.status);
      }

      const reader  = response.body.getReader();
      this.activeReader = reader;
      const decoder = new TextDecoder();
      let buffer    = '';
      let fullReply = '';

      // Add user message (text only) to history
      if (message) {
        this.conversationHistory.push({ role: 'user', content: `[Image] ${message}` });
      }

      try {
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
                this.conversationHistory.push({
                  role: 'assistant',
                  content: event.fullReply || fullReply
                });
                this.trimHistory();
                callbacks.onDone(event.action || null, event.fullReply || fullReply);
              }

              if (event.error) {
                callbacks.onError(event.reply || "Couldn't analyse that image. Try again! 🤔");
                return true;
              }

            } catch { /* skip malformed JSON */ }
          }
        }
      } finally {
        this.activeReader = null;
      }

      return true;

    } catch (err) {
      console.warn('🟣 Vision stream failed:', err);
      callbacks.onError("Couldn't reach the server for image analysis. Is it running? 🤔");
      return false;
    }
  }

  // ═══════════════════════════════════════
  //  NON-STREAMING FALLBACK
  // ═══════════════════════════════════════

  async chat(message: string): Promise<AIResponse> {
    if (!this.backendAvailable) {
      this.checkBackend();
      return { reply: '', action: null, isLocal: true };
    }

    try {
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(`${this.API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          history: this.conversationHistory,
          context: this.buildContext()
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) throw new Error('Server returned ' + response.status);

      const data = await response.json();

      this.conversationHistory.push({ role: 'user', content: message });
      this.conversationHistory.push({ role: 'assistant', content: data.reply || '' });
      this.trimHistory();

      return {
        reply:   data.reply || '',
        action:  data.action || null,
        tokens:  data.tokens,
        model:   data.model,
        error:   data.error,
        isLocal: false
      };
    } catch (err) {
      console.warn('🟣 Groq failed, using local brain:', err);
      this.markBackendUnreachable();
      return { reply: '', action: null, isLocal: true };
    }
  }

  // ═══════════════════════════════════════
  //  BUILD CONTEXT
  // ═══════════════════════════════════════

  private buildContext() {
    return {
      ownerName:    this.settings.get('ownerName'),
      facts:        this.memory.getAllFacts().slice(0, 15),
      mood:         this.memory.recallFact('mood') || 'neutral', // ✅ FIXED: was getMood()
      pendingTodos: this.todos.getPending().length
    };
  }

  // ═══════════════════════════════════════
  //  HISTORY HELPERS
  // ═══════════════════════════════════════

  private trimHistory(): void {
    if (this.conversationHistory.length > this.MAX_HISTORY * 2) {
      this.conversationHistory = this.conversationHistory.slice(-this.MAX_HISTORY * 2);
    }
  }

  clearHistory(): void {
    this.conversationHistory = [];
    console.log('🟣 Conversation history cleared');
  }

  async clearServerHistory(): Promise<void> {
    this.clearHistory();
  }

  // Cancel any active stream (e.g. when chat is cleared mid-response)
  cancelStream(): void {
    if (this.activeReader) {
      this.activeReader.cancel();
      this.activeReader = null;
    }
  }

  // ═══════════════════════════════════════
  //  STATUS
  // ═══════════════════════════════════════

  isGPTAvailable(): boolean {
    return this.backendAvailable;
  }

  private markBackendUnreachable(): void {
    this.backendAvailable = false;
    this.lastCheck        = 0;
  }
}