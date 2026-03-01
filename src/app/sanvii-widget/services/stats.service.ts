import { Injectable } from '@angular/core';
import { ProductivityStats } from '../models/sanvii.models';

type StatsField = 'conversations' | 'tasksCompleted' | 'tasksTotal' |
                  'searchesMade' | 'websitesOpened' | 'songsPlayed' | 'remindersSet';

@Injectable({ providedIn: 'root' })
export class StatsService {

  private readonly KEY = 'sanvii_stats';

  private getToday(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getStatsStore(): Record<string, ProductivityStats> {
    try {
      return JSON.parse(localStorage.getItem(this.KEY) || '{}');
    } catch { return {}; }
  }

  private saveStats(stats: Record<string, ProductivityStats>): void {
    localStorage.setItem(this.KEY, JSON.stringify(stats));
  }

  private ensureToday(): ProductivityStats {
    const all = this.getStatsStore();
    const today = this.getToday();

    if (!all[today]) {
      all[today] = {
        date: today,
        activeTime: 0,
        conversations: 0,
        tasksCompleted: 0,
        tasksTotal: 0,
        searchesMade: 0,
        websitesOpened: 0,
        songsPlayed: 0,
        remindersSet: 0,
        score: 0
      };
      this.saveStats(all);
    }

    return all[today];
  }

  increment(field: StatsField): void {
    const all = this.getStatsStore();
    const today = this.getToday();
    this.ensureToday();

    all[today][field] = (all[today][field] || 0) + 1;
    all[today].score = this.calculateScore(all[today]);
    this.saveStats(all);
  }

  addActiveTime(minutes: number): void {
    const all = this.getStatsStore();
    const today = this.getToday();
    this.ensureToday();

    all[today].activeTime += minutes;
    all[today].score = this.calculateScore(all[today]);
    this.saveStats(all);
  }

  getTodayStats(): ProductivityStats {
    return this.ensureToday();
  }

  getYesterdayStats(): ProductivityStats | null {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = yesterday.toISOString().split('T')[0];
    return this.getStatsStore()[key] || null;
  }

  getWeekStats(): ProductivityStats[] {
    const stats = this.getStatsStore();
    const week: ProductivityStats[] = [];

    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const key = date.toISOString().split('T')[0];
      if (stats[key]) week.push(stats[key]);
    }

    return week;
  }

  private calculateScore(s: ProductivityStats): number {
    let score = 0;
    score += Math.min(s.conversations * 3, 30);
    score += Math.min(s.tasksCompleted * 10, 30);
    score += Math.min(s.searchesMade * 2, 15);
    score += Math.min(s.websitesOpened, 10);
    score += Math.min(Math.floor(s.activeTime / 30) * 5, 15);
    return Math.min(100, score);
  }

  formatStatsCard(): string {
    const s = this.getTodayStats();
    const yesterday = this.getYesterdayStats();

    let text = `📊 Today's Productivity:\n\n`;
    text += `💬 Conversations: ${s.conversations}\n`;
    text += `✅ Tasks completed: ${s.tasksCompleted}\n`;
    text += `🔍 Searches: ${s.searchesMade}\n`;
    text += `🌐 Websites opened: ${s.websitesOpened}\n`;
    text += `🎵 Songs played: ${s.songsPlayed}\n`;
    text += `🔔 Reminders set: ${s.remindersSet}\n`;
    text += `\n⭐ Score: ${s.score}/100`;

    if (yesterday) {
      const diff = s.score - yesterday.score;
      text += `\n${diff >= 0 ? '📈' : '📉'} ${diff >= 0 ? '+' : ''}${diff} from yesterday`;
    }

    return text;
  }
}