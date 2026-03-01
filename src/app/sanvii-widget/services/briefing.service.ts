import { Injectable } from '@angular/core';
import { WeatherService } from './weather.service';
import { NewsService } from './news.service';
import { TodoService } from './todo.service';
import { ReminderService } from './reminder.service';
import { MemoryService } from './memory.service';
import { StatsService } from './stats.service';

@Injectable({ providedIn: 'root' })
export class BriefingService {

  private readonly KEY = 'sanvii_last_briefing';

  constructor(
    private weather: WeatherService,
    private news: NewsService,
    private todos: TodoService,
    private reminders: ReminderService,
    private memory: MemoryService,
    private stats: StatsService
  ) {}

  shouldShowBriefing(): boolean {
    const lastBriefing = localStorage.getItem(this.KEY);
    if (!lastBriefing) return true;

    const lastDate = new Date(parseInt(lastBriefing)).toDateString();
    const today = new Date().toDateString();
    return lastDate !== today;
  }

  markBriefingShown(): void {
    localStorage.setItem(this.KEY, Date.now().toString());
  }

  async generateBriefing(ownerName: string): Promise<string> {
    const now = new Date();
    const day = now.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });

    let briefing = `Good ${this.getTimeOfDay()}, ${ownerName}! Here's your daily briefing:\n\n`;
    briefing += `📅 ${day}\n`;

    // Weather
    const location = this.memory.recallFact('location');
    if (location) {
      const w = await this.weather.getWeather(location);
      if (w) {
        briefing += `${w.icon} ${w.temp}°C, ${w.description} in ${w.city}\n`;
      }
    }

    // Pending todos
    const pending = this.todos.getPending();
    if (pending.length > 0) {
      briefing += `\n📋 ${pending.length} pending task${pending.length > 1 ? 's' : ''}:\n`;
      pending.slice(0, 3).forEach(t => {
        briefing += `   ☐ ${t.text}\n`;
      });
    }

    // Active reminders
    const reminders = this.reminders.getActiveReminders();
    if (reminders.length > 0) {
      briefing += `\n🔔 ${reminders.length} upcoming reminder${reminders.length > 1 ? 's' : ''}:\n`;
      reminders.slice(0, 3).forEach(r => {
        briefing += `   ⏰ ${r.message} (${r.timeStr})\n`;
      });
    }

    // Yesterday stats
    const yesterday = this.stats.getYesterdayStats();
    if (yesterday) {
      briefing += `\n📊 Yesterday's score: ${yesterday.score}/100\n`;
    }

    // Motivation quote
    const quotes = [
      '"The best time to start is now."',
      '"Small steps every day lead to big results."',
      '"You are capable of amazing things."',
      '"Make today count!"',
      '"Focus on progress, not perfection."'
    ];
    briefing += `\n💡 ${quotes[Math.floor(Math.random() * quotes.length)]}\n`;
    briefing += `\nWhat would you like to start with?`;

    this.markBriefingShown();
    return briefing;
  }

  private getTimeOfDay(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    if (h < 21) return 'evening';
    return 'night';
  }
}