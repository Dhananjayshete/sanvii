import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'sanviiFormat',
  standalone: true
})
export class SanviiFormatPipe implements PipeTransform {
  transform(text: string): string {
    if (!text) return '';

    let formatted = text;

    // Code blocks: ```code``` → <pre><code>code</code></pre>
    formatted = formatted.replace(
      /```(\w*)\n?([\s\S]*?)```/g,
      '<pre class="code-block"><code>$2</code></pre>'
    );

    // Inline code: `code` → <code>code</code>
    formatted = formatted.replace(
      /`([^`]+)`/g,
      '<code class="inline-code">$1</code>'
    );

    // Bold: **text** → <strong>text</strong>
    formatted = formatted.replace(
      /\*\*(.+?)\*\*/g,
      '<strong>$1</strong>'
    );

    // Italic: *text* → <em>text</em>
    formatted = formatted.replace(
      /(?<!\*)\*([^*]+)\*(?!\*)/g,
      '<em>$1</em>'
    );

    // Links: [text](url) → <a>text</a>
    formatted = formatted.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" class="msg-link">$1</a>'
    );

    // Line breaks
    formatted = formatted.replace(/\n/g, '<br>');

    return formatted;
  }
}