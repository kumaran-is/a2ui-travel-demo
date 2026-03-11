import { Injectable } from '@angular/core';

/**
 * Holds mutable form input values for each active surface.
 * Keyed by surfaceId → binding path → string value.
 * Used by A2UI TextField and DateField components.
 */
@Injectable({ providedIn: 'root' })
export class SurfaceFormStateService {
  private readonly state = new Map<string, Record<string, string>>();

  setValue(surfaceId: string, binding: string, value: string): void {
    if (!this.state.has(surfaceId)) {
      this.state.set(surfaceId, {});
    }
    this.state.get(surfaceId)![binding] = value;
  }

  getValue(surfaceId: string, binding: string): string {
    return this.state.get(surfaceId)?.[binding] ?? '';
  }

  clearSurface(surfaceId: string): void {
    this.state.delete(surfaceId);
  }
}
