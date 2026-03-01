import { Injectable } from '@angular/core';
import { NewsItem } from '../models/sanvii.models';

@Injectable({ providedIn: 'root' })
export class NewsService {

  private cache: NewsItem[] = [];
  private lastFetch = 0;
  private readonly CACHE_DURATION = 30 * 60 * 1000;

  async getNews(category = 'general'): Promise<NewsItem[]> {
    if (this.cache.length > 0 && Date.now() - this.lastFetch < this.CACHE_DURATION) {
      return this.cache;
    }

    const feeds = new Map<string, string>([
      ['general', 'https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en'],
      ['tech', 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGRqTVhZU0FtVnVHZ0pWVXlnQVAB?hl=en-US'],
      ['sports', 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRFp1ZEdvU0FtVnVHZ0pWVXlnQVAB?hl=en-US'],
      ['business', 'https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB?hl=en-US']
    ]);

    const feedUrl = feeds.get(category) || feeds.get('general')!;

    try {
      const proxyUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feedUrl)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();

      if (data.items) {
        this.cache = data.items.slice(0, 10).map((item: any) => ({
          title: item.title,
          source: item.author || 'News',
          url: item.link,
          publishedAt: item.pubDate,
          description: item.description?.replace(/<[^>]*>/g, '').slice(0, 150)
        }));
        this.lastFetch = Date.now();
      }

      return this.cache;
    } catch (err) {
      console.error('News fetch error:', err);
      return this.getStaticFallback();
    }
  }

  formatNewsList(news: NewsItem[], count = 5): string {
    if (news.length === 0) return "Couldn't fetch news right now.";

    return news.slice(0, count).map((n: NewsItem, i: number) =>
      `${i + 1}. ${n.title}`
    ).join('\n');
  }

  private getStaticFallback(): NewsItem[] {
    return [
      {
        title: 'Unable to fetch live news. Check your internet connection.',
        source: 'Sanvii',
        url: 'https://news.google.com',
        publishedAt: new Date().toISOString()
      }
    ];
  }
}