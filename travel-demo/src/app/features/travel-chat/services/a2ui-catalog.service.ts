import { Injectable } from '@angular/core';

/**
 * A2UI component catalog — client-controlled allowlist.
 * ONLY component types in this set will be rendered.
 * Agent-provided types NOT in this set are silently skipped.
 * This is the primary XSS/injection security boundary.
 */
@Injectable({ providedIn: 'root' })
export class A2UICatalogService {
  /** Approved component type allowlist */
  private readonly allowedTypes = new Set<string>([
    'Row',
    'Column',
    'Text',
    'Image',
    'Divider',
    'Button',
    'TextField',
    'DateField',
    'Card',
  ]);

  isAllowed(type: string): boolean {
    return this.allowedTypes.has(type);
  }

  getAllowedTypes(): ReadonlySet<string> {
    return this.allowedTypes;
  }
}
