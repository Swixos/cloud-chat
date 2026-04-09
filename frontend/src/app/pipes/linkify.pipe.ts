import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';

@Pipe({ name: 'linkify', standalone: true })
export class LinkifyPipe implements PipeTransform {
  private urlRegex = /((https?:\/\/|www\.)[^\s<]+)/gi;

  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string): SafeHtml {
    const escaped = value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const linked = escaped.replace(this.urlRegex, (url) => {
      const href = url.startsWith('http') ? url : `https://${url}`;
      return `<a href="${href}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    return this.sanitizer.bypassSecurityTrustHtml(linked);
  }
}
