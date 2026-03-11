import {
  Component,
  input,
  output,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { A2UIComponentDef, SurfaceState, UserAction, A2UIValue } from '../../models/a2ui.models';
import { A2UICatalogService } from '../../services/a2ui-catalog.service';
import { A2UISanitizerService } from '../../services/a2ui-sanitizer.service';
import { SurfaceFormStateService } from '../../services/surface-form-state.service';

/**
 * Recursive A2UI renderer component.
 *
 * Security: ALL component types are validated against the catalog allowlist.
 * Unknown types are silently skipped — never rendered via innerHTML or eval.
 */
@Component({
  selector: 'app-a2ui-renderer',
  standalone: true,
  imports: [CommonModule, FormsModule, A2UIRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (comp(); as c) {
      @switch (c.type) {

        @case ('Column') {
          <div [class]="columnClass(c)">
            @for (childId of (c.children?.explicitList ?? []); track childId) {
              <app-a2ui-renderer
                [componentId]="childId"
                [surface]="surface()"
                (actionTriggered)="actionTriggered.emit($event)"
              />
            }
          </div>
        }

        @case ('Row') {
          <div [class]="rowClass(c)">
            @for (childId of (c.children?.explicitList ?? []); track childId) {
              <app-a2ui-renderer
                [componentId]="childId"
                [surface]="surface()"
                (actionTriggered)="actionTriggered.emit($event)"
              />
            }
          </div>
        }

        @case ('Card') {
          <div class="bg-base-100 border border-base-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-px transition-all duration-150 mb-3 overflow-hidden">
            <div class="p-5">
              @if (c.child) {
                <app-a2ui-renderer
                  [componentId]="c.child"
                  [surface]="surface()"
                  (actionTriggered)="actionTriggered.emit($event)"
                />
              }
            </div>
          </div>
        }

        @case ('Text') {
          @switch (c.usageHint) {
            @case ('h1') { <h1 class="text-2xl font-bold mb-3 text-base-content tracking-tight">{{ resolveText(c) }}</h1> }
            @case ('h2') { <h2 class="text-xs font-semibold uppercase tracking-widest text-base-content/50 mb-4 mt-2">{{ resolveText(c) }}</h2> }
            @case ('h3') { <h3 class="text-base font-semibold text-base-content mb-1 leading-snug">{{ resolveText(c) }}</h3> }
            @case ('h4') { <h4 class="text-sm font-medium mb-1 text-base-content/80">{{ resolveText(c) }}</h4> }
            @case ('h5') { <h5 class="text-xs font-medium mb-1 text-base-content/60">{{ resolveText(c) }}</h5> }
            @case ('h6') { <h6 class="text-xs text-base-content/40 uppercase tracking-widest mb-1">{{ resolveText(c) }}</h6> }
            @default    { <p class="text-sm text-base-content/60 mb-2 leading-relaxed">{{ resolveText(c) }}</p> }
          }
        }

        @case ('Image') {
          <img
            [src]="sanitizer.sanitizeUrl(resolveValue(c.url))"
            alt="Travel image"
            class="rounded-lg w-full h-48 object-cover mb-2"
          />
        }

        @case ('Divider') {
          @if (c.axis === 'vertical') {
            <div class="w-px bg-base-200 self-stretch mx-2"></div>
          } @else {
            <hr class="border-base-200 my-5" />
          }
        }

        @case ('Button') {
          <button
            [class]="buttonClass(c)"
            (click)="onAction(c)"
            type="button"
          >
            @if (c.child) {
              <app-a2ui-renderer
                [componentId]="c.child"
                [surface]="surface()"
                (actionTriggered)="actionTriggered.emit($event)"
              />
            }
          </button>
        }

        @case ('TextField') {
          <div class="form-control mb-3 flex-1 min-w-0">
            @if (c.label) {
              <label class="label py-1">
                <span class="label-text text-sm font-medium text-base-content">{{ resolveValue(c.label) }}</span>
              </label>
            }
            <input
              [type]="textFieldInputType(c)"
              class="input input-bordered w-full"
              [placeholder]="resolveValue(c.placeholder) || resolveValue(c.label) || ''"
              [ngModel]="getFormValue(c.binding)"
              (ngModelChange)="setFormValue(c.binding, $event)"
            />
          </div>
        }

        @case ('DateField') {
          <div class="form-control mb-3 flex-1 min-w-0">
            @if (c.label) {
              <label class="label py-1">
                <span class="label-text text-sm font-medium text-base-content">{{ resolveValue(c.label) }}</span>
              </label>
            }
            <input
              type="date"
              class="input input-bordered w-full"
              [ngModel]="getFormValue(c.binding)"
              (ngModelChange)="setFormValue(c.binding, $event)"
            />
          </div>
        }

        @default {
          <!-- Unknown A2UI type — silently skipped per security policy -->
        }

      }
    }
  `,
})
export class A2UIRendererComponent {
  componentId = input.required<string>();
  surface = input.required<SurfaceState>();
  actionTriggered = output<UserAction>();

  protected readonly catalog = inject(A2UICatalogService);
  protected readonly sanitizer = inject(A2UISanitizerService);
  protected readonly formState = inject(SurfaceFormStateService);

  protected getFormValue(binding: string | undefined): string {
    if (!binding) return '';
    return this.formState.getValue(this.surface().surfaceId, binding);
  }

  protected setFormValue(binding: string | undefined, value: string): void {
    if (!binding) return;
    this.formState.setValue(this.surface().surfaceId, binding, value);
  }

  /** Validated component — null if type not in catalog */
  protected comp = computed<A2UIComponentDef | null>(() => {
    const id = this.componentId();
    const s = this.surface();
    const def = s.componentMap.get(id);
    if (!def) return null;
    if (!this.catalog.isAllowed(def.type)) {
      console.warn(`[A2UI] Unknown component type skipped: ${def.type}`);
      return null;
    }
    return def;
  });

  protected columnClass(c: A2UIComponentDef): string {
    const align = c.alignment === 'center' ? 'items-center' : c.alignment === 'end' ? 'items-end' : 'items-start';
    return `flex flex-col gap-3 ${align}`;
  }

  protected rowClass(c: A2UIComponentDef): string {
    const justify = c.alignment === 'center' ? 'justify-center' : c.alignment === 'end' ? 'justify-end' : 'justify-start';
    return `flex flex-row gap-2 flex-wrap ${justify}`;
  }

  protected buttonClass(c: A2UIComponentDef): string {
    return c.primary
      ? 'btn btn-neutral btn-sm rounded-lg px-5'
      : 'btn btn-outline btn-sm rounded-lg px-5 border-base-300';
  }

  protected textFieldInputType(c: A2UIComponentDef): string {
    return c.textFieldType === 'email' ? 'email' : 'text';
  }

  /** Resolve text from Text component (supports literalString and path) */
  protected resolveText(c: A2UIComponentDef): string {
    // Text component may have direct literalString/path at component level
    if (c.literalString) return this.sanitizer.sanitizeText(c.literalString);
    if (c.path) {
      const value = this.resolveDataPath(c.path);
      return this.sanitizer.sanitizeText(String(value ?? ''));
    }
    // Or via text value object
    if (c.text) return this.sanitizer.sanitizeText(this.resolveValue(c.text));
    return '';
  }

  /** Resolve an A2UIValue to a string */
  protected resolveValue(value: A2UIValue | undefined): string {
    if (!value) return '';
    if (value.path) {
      const resolved = this.resolveDataPath(value.path);
      return this.sanitizer.sanitizeText(String(resolved ?? value.literalString ?? ''));
    }
    return this.sanitizer.sanitizeText(value.literalString ?? '');
  }

  private resolveDataPath(path: string): unknown {
    const dataModel = this.surface().dataModel;
    const parts = path.replace(/^\//, '').split('/');
    let current: unknown = dataModel;
    for (const part of parts) {
      if (current == null || typeof current !== 'object') return undefined;
      current = (current as Record<string, unknown>)[part];
    }
    return current;
  }

  protected onAction(c: A2UIComponentDef): void {
    const action = c.action;
    if (!action?.name) return;

    const surfaceId = this.surface().surfaceId;
    const context: Record<string, unknown> = {};

    for (const entry of action.context ?? []) {
      if (entry.value?.path) {
        // Check form state first (for binding paths like /form/destination)
        const formVal = this.formState.getValue(surfaceId, entry.value.path);
        context[entry.key] = formVal || this.resolveValue(entry.value);
      } else {
        context[entry.key] = this.resolveValue(entry.value);
      }
    }

    this.actionTriggered.emit({
      name: action.name,
      surfaceId,
      sourceComponentId: this.componentId(),
      timestamp: new Date().toISOString(),
      context,
    });
  }
}
