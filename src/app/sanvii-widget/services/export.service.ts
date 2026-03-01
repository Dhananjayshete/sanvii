import { Injectable } from '@angular/core';
import { SanviiMessage } from '../models/sanvii.models';

@Injectable({ providedIn: 'root' })
export class ExportService {

  exportAsText(messages: SanviiMessage[], ownerName: string): void {
    let content = `Sanvii AI — Chat Export\n`;
    content += `Owner: ${ownerName}\n`;
    content += `Date: ${new Date().toLocaleString()}\n`;
    content += `${'═'.repeat(50)}\n\n`;

    messages.forEach(m => {
      const name = m.sender === 'ai' ? 'Sanvii' : ownerName;
      content += `[${m.time}] ${name}: ${m.text}\n\n`;
    });

    this.downloadFile(content, 'sanvii-chat.txt', 'text/plain');
  }

  exportAsJSON(messages: SanviiMessage[]): void {
    const data = {
      exportDate: new Date().toISOString(),
      messageCount: messages.length,
      messages: messages
    };

    this.downloadFile(
      JSON.stringify(data, null, 2),
      'sanvii-chat.json',
      'application/json'
    );
  }

  exportAsHTML(messages: SanviiMessage[], ownerName: string): void {
    let html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Sanvii Chat Export</title>
<style>
  body { font-family: system-ui; max-width: 600px; margin: 40px auto; background: #0f0f1e; color: #e2e8f0; padding: 20px; }
  h1 { color: #8b5cf6; }
  .msg { margin: 12px 0; padding: 10px 14px; border-radius: 12px; max-width: 80%; }
  .ai { background: #1a1a3e; border-left: 3px solid #8b5cf6; }
  .user { background: #2575fc; margin-left: auto; text-align: right; }
  .time { font-size: 11px; color: #64748b; margin-top: 4px; }
  .meta { color: #64748b; font-size: 13px; margin-bottom: 20px; }
</style></head><body>
<h1>🟣 Sanvii Chat</h1>
<p class="meta">Exported: ${new Date().toLocaleString()} | Messages: ${messages.length}</p>\n`;

    messages.forEach(m => {
      const cls = m.sender === 'ai' ? 'ai' : 'user';
      html += `<div class="msg ${cls}">${m.text}<div class="time">${m.time}</div></div>\n`;
    });

    html += `</body></html>`;

    this.downloadFile(html, 'sanvii-chat.html', 'text/html');
  }

  copyToClipboard(messages: SanviiMessage[], ownerName: string): void {
    let text = messages.map(m => {
      const name = m.sender === 'ai' ? 'Sanvii' : ownerName;
      return `${name}: ${m.text}`;
    }).join('\n');

    navigator.clipboard.writeText(text).catch(() => {});
  }

  private downloadFile(content: string, filename: string, type: string): void {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}