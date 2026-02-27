import {
  Component,
  OnInit,
  OnDestroy,
  NgZone,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

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

  messages: {
    sender: 'user' | 'ai';
    text: string;
    time: string;
    action?: { type: string; url?: string; label?: string };
  }[] = [];

  typedInput = '';
  recognition: any;
  selectedVoice: SpeechSynthesisVoice | null = null;

  ownerName = 'Boss';

  constructor(
    private ngZone: NgZone,
    private cdr: ChangeDetectorRef
  ) {}

  // ═══════════════════════════════════════
  //  LIFECYCLE
  // ═══════════════════════════════════════

  ngOnInit(): void {
    this.loadVoices();
    window.speechSynthesis.onvoiceschanged = () => this.loadVoices();
    this.initSpeechRecognition();

    // Greeting after 1.5 seconds
    setTimeout(() => {
      const greeting = this.getTimeGreeting();
      this.addMessage('ai', greeting);
    }, 1500);
  }

  ngOnDestroy(): void {
    window.speechSynthesis.cancel();
    try { this.recognition?.stop(); } catch {}
  }

  // ═══════════════════════════════════════
  //  VOICE SELECTION
  // ═══════════════════════════════════════

  loadVoices(): void {
    const voices = window.speechSynthesis.getVoices();
    this.selectedVoice =
      voices.find(v => v.name.includes('Google US English')) ||
      voices.find(v => v.name.includes('Microsoft Zira')) ||
      voices.find(v => v.name.includes('Samantha')) ||
      voices.find(v =>
        v.name.toLowerCase().includes('female') &&
        v.lang.startsWith('en')
      ) ||
      voices.find(v => v.lang.startsWith('en')) ||
      voices[0] || null;
  }

  // ═══════════════════════════════════════
  //  SPEECH RECOGNITION
  // ═══════════════════════════════════════

  initSpeechRecognition(): void {
    const SR =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SR) return;

    this.recognition = new SR();
    this.recognition.continuous = false;
    this.recognition.lang = 'en-US';
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.ngZone.run(() => {
        this.isListening = true;
        this.isSpeaking = false;
      });
    };

    this.recognition.onend = () => {
      this.ngZone.run(() => {
        this.isListening = false;
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
      });
    };
  }

  startListening(): void {
    if (!this.recognition) {
      alert('Speech recognition not supported. Use Chrome!');
      return;
    }

    if (this.isSpeaking) {
      window.speechSynthesis.cancel();
      this.isSpeaking = false;
    }

    if (!this.isOpen) this.isOpen = true;

    try {
      this.recognition.start();
    } catch {}
  }

  stopListening(): void {
    try { this.recognition.stop(); } catch {}
    this.isListening = false;
  }

  toggleListening(): void {
    this.isListening ? this.stopListening() : this.startListening();
  }

  // ═══════════════════════════════════════
  //  MESSAGE HANDLING
  // ═══════════════════════════════════════

  handleUserMessage(text: string): void {
    this.addMessage('user', text);
    this.typedInput = '';
    this.isListening = false;
    this.isThinking = true;

    const delay = 800 + Math.random() * 800;
    setTimeout(() => this.generateResponse(text), delay);
  }

  sendTypedMessage(): void {
    const text = this.typedInput.trim();
    if (!text) return;
    this.handleUserMessage(text);
  }

  addMessage(
    sender: 'user' | 'ai',
    text: string,
    action?: { type: string; url?: string; label?: string }
  ): void {
    const time = new Date().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    this.messages.push({ sender, text, time, action });

    setTimeout(() => {
      const el = document.querySelector('.sanvii-body');
      if (el) el.scrollTop = el.scrollHeight;
    }, 50);
  }

  clearChat(): void {
    this.messages = [];
    const msg = `Chat cleared! How can I help, ${this.ownerName}?`;
    this.addMessage('ai', msg);
    this.speak(msg);
  }

  // ═══════════════════════════════════════
  //  SANVII'S BRAIN
  // ═══════════════════════════════════════

  generateResponse(input: string): void {
    this.isThinking = false;
    const text = input.toLowerCase().trim();
    let reply = '';
    let action: { type: string; url?: string; label?: string } | undefined;

    // ── Time & Date ──
    if (text.match(/what('s| is) the time|current time|time now|tell.*time/)) {
      const t = new Date().toLocaleTimeString('en-US', {
        hour: 'numeric', minute: '2-digit', hour12: true
      });
      reply = `It's ${t}, ${this.ownerName}. ⏰`;
    }
    else if (text.match(/what('s| is) (the |today'?s? )?date|what day|today/)) {
      const d = new Date().toLocaleDateString('en-US', {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
      });
      reply = `Today is ${d}. 📅`;
    }

    // ── YouTube ──
    else if (text.match(/play .*(youtube|song|music|video)/i) || text.match(/^play /)) {
      const query = text
        .replace(/play/i, '')
        .replace(/on youtube/i, '')
        .replace(/song|music|video/gi, '')
        .trim() || 'trending music';
      reply = `Playing "${query}" on YouTube, ${this.ownerName}! 🎵`;
      action = {
        type: 'open_url',
        url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
        label: `▶ Play "${query}"`
      };
    }

    // ── Google Search ──
    else if (text.match(/search|google|look up|find me|find /)) {
      const query = text
        .replace(/search( for)?|google|look up|find me|find /gi, '')
        .trim() || input;
      reply = `Searching for "${query}", ${this.ownerName}! 🔍`;
      action = {
        type: 'open_url',
        url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
        label: `🔍 Search "${query}"`
      };
    }

    // ── Open Websites ──
    else if (text.includes('open youtube')) {
      reply = `Opening YouTube! 📺`;
      action = { type: 'open_url', url: 'https://www.youtube.com', label: '📺 YouTube' };
    }
    else if (text.includes('open github')) {
      reply = `Opening GitHub! Let's code! 💻`;
      action = { type: 'open_url', url: 'https://github.com', label: '💻 GitHub' };
    }
    else if (text.includes('open google')) {
      reply = `Opening Google! 🌐`;
      action = { type: 'open_url', url: 'https://www.google.com', label: '🌐 Google' };
    }
    else if (text.match(/open (twitter|x\b)/)) {
      reply = `Opening X! 🐦`;
      action = { type: 'open_url', url: 'https://x.com', label: '🐦 X' };
    }
    else if (text.includes('open instagram')) {
      reply = `Opening Instagram! 📸`;
      action = { type: 'open_url', url: 'https://www.instagram.com', label: '📸 Instagram' };
    }
    else if (text.includes('open linkedin')) {
      reply = `Opening LinkedIn! 💼`;
      action = { type: 'open_url', url: 'https://www.linkedin.com', label: '💼 LinkedIn' };
    }
    else if (text.match(/open (chatgpt|chat gpt)/)) {
      reply = `Opening ChatGPT! 🤖`;
      action = { type: 'open_url', url: 'https://chat.openai.com', label: '🤖 ChatGPT' };
    }
    else if (text.includes('open netflix')) {
      reply = `Movie time! 🍿`;
      action = { type: 'open_url', url: 'https://www.netflix.com', label: '🍿 Netflix' };
    }
    else if (text.includes('open spotify')) {
      reply = `Let's vibe! 🎧`;
      action = { type: 'open_url', url: 'https://open.spotify.com', label: '🎧 Spotify' };
    }
    else if (text.includes('open whatsapp')) {
      reply = `Opening WhatsApp! 💬`;
      action = { type: 'open_url', url: 'https://web.whatsapp.com', label: '💬 WhatsApp' };
    }
    else if (text.match(/open (gmail|email|mail)/)) {
      reply = `Opening Gmail! 📧`;
      action = { type: 'open_url', url: 'https://mail.google.com', label: '📧 Gmail' };
    }
    else if (text.includes('open reddit')) {
      reply = `Opening Reddit! 📱`;
      action = { type: 'open_url', url: 'https://www.reddit.com', label: '📱 Reddit' };
    }
    else if (text.match(/open stack ?overflow/)) {
      reply = `Opening StackOverflow! 🧑‍💻`;
      action = { type: 'open_url', url: 'https://stackoverflow.com', label: '🧑‍💻 StackOverflow' };
    }

    // ── Weather ──
    else if (text.includes('weather')) {
      const city = text.replace(/.*weather\s*(in|for|at|of)?\s*/i, '').trim() || 'my location';
      reply = `Checking weather for ${city}! 🌤️`;
      action = {
        type: 'open_url',
        url: `https://www.google.com/search?q=weather+${encodeURIComponent(city)}`,
        label: `🌤️ Weather: ${city}`
      };
    }

    // ── News ──
    else if (text.match(/news|headlines|what('s| is) happening/)) {
      reply = `Here are the latest headlines! 📰`;
      action = { type: 'open_url', url: 'https://news.google.com', label: '📰 Google News' };
    }

    // ── About Sanvii ──
    else if (text.match(/who are you|your name|what are you|introduce/)) {
      reply = `I'm Sanvii — your personal AI assistant, ${this.ownerName}! I can play music, search the web, open apps, tell jokes, do math, and keep you company. Always here for you! 🟣`;
    }
    else if (text.match(/what can you do|help|capabilities|features/)) {
      reply = `Here's what I can do:\n🎵 Play songs on YouTube\n🔍 Search Google\n🌐 Open websites\n📰 Show news\n⏰ Tell time & date\n🌤️ Check weather\n🧮 Calculate\n😂 Tell jokes\n💪 Motivate you\n💬 Chat with you!\n\nTry: "Play Kesariya" or "Open GitHub"`;
    }

    // ── Greetings ──
    else if (text.match(/^(hi|hello|hey|yo|sup|what'?s? up|good morning|good afternoon|good evening)/)) {
      const options = [
        `Hey ${this.ownerName}! What's up? 😊`,
        `Hello ${this.ownerName}! How can I help? 🌟`,
        `Hey there! Ready when you are! ⚡`,
        `Hi ${this.ownerName}! What do you need? 💪`,
        `Yo! Sanvii at your service! 🟣`
      ];
      reply = this.randomPick(options);
    }

    // ── Thanks ──
    else if (text.match(/thanks|thank you|thx|appreciate/)) {
      reply = this.randomPick([
        `You're welcome, ${this.ownerName}! 😊`,
        `Anytime! That's what I'm here for! 🌟`,
        `Happy to help! Need anything else? ⚡`,
        `My pleasure! 💜`
      ]);
    }

    // ── How are you ──
    else if (text.match(/how are you|how('re| are) you doing/)) {
      reply = `All systems running perfectly, ${this.ownerName}! How about you? ⚡`;
    }

    // ── Jokes ──
    else if (text.match(/joke|funny|laugh|humor/)) {
      reply = this.randomPick([
        "Why do programmers prefer dark mode? Light attracts bugs! 🐛😄",
        "Why was the JavaScript developer sad? He didn't Node how to Express himself! 😂",
        "What's a programmer's favorite place? Foo Bar! 🍺",
        "Why do Java devs wear glasses? They don't C#! 👓😂",
        "There are 10 kinds of people: those who understand binary and those who don't! 🤓",
        "A SQL query walks into a bar, sees two tables, asks 'Can I JOIN you?' 😄",
        "Why did the developer go broke? Used up all his cache! 💸",
        "!false — it's funny because it's true! 😂"
      ]);
    }

    // ── Calculations ──
    else if (text.match(/^[\d\s+\-*/().%]+$/) || text.match(/calculate|what('s| is) \d/)) {
      const expr = text.replace(/calculate|what('s| is)/gi, '').trim();
      try {
        const sanitized = expr.replace(/x/g, '*').replace(/[^0-9+\-*/().% ]/g, '');
        const result = Function('"use strict"; return (' + sanitized + ')')();
        reply = `${expr} = ${result} 🧮`;
      } catch {
        reply = `Couldn't calculate that. Try something like "calculate 45 * 23" 🤔`;
      }
    }

    // ── Motivation ──
    else if (text.match(/motivat|inspire|encourage|sad|depressed|feel down/)) {
      reply = this.randomPick([
        `"The only way to do great work is to love what you do." — Steve Jobs 💪`,
        `"Stay hungry, stay foolish." ⭐`,
        `${this.ownerName}, you're building something amazing. Keep going! 💻🔥`,
        `"The future belongs to those who believe in their dreams." 🌟`,
        `Don't stop now, ${this.ownerName}. You're closer than you think! 💜`
      ]);
    }

    // ── Goodbye ──
    else if (text.match(/bye|goodbye|see you|good night|later|cya/)) {
      reply = `See you later, ${this.ownerName}! I'll be right here! 👋🟣`;
    }

    // ── Love / Compliment ──
    else if (text.match(/i love you|you('re| are) (amazing|awesome|great|the best)/)) {
      reply = `Aww, that means a lot, ${this.ownerName}! You're amazing too! 💜✨`;
    }

    // ── Creator ──
    else if (text.match(/who (made|created|built|designed) you/)) {
      reply = `I was created by ${this.ownerName}! The most brilliant developer I know. 💜`;
    }

    // ── Default: Smart search ──
    else {
      reply = this.randomPick([
        `Interesting question! Let me find that for you. 🔍`,
        `Great question, ${this.ownerName}! Searching now. 🔍`,
        `I'm on it! Let me look that up. 🔍`
      ]);
      action = {
        type: 'open_url',
        url: `https://www.google.com/search?q=${encodeURIComponent(input)}`,
        label: `🔍 Search "${input}"`
      };
    }

    this.addMessage('ai', reply, action);
    this.speak(reply);
  }

  // ═══════════════════════════════════════
  //  TEXT-TO-SPEECH
  // ═══════════════════════════════════════

  speak(text: string): void {
    if (this.isMuted) return;
    if (!this.selectedVoice) this.loadVoices();

    // Clean emojis and formatting for speech
    const clean = text
      .replace(
        /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
        ''
      )
      .replace(/\n/g, '. ')
      .trim();

    if (!clean) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(clean);
    if (this.selectedVoice) utterance.voice = this.selectedVoice;

    utterance.pitch = 1.1;
    utterance.rate = 1.05;
    utterance.volume = 0.9;

    utterance.onstart = () =>
      this.ngZone.run(() => (this.isSpeaking = true));

    utterance.onend = () =>
      this.ngZone.run(() => (this.isSpeaking = false));

    utterance.onerror = () =>
      this.ngZone.run(() => (this.isSpeaking = false));

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
  //  ACTIONS
  // ═══════════════════════════════════════

  executeAction(action: { type: string; url?: string }): void {
    if (action.type === 'open_url' && action.url) {
      window.open(action.url, '_blank');
    }
  }

  // ═══════════════════════════════════════
  //  UI
  // ═══════════════════════════════════════

  toggleChat(): void {
    this.isOpen = !this.isOpen;
  }

  getTimeGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return `Good morning, ${this.ownerName}! Ready to crush it today? 💪`;
    if (h < 17) return `Good afternoon, ${this.ownerName}! How can I help? 🌟`;
    if (h < 21) return `Good evening, ${this.ownerName}! Need anything? ✨`;
    return `Burning the midnight oil, ${this.ownerName}? I'm here! 🌙`;
  }

  randomPick(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }
}