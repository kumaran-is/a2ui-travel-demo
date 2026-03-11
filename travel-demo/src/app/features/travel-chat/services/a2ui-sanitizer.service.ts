import { Injectable } from '@angular/core';

/** Maximum text length allowed from agent */
const MAX_TEXT_LENGTH = 500;

/** Allowed URL schemes */
const ALLOWED_SCHEMES = ['http:', 'https:'];

/**
 * Sanitizes agent-provided values before rendering.
 * Protects against URL injection and unbounded text.
 */
@Injectable({ providedIn: 'root' })
export class A2UISanitizerService {
  sanitizeText(text: string | undefined): string {
    if (!text) return '';
    return text.substring(0, MAX_TEXT_LENGTH);
  }

  sanitizeUrl(url: string | undefined): string {
    if (!url) return '';
    try {
      const parsed = new URL(url);
      if (!ALLOWED_SCHEMES.includes(parsed.protocol)) {
        console.warn('[A2UI] Blocked non-http URL:', url);
        return '';
      }
      return url;
    } catch {
      console.warn('[A2UI] Invalid URL blocked:', url);
      return '';
    }
  }
}
