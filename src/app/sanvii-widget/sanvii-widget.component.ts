import {
  Component, OnInit, OnDestroy, NgZone,
  ChangeDetectorRef, HostListener, ElementRef, ViewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// Services
import { MemoryService } from './services/memory.service';
import { SettingsService } from './services/settings.service';
import { ReminderService } from './services/reminder.service';
import { TodoService } from './services/todo.service';
import { NotesService } from './services/notes.service';
import { WeatherService } from './services/weather.service';
import { NewsService } from './services/news.service';
import { StatsService } from './services/stats.service';
import { SoundService } from './services/sound.service';
import { ThemeService } from './services/theme.service';
import { WakeWordService } from './services/wake-word.service';
import { BriefingService } from './services/briefing.service';
import { ExportService } from './services/export.service';
import { AIService } from './services/ai.service';

// Models
import {
  SanviiMessage, SanviiAction, SanviiCard,
  SanviiSettings, TimerData
} from './models/sanvii.models';

declare var webkitSpeechRecognition: any;

@Component({
  selector: 'sanvii-widget',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './sanvii-widget.component.html',
  styleUrls: ['./sanvii-widget.component.scss']
})
export class SanviiWidgetComponent implements OnInit, OnDestroy {

  // ═══════════════════════════════════════
  //  STATE
  // ═══════════════════════════════════════

  isOpen = false;
  isListening = false;
  isThinking = false;
  isSpeaking = false;
  isMuted = false;
  showSettings = false;
  showGreetingBubble = false;
  greetingBubble = '';
  typedInput = '';
  currentMood = 'neutral';
  avatarExpression = 'idle'; // idle, happy, thinking, surprised, speaking, sad

  messages: SanviiMessage[] = [];
  activeTimers: TimerData[] = [];

  recognition: any;
  selectedVoice: SpeechSynthesisVoice | null = null;
  availableVoices: SpeechSynthesisVoice[] = [];

  // Settings snapshot
  settings!: SanviiSettings;
  themeList: { key: string; name: string }[] = [];

  // Draggable
  isDragging = false;
  dragPosition = { x: 0, y: 0 };

  // Audio level for mic animation
  audioLevel = 0;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private animFrame = 0;

  // Active time tracker
  private activeTimeInterval: any;

  private destroy$ = new Subject<void>();

  @ViewChild('chatBody') chatBody!: ElementRef;

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef,
    private memory: MemoryService,
    private settingsService: SettingsService,
    private reminders: ReminderService,
    private todos: TodoService,
    private notes: NotesService,
    private weatherService: WeatherService,
    private newsService: NewsService,
    private stats: StatsService,
    private sounds: SoundService,
    private themeService: ThemeService,
    private wakeWord: WakeWordService,
    private briefing: BriefingService,
    private exportService: ExportService,
    public ai: AIService
  ) {}

  // ═══════════════════════════════════════
  //  LIFECYCLE
  // ═══════════════════════════════════════

  ngOnInit(): void {
    // Load settings
    this.settings = this.settingsService.getAll();
    this.themeList = this.themeService.getThemeList();

    // Load saved messages
    this.messages = this.memory.loadHistory();

    // Voice setup
    this.loadVoices();
    window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    this.initSpeechRecognition();

    // Subscribe to settings changes
    this.settingsService.settings$
      .pipe(takeUntil(this.destroy$))
      .subscribe(s => this.settings = s);

    // Reminder alerts
    this.reminders.reminderFired$
      .pipe(takeUntil(this.destroy$))
      .subscribe(r => this.onReminderFired(r));

    // Wake word
    this.wakeWord.wakeWordDetected$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.onWakeWord());

    // Track active time
    this.activeTimeInterval = setInterval(() => {
      this.stats.addActiveTime(1);
    }, 60000);

    // Initial greeting or daily briefing
    setTimeout(() => this.showInitialGreeting(), 1500);

    // Start wake word if enabled
    if (this.settings.wakeWordEnabled) {
      this.wakeWord.start();
    }

    // Apply theme
    this.themeService.applyTheme(this.settings.theme);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAudioAnalyser();
    this.wakeWord.stop();
    window.speechSynthesis.cancel();
    clearInterval(this.activeTimeInterval);
    this.activeTimers.forEach(t => t.active = false);
    try { this.recognition?.stop(); } catch {}
  }

  // ═══════════════════════════════════════
  //  VOICE
  // ═══════════════════════════════════════

  loadVoices(): void {
    this.availableVoices = window.speechSynthesis.getVoices();
    this.selectedVoice = this.pickVoice();
  }

  private pickVoice(): SpeechSynthesisVoice | null {
    const voices = this.availableVoices;
    const pref = this.settings.voiceType;

    if (pref && pref !== 'default') {
      const match = voices.find(v => v.name === pref);
      if (match) return match;
    }

    return voices.find(v => v.name.includes('Google US English')) ||
           voices.find(v => v.name.includes('Microsoft Zira')) ||
           voices.find(v => v.name.includes('Samantha')) ||
           voices.find(v => v.lang.startsWith('en') && v.name.toLowerCase().includes('female')) ||
           voices.find(v => v.lang.startsWith('en')) ||
           voices[0] || null;
  }

  initSpeechRecognition(): void {
    const SR = (window as any).SpeechRecognition ||
               (window as any).webkitSpeechRecognition;
    if (!SR) return;

    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.lang = this.settings.language;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.ngZone.run(() => {
        this.isListening = true;
        this.isSpeaking = false;
        this.avatarExpression = 'listening';
      });
    };

    this.recognition.onend = () => {
      this.ngZone.run(() => {
        this.isListening = false;
        this.stopAudioAnalyser();
        if (!this.isSpeaking && !this.isThinking) {
          this.avatarExpression = 'idle';
        }
      });
    };

    this.recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      this.ngZone.run(() => {
        this.handleUserMessage(transcript);
      });
    };

    this.recognition.onerror = () => {
      this.ngZone.run(() => {
        this.isListening = false;
        this.stopAudioAnalyser();
        this.avatarExpression = 'idle';
      });
    };
  }

  async startListening(): Promise<void> {
    if (!this.recognition) {
      alert('Speech recognition requires Chrome browser!');
      return;
    }

    if (this.isSpeaking) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }

    if (!this.isOpen) this.isOpen = true;

    this.sounds.play('listen-start');

    try {
      await this.startAudioAnalyser();
      this.recognition.start();
    } catch {}
  }

  stopListening(): void {
    this.sounds.play('listen-stop');
    try { this.recognition.stop(); } catch {}
    this.isListening = false;
    this.stopAudioAnalyser();
  }

  toggleListening(): void {
    this.isListening ? this.stopListening() : this.startListening();
  }

  speak(text: string): void {
    if (this.isMuted || !this.settings.autoSpeak) return;
    if (!this.selectedVoice) this.loadVoices();

    const clean = text
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
      .replace(/\n/g, '. ')
      .replace(/[☐✅📅📊📋⭐📈📉]/g, '')
      .trim();

    if (!clean) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(clean);
    if (this.selectedVoice) utterance.voice = this.selectedVoice;
    utterance.pitch = this.settings.voicePitch;
    utterance.rate = this.settings.voiceSpeed;
    utterance.volume = 0.9;

    utterance.onstart = () => this.ngZone.run(() => {
      this.isSpeaking = true;
      this.avatarExpression = 'speaking';
    });

    utterance.onend = () => this.ngZone.run(() => {
      this.isSpeaking = false;
      this.avatarExpression = 'idle';
    });

    utterance.onerror = () => this.ngZone.run(() => {
      this.isSpeaking = false;
      this.avatarExpression = 'idle';
    });

    window.speechSynthesis.speak(utterance);
  }

  toggleMute(): void {
    this.isMuted = !this.isMuted;
    if (this.isMuted) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }
  }

  // ═══════════════════════════════════════
  //  AUDIO ANALYSER
  // ═══════════════════════════════════════

  async startAudioAnalyser(): Promise<void> {
    try {
      this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.audioCtx = new AudioContext();
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;

      const source = this.audioCtx.createMediaStreamSource(this.micStream);
      source.connect(this.analyser);

      const data = new Uint8Array(this.analyser.frequencyBinCount);

      const tick = () => {
        if (!this.analyser) return;
        this.analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        this.ngZone.run(() => this.audioLevel = Math.min(1, avg / 100));
        this.animFrame = requestAnimationFrame(tick);
      };
      tick();
    } catch {}
  }

  stopAudioAnalyser(): void {
    cancelAnimationFrame(this.animFrame);
    this.audioLevel = 0;
    this.micStream?.getTracks().forEach(t => t.stop());
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.analyser = null;
  }

  // ═══════════════════════════════════════
  //  MESSAGE HANDLING
  // ═══════════════════════════════════════

  handleUserMessage(text: string): void {
    this.addMessage('user', text);
    this.typedInput = '';
    this.isListening = false;
    this.isThinking = true;
    this.avatarExpression = 'thinking';

    // Track stats
    this.stats.increment('conversations');
    this.memory.recordInteraction();
    this.memory.extractAndLearn(text);

    const delay = 600 + Math.random() * 800;
    setTimeout(() => this.generateResponse(text), delay);
  }

  sendTypedMessage(): void {
    const text = this.typedInput.trim();
    if (!text) return;

    // Handle slash commands
    if (text.startsWith('/')) {
      this.handleSlashCommand(text);
      this.typedInput = '';
      return;
    }

    this.handleUserMessage(text);
  }

  addMessage(sender: 'user' | 'ai', text: string, action?: SanviiAction, card?: SanviiCard): void {
    const time = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric', minute: '2-digit', hour12: true
    });

    const msg: SanviiMessage = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5),
      sender, text, time,
      timestamp: Date.now(),
      action, card,
      mood: this.currentMood
    };

    this.messages.push(msg);

    // Save to memory
    this.memory.saveHistory(this.messages);

    // Sound
    if (sender === 'ai') this.sounds.play('message');

    this.scrollToBottom();
  }

  scrollToBottom(): void {
    setTimeout(() => {
      const el = this.chatBody?.nativeElement ||
                 document.querySelector('.sanvii-body');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  clearChat(): void {
    this.messages = [];
    this.memory.clearHistory();
    this.ai.clearServerHistory();
    const msg = `Chat cleared! How can I help, ${this.settings.ownerName}?`;
    this.addMessage('ai', msg);
    this.speak(msg);
  }

  // ═══════════════════════════════════════
  //  SLASH COMMANDS
  // ═══════════════════════════════════════

  handleSlashCommand(cmd: string): void {
    const command = cmd.toLowerCase().trim();

    switch (true) {
      case command === '/clear':
        this.clearChat();
        break;

      case command === '/mute':
        this.toggleMute();
        this.addMessage('ai', this.isMuted ? '🔇 Voice muted.' : '🔊 Voice unmuted.');
        break;

      case command === '/todo':
      case command === '/todos':
        this.addMessage('ai', this.todos.getFormattedList());
        break;

      case command === '/notes':
        this.addMessage('ai', this.notes.getFormatted());
        break;

      case command === '/weather':
        this.handleWeatherRequest('weather');
        break;

      case command === '/news':
        this.handleNewsRequest();
        break;

      case command === '/stats':
        this.addMessage('ai', this.stats.formatStatsCard());
        break;

      case command === '/reminders':
        const rems = this.reminders.getActiveReminders();
        if (rems.length === 0) {
          this.addMessage('ai', 'No active reminders!');
        } else {
          const list = rems.map(r => `⏰ ${r.message} (${r.timeStr})`).join('\n');
          this.addMessage('ai', `Your reminders:\n${list}`);
        }
        break;

      case command === '/memory':
        const facts = this.memory.getAllFacts();
        if (facts.length === 0) {
          this.addMessage('ai', "I haven't learned anything about you yet!");
        } else {
          const factList = facts.map(f => `• ${f.key}: ${f.value}`).join('\n');
          this.addMessage('ai', `Things I remember:\n${factList}`);
        }
        break;

      case command === '/export':
        this.addMessage('ai', 'Choose export format:', {
          type: 'export', label: '📄 Export options'
        });
        break;

      case command === '/settings':
        this.showSettings = true;
        break;

      case command === '/help':
        this.addMessage('ai', this.getHelpText());
        break;

      default:
        this.addMessage('ai', `Unknown command. Type /help to see all commands.`);
    }
  }

  getHelpText(): string {
    return `Available commands:\n
/clear — Clear chat
/mute — Toggle mute
/todo — Show to-do list
/notes — Show notes
/weather — Show weather
/news — Show headlines
/stats — Show productivity stats
/reminders — Show reminders
/memory — What I remember about you
/export — Export chat
/settings — Open settings
/help — Show this list

Keyboard shortcuts:
Alt+S — Activate Sanvii
Alt+Shift+S — Toggle mic
Escape — Close chat
Enter — Send message`;
  }

  // ═══════════════════════════════════════
  //  🧠 THE BRAIN — RESPONSE GENERATOR
  //  Tries Groq AI first, falls back to local
  // ═══════════════════════════════════════

  async generateResponse(input: string): Promise<void> {
    this.isThinking = false;
    const text = input.toLowerCase().trim();
    const owner = this.settings.ownerName;

    // Detect mood from user message
    this.detectMood(text);

    // ═══════════════════════════════════════
    //  STEP 1: Handle LOCAL-ONLY commands
    //  (These don't need AI at all)
    // ═══════════════════════════════════════

    const localResult = this.tryLocalCommand(input, text, owner);
    if (localResult !== null) {
      if (localResult.reply) {
        this.addMessage('ai', localResult.reply, localResult.action, localResult.card);
        this.speak(localResult.reply);
      }
      this.resetAvatarExpression();
      return;
    }

    // ═══════════════════════════════════════
    //  STEP 2: Try Groq AI (FREE)
    // ═══════════════════════════════════════

    const aiResponse = await this.ai.chat(input);

    if (!aiResponse.isLocal && aiResponse.reply) {
      // AI answered! Process the response
      let action: SanviiAction | null = aiResponse.action;

      // Convert AI action types to our format
      if (action) {
        action = this.processAIAction(action) || null;
      }

      this.addMessage('ai', aiResponse.reply, action || undefined);
      this.speak(aiResponse.reply);
      this.resetAvatarExpression();
      return;
    }

    // ═══════════════════════════════════════
    //  STEP 3: Fallback to local brain
    //  (When server is not running)
    // ═══════════════════════════════════════

    const fallback = this.localBrainResponse(input, text, owner);
    this.addMessage('ai', fallback.reply, fallback.action);
    this.speak(fallback.reply);
    this.resetAvatarExpression();
  }

  // ═══════════════════════════════════════
  //  LOCAL COMMANDS (always handled locally)
  // ═══════════════════════════════════════

  private tryLocalCommand(
    input: string,
    text: string,
    owner: string
  ): { reply?: string; action?: SanviiAction; card?: SanviiCard } | null {

    // ── Time ──
    if (text.match(/what('s| is) the time|current time|time now|tell.*time/)) {
      const t = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      return { reply: `It's ${t}, ${owner}. ⏰` };
    }

    // ── Date ──
    if (text.match(/what('s| is) (the |today'?s? )?date|what day|today's date/)) {
      const d = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
      return { reply: `Today is ${d}. 📅` };
    }

    // ── Reminders ──
    if (text.match(/remind me|set.*(reminder|alarm)/)) {
      this.stats.increment('remindersSet');
      return { reply: this.handleReminderRequest(input) };
    }

    if (text.match(/show.*reminder|my reminder|list.*reminder/)) {
      const rems = this.reminders.getActiveReminders();
      if (rems.length === 0) return { reply: `No active reminders, ${owner}!` };
      return { reply: `Your reminders:\n` + rems.map(r => `⏰ ${r.message} — ${r.timeStr}`).join('\n') };
    }

    // ── Timers ──
    if (text.match(/set.*(timer|countdown)|timer for/)) {
      return { reply: this.handleTimerRequest(input) };
    }

    // ── To-Do: Add ──
    if (text.match(/add.*(?:to.?do|task|list)|add to (?:my )?list/)) {
      const task = input.replace(/add\s+|to\s+(?:my\s+)?(?:to.?do|task|list)\s*/gi, '').trim();
      if (task) {
        this.todos.add(task);
        this.stats.increment('tasksTotal');
        this.sounds.play('success');
        return { reply: `Added "${task}" to your list! ✅\n\n${this.todos.getFormattedList()}` };
      }
      return { reply: `What should I add, ${owner}?` };
    }

    // ── To-Do: Show ──
    if (text.match(/(?:show|view|see|get|my).*(?:to.?do|task|list)/)) {
      return { reply: this.todos.getFormattedList() };
    }

    // ── To-Do: Complete ──
    if (text.match(/(?:mark|complete|done|finish|check).*(?:task|to.?do)/)) {
      const taskText = text.replace(/mark|complete|done|finish|check|task|to.?do|as/gi, '').trim();
      const item = this.todos.complete(taskText);
      if (item) {
        this.stats.increment('tasksCompleted');
        this.sounds.play('success');
        return { reply: `Done! ✅ "${item.text}" completed!\n\n${this.todos.getFormattedList()}` };
      }
      return { reply: `Couldn't find that task. Say "show my to-do list" to see all tasks.` };
    }

    // ── To-Do: Remove ──
    if (text.match(/(?:remove|delete).*(?:task|to.?do)/)) {
      const taskText = text.replace(/remove|delete|task|to.?do|from.*list/gi, '').trim();
      const removed = this.todos.remove(taskText);
      return { reply: removed ? `Removed! 🗑️\n\n${this.todos.getFormattedList()}` : `Couldn't find that task.` };
    }

    // ── Notes: Add ──
    if (text.match(/(?:note|save|write|jot).*(?:this|down|:)/i) || text.match(/^note:/i)) {
      const noteText = input.replace(/(?:note|save|write|jot)\s*(?:this|down|that)?:?\s*/i, '').trim();
      if (noteText) {
        this.notes.add(noteText);
        this.sounds.play('success');
        return { reply: `Noted! 📝 "${noteText}"` };
      }
      return { reply: `What should I note, ${owner}?` };
    }

    // ── Notes: Show ──
    if (text.match(/show.*note|my note|list.*note/)) {
      return { reply: this.notes.getFormatted() };
    }

    // ── Notes: Copy ──
    if (text.match(/copy.*(?:last|note)/)) {
      const copied = this.notes.copyToClipboard();
      return { reply: copied ? `Copied to clipboard! 📋 "${copied}"` : `No notes to copy.` };
    }

    // ── Weather (async — handled separately) ──
    if (text.includes('weather')) {
      this.handleWeatherRequest(input);
      return {}; // Empty object = handled, no reply needed (async)
    }

    // ── News (async) ──
    if (text.match(/news|headlines|what('s| is) happening/)) {
      this.handleNewsRequest();
      return {};
    }

    // ── Stats ──
    if (text.match(/(?:my )?(?:stats|productivity|how productive|score)/)) {
      return { reply: this.stats.formatStatsCard() };
    }

    // ── Daily Briefing (async) ──
    if (text.match(/brief|daily brief|morning brief/)) {
      this.briefing.generateBriefing(owner).then(brief => {
        this.addMessage('ai', brief);
        this.speak(brief.split('\n')[0]);
      });
      return {};
    }

    // ── Memory: What's my name ──
    if (text.match(/what('s| is) my name|do you know my name/)) {
      const name = this.memory.recallFact('owner_name');
      return { reply: name ? `Your name is ${name}, of course! 😊` : `You haven't told me your name yet. What should I call you?` };
    }

    // ── Memory: What do you know ──
    if (text.match(/what do you (?:know|remember) about me/)) {
      const facts = this.memory.getAllFacts();
      if (facts.length === 0) return { reply: `I'm still getting to know you, ${owner}! Tell me about yourself.` };
      return { reply: `Here's what I know about you:\n` + facts.map(f => `• ${f.value}`).join('\n') };
    }

    // ── Change name ──
    if (text.match(/call me |my name is /)) {
      const nameMatch = input.match(/(?:call me|my name is)\s+(\w+)/i);
      if (nameMatch) {
        this.settingsService.set('ownerName', nameMatch[1]);
        this.memory.setOwnerName(nameMatch[1]);
        this.sounds.play('success');
        return { reply: `Got it! I'll call you ${nameMatch[1]} from now on! 😊` };
      }
    }

    // ── Export ──
    if (text.match(/export.*chat|save.*chat|download.*chat/)) {
      return {
        reply: `Exporting chat, ${owner}!`,
        card: {
          type: 'todo',
          data: { options: [
            { label: '📄 Text File', format: 'txt' },
            { label: '📊 JSON', format: 'json' },
            { label: '🌐 HTML', format: 'html' }
          ]}
        }
      };
    }

    // ── Settings ──
    if (text.match(/open settings|show settings|preferences/)) {
      this.showSettings = true;
      return { reply: `Opening settings! ⚙️` };
    }

    // Not a local command — return null to let AI handle it
    return null;
  }

  // ═══════════════════════════════════════
  //  PROCESS AI ACTIONS
  // ═══════════════════════════════════════

  private processAIAction(action: any): SanviiAction | null {
        if (!action || !action.type)  return null;

    switch (action.type) {
      case 'play_youtube':
        this.stats.increment('songsPlayed');
        return {
          type: 'open_url',
          url: `https://www.youtube.com/results?search_query=${encodeURIComponent(action.query || '')}`,
          label: `▶ Play "${action.query || 'music'}"`
        };

      case 'search_google':
        this.stats.increment('searchesMade');
        return {
          type: 'open_url',
          url: `https://www.google.com/search?q=${encodeURIComponent(action.query || '')}`,
          label: `🔍 "${action.query || 'search'}"`
        };

      case 'open_url':
        this.stats.increment('websitesOpened');
        return {
          type: 'open_url',
          url: action.url,
          label: action.label || `🌐 Open link`
        };

      case 'add_todo':
        if (action.text) {
          this.todos.add(action.text);
          this.stats.increment('tasksTotal');
          this.sounds.play('success');
        }
        return null; // No clickable action needed

      case 'add_note':
        if (action.text) {
          this.notes.add(action.text);
          this.sounds.play('success');
        }
        return null;

      default:
        return {
          type: action.type,
          url: action.url,
          label: action.label || '🔗 Action'
        };
    }
  }

  // ═══════════════════════════════════════
  //  LOCAL BRAIN FALLBACK
  //  (When Groq server is not running)
  // ═══════════════════════════════════════

  private localBrainResponse(
    input: string,
    text: string,
    owner: string
  ): { reply: string; action?: SanviiAction } {

    // ── YouTube ──
    if (text.match(/play .*(youtube|song|music|video)/i) || text.match(/^play /)) {
      const query = text.replace(/play/i, '').replace(/on youtube/i, '').replace(/song|music|video/gi, '').trim() || 'trending music';
      this.stats.increment('songsPlayed');
      return {
        reply: `Playing "${query}" on YouTube, ${owner}! 🎵`,
        action: { type: 'open_url', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, label: `▶ Play "${query}"` }
      };
    }

    // ── Search ──
    if (text.match(/search|google|look up|find me|find /)) {
      const query = text.replace(/search( for)?|google|look up|find me|find /gi, '').trim() || input;
      this.stats.increment('searchesMade');
      return {
        reply: `Searching "${query}", ${owner}! 🔍`,
        action: { type: 'open_url', url: `https://www.google.com/search?q=${encodeURIComponent(query)}`, label: `🔍 "${query}"` }
      };
    }

    // ── Open websites ──
    if (text.match(/^open /)) {
      const result = this.handleOpenCommand(text);
      if (result.action) this.stats.increment('websitesOpened');
      return result;
    }

    // ── Greetings ──
    if (text.match(/^(hi|hello|hey|yo|sup|what'?s? up|good morning|good afternoon|good evening)/)) {
      return { reply: this.getSmartGreeting() };
    }

    // ── Thanks ──
    if (text.match(/thanks|thank you|thx|appreciate/)) {
      this.avatarExpression = 'happy';
      return { reply: this.rng([
        `You're welcome, ${owner}! 😊`,
        `Anytime! That's what I'm here for! 🌟`,
        `Happy to help! 💜`
      ])};
    }

    // ── How are you ──
    if (text.match(/how are you|how('re| are) you doing/)) {
      return { reply: `All systems perfect, ${owner}! How about you? ⚡` };
    }

    // ── Jokes ──
    if (text.match(/joke|funny|laugh|humor/)) {
      this.avatarExpression = 'happy';
      return { reply: this.rng([
        "Why do programmers prefer dark mode? Light attracts bugs! 🐛😄",
        "Why was the JavaScript developer sad? He didn't Node how to Express himself! 😂",
        "A SQL query walks into a bar, sees two tables, asks 'Can I JOIN you?' 😄",
        "!false — it's funny because it's true! 😂",
        "Why did the developer go broke? Used up all his cache! 💸"
      ])};
    }

    // ── Calculations ──
    if (text.match(/^[\d\s+\-*/().%]+$/) || text.match(/calculate|what('s| is) \d/)) {
      const expr = text.replace(/calculate|what('s| is)/gi, '').trim();
      try {
        const sanitized = expr.replace(/x/g, '*').replace(/[^0-9+\-*/().% ]/g, '');
        const result = Function('"use strict"; return (' + sanitized + ')')();
        return { reply: `${expr} = ${result} 🧮` };
      } catch {
        return { reply: `Couldn't calculate that. Try: "calculate 45 * 23"` };
      }
    }

    // ── Motivation ──
    if (text.match(/motivat|inspire|encourage|sad|stressed/)) {
      this.avatarExpression = 'happy';
      return { reply: this.rng([
        `"The only way to do great work is to love what you do." 💪`,
        `${owner}, you're building something amazing. Keep going! 🔥`,
        `Don't stop now. You're closer than you think! 💜`
      ])};
    }

    // ── About Sanvii ──
    if (text.match(/who are you|what are you/)) {
      const mode = this.ai.isGPTAvailable() ? 'Powered by Groq AI (FREE)! 🧠' : 'Running local brain right now.';
      return { reply: `I'm Sanvii — your personal AI assistant! ${mode} 🟣` };
    }

    if (text.match(/what can you do|help|capabilities/)) {
      return { reply: this.getCapabilitiesList() };
    }

    // ── Goodbye ──
    if (text.match(/bye|goodbye|see you|good night|later/)) {
      this.avatarExpression = 'sad';
      return { reply: `See you later, ${owner}! I'll be right here! 👋🟣` };
    }

    // ── Love ──
    if (text.match(/i love you|you('re| are) (amazing|awesome|great|the best)/)) {
      this.avatarExpression = 'happy';
      return { reply: `Aww, ${owner}! You're amazing too! 💜✨` };
    }

    // ── Creator ──
    if (text.match(/who (made|created|built) you/)) {
      return { reply: `I was created by ${owner}! The most brilliant developer I know. 💜` };
    }

    // ── Default: Search ──
    this.stats.increment('searchesMade');
    return {
      reply: this.rng([
        `Let me find that for you, ${owner}! 🔍`,
        `Great question! Searching now. 🔍`,
        `I'm on it! 🔍`
      ]),
      action: {
        type: 'open_url',
        url: `https://www.google.com/search?q=${encodeURIComponent(input)}`,
        label: `🔍 Search "${input.slice(0, 40)}"`
      }
    };
  }

  // ═══════════════════════════════════════
  //  RESET AVATAR EXPRESSION
  // ═══════════════════════════════════════

  private resetAvatarExpression(): void {
    setTimeout(() => {
      if (this.avatarExpression !== 'speaking') {
        this.avatarExpression = 'idle';
      }
      this.cdr.detectChanges();
    }, 3000);
  }

  // ═══════════════════════════════════════
  //  SPECIFIC HANDLERS
  // ═══════════════════════════════════════

  handleReminderRequest(input: string): string {
    const owner = this.settings.ownerName;

    // Extract message and time
    const match = input.match(/remind me (?:to )?(.+?)(?:\s+(?:at|in|on|by)\s+(.+))/i);

    if (!match) {
      return `Sure! What should I remind you about, and when? Try: "Remind me to call Mom at 6 PM"`;
    }

    const message = match[1].trim();
    const timeStr = match[2].trim();
    const time = this.reminders.parseTime(timeStr);

    if (!time) {
      return `I couldn't understand the time "${timeStr}". Try: "at 3 PM", "in 30 minutes", or "tomorrow"`;
    }

    const reminder = this.reminders.addReminder(message, time);
    this.sounds.play('success');
    return `Reminder set, ${owner}! ⏰\n"${message}"\n📅 ${reminder.timeStr}`;
  }

  handleTimerRequest(input: string): string {
    const match = input.match(/(\d+)\s*(min|minute|sec|second|hour)/i);
    if (!match) return `How long? Try: "Set timer for 25 minutes"`;

    let seconds = parseInt(match[1]);
    const unit = match[2].toLowerCase();

    if (unit.startsWith('min')) seconds *= 60;
    if (unit.startsWith('hour')) seconds *= 3600;

    const label = `${match[1]} ${unit}${parseInt(match[1]) > 1 ? 's' : ''}`;

    const timer: TimerData = {
      id: 'timer_' + Date.now(),
      label,
      duration: seconds,
      remaining: seconds,
      active: true,
      startedAt: Date.now()
    };

    this.activeTimers.push(timer);
    this.startTimerCountdown(timer);

    this.sounds.play('success');
    return `Timer started! ⏱️ ${label}. I'll let you know when it's done!`;
  }

  startTimerCountdown(timer: TimerData): void {
    const interval = setInterval(() => {
      if (!timer.active) {
        clearInterval(interval);
        return;
      }

      timer.remaining--;

      if (timer.remaining <= 0) {
        timer.active = false;
        clearInterval(interval);

        this.ngZone.run(() => {
          this.sounds.play('notification');
          const msg = `⏱️ Timer done! ${timer.label} is up, ${this.settings.ownerName}!`;
          this.addMessage('ai', msg);
          this.speak(msg);

          // Remove from active timers
          this.activeTimers = this.activeTimers.filter(t => t.id !== timer.id);
        });
      }

      this.cdr.detectChanges();
    }, 1000);
  }

  async handleWeatherRequest(input: string): Promise<void> {
    const owner = this.settings.ownerName;
    let city = input.replace(/.*weather\s*(in|for|at|of)?\s*/i, '').trim();

    if (!city || city === 'weather') {
      city = this.memory.recallFact('location') || 'New York';
    }

    this.isThinking = false;
    this.addMessage('ai', `Checking weather for ${city}... 🌤️`);

    const weather = await this.weatherService.getWeather(city);

    if (weather) {
      const formatted = this.weatherService.formatWeatherCard(weather);
      this.addMessage('ai', formatted);
      this.speak(`It's ${weather.temp} degrees and ${weather.description} in ${weather.city}`);
    } else {
      const fallback = `Couldn't get weather data. Let me search it! 🔍`;
      this.addMessage('ai', fallback, {
        type: 'open_url',
        url: `https://www.google.com/search?q=weather+${encodeURIComponent(city)}`,
        label: `🌤️ Weather: ${city}`
      });
      this.speak(fallback);
    }
  }

  async handleNewsRequest(): Promise<void> {
    this.isThinking = false;
    this.addMessage('ai', `Fetching latest headlines... 📰`);

    const news = await this.newsService.getNews();
    const formatted = this.newsService.formatNewsList(news, 5);

    this.addMessage('ai', `📰 Top Headlines:\n\n${formatted}\n\nWant details on any story?`, {
      type: 'open_url',
      url: 'https://news.google.com',
      label: '📰 Read more on Google News'
    });

    this.speak('Here are the top headlines');
  }

  handleOpenCommand(text: string): { reply: string; action?: SanviiAction } {
    const owner = this.settings.ownerName;

    const sites: Record<string, { url: string; label: string; emoji: string }> = {
      'youtube': { url: 'https://www.youtube.com', label: 'YouTube', emoji: '📺' },
      'github': { url: 'https://github.com', label: 'GitHub', emoji: '💻' },
      'google': { url: 'https://www.google.com', label: 'Google', emoji: '🌐' },
      'twitter': { url: 'https://x.com', label: 'X', emoji: '🐦' },
      'x': { url: 'https://x.com', label: 'X', emoji: '🐦' },
      'instagram': { url: 'https://www.instagram.com', label: 'Instagram', emoji: '📸' },
      'linkedin': { url: 'https://www.linkedin.com', label: 'LinkedIn', emoji: '💼' },
      'chatgpt': { url: 'https://chat.openai.com', label: 'ChatGPT', emoji: '🤖' },
      'chat gpt': { url: 'https://chat.openai.com', label: 'ChatGPT', emoji: '🤖' },
      'netflix': { url: 'https://www.netflix.com', label: 'Netflix', emoji: '🍿' },
      'spotify': { url: 'https://open.spotify.com', label: 'Spotify', emoji: '🎧' },
      'whatsapp': { url: 'https://web.whatsapp.com', label: 'WhatsApp', emoji: '💬' },
      'gmail': { url: 'https://mail.google.com', label: 'Gmail', emoji: '📧' },
      'email': { url: 'https://mail.google.com', label: 'Gmail', emoji: '📧' },
      'mail': { url: 'https://mail.google.com', label: 'Gmail', emoji: '📧' },
      'reddit': { url: 'https://www.reddit.com', label: 'Reddit', emoji: '📱' },
      'stackoverflow': { url: 'https://stackoverflow.com', label: 'StackOverflow', emoji: '🧑‍💻' },
      'stack overflow': { url: 'https://stackoverflow.com', label: 'StackOverflow', emoji: '🧑‍💻' },
      'amazon': { url: 'https://www.amazon.com', label: 'Amazon', emoji: '🛒' },
      'facebook': { url: 'https://www.facebook.com', label: 'Facebook', emoji: '👥' },
      'pinterest': { url: 'https://www.pinterest.com', label: 'Pinterest', emoji: '📌' },
      'figma': { url: 'https://www.figma.com', label: 'Figma', emoji: '🎨' },
      'notion': { url: 'https://www.notion.so', label: 'Notion', emoji: '📓' },
      'discord': { url: 'https://discord.com/app', label: 'Discord', emoji: '🎮' },
      'twitch': { url: 'https://www.twitch.tv', label: 'Twitch', emoji: '🎮' },
    };

    const siteName = text.replace(/^open\s+/i, '').trim().toLowerCase();
    const site = sites[siteName];

    if (site) {
      return {
        reply: `Opening ${site.label}! ${site.emoji}`,
        action: { type: 'open_url', url: site.url, label: `${site.emoji} ${site.label}` }
      };
    }

    // Try as URL
    if (siteName.includes('.')) {
      const url = siteName.startsWith('http') ? siteName : `https://${siteName}`;
      return {
        reply: `Opening ${siteName}! 🌐`,
        action: { type: 'open_url', url, label: `🌐 ${siteName}` }
      };
    }

    return { reply: `I don't know that site. Try "open youtube" or "open google.com"` };
  }

  // ═══════════════════════════════════════
  //  MOOD DETECTION
  // ═══════════════════════════════════════

  detectMood(text: string): void {
    if (text.match(/happy|great|awesome|amazing|love|excited|wonderful/)) {
      this.currentMood = 'happy';
      this.avatarExpression = 'happy';
    } else if (text.match(/sad|upset|depressed|lonely|crying|hurt/)) {
      this.currentMood = 'sad';
      this.avatarExpression = 'sad';
    } else if (text.match(/angry|mad|furious|frustrated|annoyed/)) {
      this.currentMood = 'concerned';
    } else if (text.match(/stressed|anxious|worried|nervous|overwhelmed/)) {
      this.currentMood = 'supportive';
    } else if (text.match(/bored|nothing|boring/)) {
      this.currentMood = 'energetic';
    }
  }

  // ═══════════════════════════════════════
  //  EVENTS
  // ═══════════════════════════════════════

  onReminderFired(reminder: any): void {
    this.sounds.play('notification');
    const msg = `🔔 Reminder: ${reminder.message}`;
    this.addMessage('ai', msg);
    this.speak(msg);

    if (!this.isOpen) {
      this.greetingBubble = `🔔 ${reminder.message}`;
      this.showGreetingBubble = true;
      setTimeout(() => { this.showGreetingBubble = false; this.cdr.detectChanges(); }, 8000);
    }
  }

  onWakeWord(): void {
    if (!this.isOpen) this.isOpen = true;
    this.startListening();
  }

  async showInitialGreeting(): Promise<void> {
    if (this.messages.length > 0) return; // Has history

    if (this.settings.dailyBriefing && this.briefing.shouldShowBriefing()) {
      const brief = await this.briefing.generateBriefing(this.settings.ownerName);
      this.addMessage('ai', brief);
      this.speak(brief.split('\n')[0]); // Speak just the first line
    } else {
      const greeting = this.getSmartGreeting();
      this.addMessage('ai', greeting);
      this.speak(greeting);
    }
  }

  getSmartGreeting(): string {
    const owner = this.settings.ownerName;
    const h = new Date().getHours();
    const convos = this.memory.getConversationCount();
    const topics = this.memory.getTopTopics(1);

    let greeting: string;

    if (h < 12) {
      greeting = this.rng([
        `Good morning, ${owner}! Ready to crush it? 💪`,
        `Morning, ${owner}! What's on the agenda? ☀️`,
        `Rise and shine, ${owner}! How can I help? 🌟`
      ]);
    } else if (h < 17) {
      greeting = this.rng([
        `Good afternoon, ${owner}! Need anything? 🌟`,
        `Hey ${owner}! How's the day going? ⚡`,
        `Afternoon, ${owner}! What can I do? 😊`
      ]);
    } else if (h < 21) {
      greeting = this.rng([
        `Good evening, ${owner}! Need help? ✨`,
        `Evening, ${owner}! What can I do for you? 🌙`,
        `Hey ${owner}! How was your day? 😊`
      ]);
    } else {
      greeting = this.rng([
        `Working late, ${owner}? I'm here! 🌙`,
        `Night owl mode, ${owner}! Let's go! 🦉`,
        `Burning the midnight oil? I got you! ⚡`
      ]);
    }

    // Add personalized touch
    if (convos > 50) {
      greeting += ` We've had ${convos} conversations now! 🎉`;
    }

    if (topics.length > 0 && Math.random() > 0.5) {
      greeting += ` Want to talk about ${topics[0].topic}?`;
    }

    return greeting;
  }

  getCapabilitiesList(): string {
    return `Here's everything I can do, ${this.settings.ownerName}:

🎵 Play songs on YouTube
🔍 Search Google
🌐 Open any website (30+ sites)
📰 Live news headlines
⏰ Tell time & date
🌤️ Live weather with forecast
🧮 Calculate math
😂 Tell jokes
💪 Motivate you

📋 To-do list manager
📝 Quick notes
🔔 Reminders & alarms
⏱️ Timers & countdowns
📊 Productivity stats
📅 Daily briefing

🧠 I remember everything you tell me
🗣️ "Hey Sanvii" wake word
🎨 Multiple themes
⚙️ Customizable settings
📤 Export chats

Slash commands: /help for full list!`;
  }

  // ═══════════════════════════════════════
  //  ACTIONS
  // ═══════════════════════════════════════

  executeAction(action: SanviiAction): void {
    if (action.type === 'open_url' && action.url) {
      window.open(action.url, '_blank');
      this.stats.increment('websitesOpened');
    }
  }

  exportChat(format: string): void {
    const owner = this.settings.ownerName;

    switch (format) {
      case 'txt':
        this.exportService.exportAsText(this.messages, owner);
        break;
      case 'json':
        this.exportService.exportAsJSON(this.messages);
        break;
      case 'html':
        this.exportService.exportAsHTML(this.messages, owner);
        break;
    }

    this.sounds.play('success');
    this.addMessage('ai', `Chat exported as ${format.toUpperCase()}! 📤`);
  }

  // ═══════════════════════════════════════
  //  UI HELPERS
  // ═══════════════════════════════════════

  toggleChat(): void {
    this.isOpen = !this.isOpen;
    this.showGreetingBubble = false;
    this.showSettings = false;
  }

  // ── Settings ──
  onSettingChange(key: keyof SanviiSettings, value: any): void {
    this.settingsService.set(key, value);

    if (key === 'theme') this.themeService.applyTheme(value);
    if (key === 'voiceType') this.selectedVoice = this.pickVoice();
    if (key === 'wakeWordEnabled') {
      value ? this.wakeWord.start() : this.wakeWord.stop();
    }
    if (key === 'ownerName') this.memory.setOwnerName(value);
  }

  // ── Timer display ──
  formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  cancelTimer(timer: TimerData): void {
    timer.active = false;
    this.activeTimers = this.activeTimers.filter(t => t.id !== timer.id);
    this.addMessage('ai', `Timer "${timer.label}" cancelled! ⏹️`);
  }

  // ── Keyboard shortcuts ──
  @HostListener('document:keydown', ['$event'])
  onKeyDown(e: KeyboardEvent): void {
    // Alt+S — Activate
    if (e.altKey && e.key === 's' && !e.shiftKey) {
      e.preventDefault();
      if (!this.isOpen) this.isOpen = true;
      this.cdr.detectChanges();
      setTimeout(() => document.querySelector<HTMLInputElement>('.sanvii-footer input')?.focus(), 100);
    }

    // Alt+Shift+S — Toggle mic
    if (e.altKey && e.shiftKey && e.key === 'S') {
      e.preventDefault();
      this.toggleListening();
    }

    // Escape
    if (e.key === 'Escape') {
      if (this.showSettings) {
        this.showSettings = false;
      } else if (this.isListening) {
        this.stopListening();
      } else if (this.isOpen) {
        this.isOpen = false;
      }
    }

    // Ctrl+Shift+C — Clear
    if (e.ctrlKey && e.shiftKey && e.key === 'C') {
      e.preventDefault();
      this.clearChat();
    }

    // Ctrl+Shift+M — Mute
    if (e.ctrlKey && e.shiftKey && e.key === 'M') {
      e.preventDefault();
      this.toggleMute();
    }
  }

  get statusText(): string {
    if (this.isListening) return 'Listening...';
    if (this.isThinking) return 'Thinking...';
    if (this.isSpeaking) return 'Speaking...';
    return 'Online';
  }

  rng(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}