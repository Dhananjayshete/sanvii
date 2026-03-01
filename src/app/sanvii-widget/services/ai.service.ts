import { Injectable } from '@angular/core';
import { SanviiAction } from '../models/sanvii.models';
import { MemoryService } from './memory.service';
import { TodoService } from './todo.service';
import { SettingsService } from './settings.service';

// ═══════════════════════════════════════════════
//  AI SERVICE
//  Connects to Groq backend (FREE)
//  Falls back to local brain if server is down
// ═══════════════════════════════════════════════

export interface AIResponse {
  reply: string;
  action: SanviiAction | null;
  tokens?: any;
  model?: string;
  error?: string;
  isLocal: boolean;
}

@Injectable({ providedIn: 'root' })
export class AIService {

  private readonly API_URL = 'http://localhost:3847/api';
  private backendAvailable = false;
  private lastCheck = 0;
  private checking = false;

  constructor(
    private memory: MemoryService,
    private todos: TodoService,
    private settings: SettingsService
  ) {
    // Check backend on startup
    this.checkBackend();
  }

  // ═══════════════════════════════════════
  //  CHECK IF BACKEND SERVER IS RUNNING
  // ═══════════════════════════════════════

  async checkBackend(): Promise<boolean> {
    // Don't check more than once every 30 seconds
    if (Date.now() - this.lastCheck < 30000 && this.lastCheck > 0) {
      return this.backendAvailable;
    }

    // Don't run multiple checks at once
    if (this.checking) return this.backendAvailable;
    this.checking = true;
    this.lastCheck = Date.now();

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${this.API_URL}/health`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        this.backendAvailable = !!data.hasApiKey;

        if (this.backendAvailable) {
          console.log('🟣 Sanvii AI: ✅ Connected to Groq (FREE)');
          console.log('🟣 Model:', data.model || 'Llama 3.3 70B');
        } else {
          console.log('🟣 Sanvii AI: ⚠️ Server running but no API key');
        }
      } else {
        this.backendAvailable = false;
      }
    } catch {
      this.backendAvailable = false;
      console.log('🟣 Sanvii AI: 💡 Using local brain (server not running)');
    }

    this.checking = false;
    return this.backendAvailable;
  }

  // ═══════════════════════════════════════
  //  MAIN CHAT METHOD
  //  Called by the component
  // ═══════════════════════════════════════

  async chat(message: string): Promise<AIResponse> {
    // Try Groq first
    if (this.backendAvailable) {
      try {
        return await this.chatWithGroq(message);
      } catch (err) {
        console.warn('🟣 Groq failed, using local brain:', err);
        // Mark as unavailable temporarily
        this.backendAvailable = false;
        this.lastCheck = 0; // Force recheck next time
      }
    }

    // Recheck backend in background
    this.checkBackend();

    // Return empty — component will use local brain
    return {
      reply: '',
      action: null,
      isLocal: true
    };
  }

  // ═══════════════════════════════════════
  //  GROQ API CALL
  // ═══════════════════════════════════════

  private async chatWithGroq(message: string): Promise<AIResponse> {
    // Build context from local memory
    const allFacts = this.memory.getAllFacts();
    const allTodos = this.todos.getAll();
    const pendingCount = this.todos.getPending().length;

    const context = {
      ownerName: this.settings.get('ownerName'),
      facts: allFacts.slice(0, 15),
      mood: this.memory.getMood(),
      pendingTodos: pendingCount
    };

    // Make the API call
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

    const response = await fetch(`${this.API_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: message,
        context: context
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Server returned ' + response.status);
    }

    const data = await response.json();

    return {
      reply: data.reply || '',
      action: data.action || null,
      tokens: data.tokens,
      model: data.model,
      error: data.error,
      isLocal: false
    };
  }

  // ═══════════════════════════════════════
  //  CLEAR SERVER CONVERSATION HISTORY
  // ═══════════════════════════════════════

  async clearServerHistory(): Promise<void> {
    if (!this.backendAvailable) return;

    try {
      await fetch(`${this.API_URL}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      console.log('🟣 Server history cleared');
    } catch {
      // Silent fail — not critical
    }
  }

  // ═══════════════════════════════════════
  //  STATUS CHECK
  // ═══════════════════════════════════════

  isGPTAvailable(): boolean {
    return this.backendAvailable;
  }
}