import {
  Component,
  signal,
  inject,
  effect,
  viewChild,
  ElementRef,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatMessage, UserAction } from '../../models/a2ui.models';
import { TravelAgentService } from '../../services/travel-agent.service';
import { A2UIRendererComponent } from '../a2ui-renderer/a2ui-renderer.component';

@Component({
  selector: 'app-chat-page',
  standalone: true,
  imports: [CommonModule, FormsModule, A2UIRendererComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="h-screen bg-base-200 flex flex-col overflow-hidden">

      <!-- Header -->
      <header class="bg-neutral text-neutral-content shadow-md flex-shrink-0">
        <div class="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <div class="flex items-center gap-3">
            <span class="text-lg leading-none">&#x2708;</span>
            <div>
              <h1 class="text-base font-semibold tracking-tight leading-none">TravelAI</h1>
              <p class="text-xs opacity-50 mt-0.5">Intelligent travel planning</p>
            </div>
          </div>
          <div class="flex-1"></div>
          <span class="text-xs opacity-40 font-mono">ADK + A2UI</span>
        </div>
      </header>

      <!-- Messages (scrollable middle) -->
      <main #messageContainer class="flex-1 overflow-y-auto">
        <div class="max-w-4xl mx-auto w-full px-4 py-8 flex flex-col gap-5">

          @if (messages().length === 0) {
            <!-- Empty state: centred hero + inline input -->
            <div class="flex flex-col items-center justify-center min-h-[55vh] gap-8">
              <div class="w-16 h-16 rounded-2xl bg-neutral flex items-center justify-center shadow-lg text-3xl">
                &#x2708;
              </div>
              <div class="text-center">
                <p class="text-base-content text-2xl font-bold mb-2">Where do you want to go?</p>
                <p class="text-base-content/50 text-sm">Search hotels or flights — I'll show the right form</p>
              </div>
              <!-- Inline search bar in centre -->
              <div class="w-full max-w-xl flex gap-3 items-center">
                <input
                  type="text"
                  [(ngModel)]="inputText"
                  (keydown.enter)="send()"
                  [disabled]="loading()"
                  placeholder="Try: Search hotels in Paris or Find flights to Tokyo"
                  class="input bg-base-100 border border-base-300 focus:border-neutral flex-1 rounded-xl transition-colors"
                  autofocus
                />
                <button
                  (click)="send()"
                  [disabled]="loading() || !inputText.trim()"
                  class="btn btn-neutral rounded-xl px-6 min-w-[100px]"
                >
                  @if (loading()) {
                    <span class="loading loading-spinner loading-sm"></span>
                  } @else {
                    Search
                  }
                </button>
              </div>
              <div class="flex flex-row flex-wrap gap-2 justify-center">
                @for (hint of suggestions; track hint) {
                  <button
                    class="btn btn-sm bg-base-100 border border-base-300 text-base-content hover:bg-neutral hover:text-neutral-content hover:border-neutral rounded-lg font-normal transition-colors w-auto"
                    (click)="useSuggestion(hint)">
                    {{ hint }}
                  </button>
                }
              </div>
            </div>
          }

          @for (msg of messages(); track msg.id) {
            @if (msg.role === 'user') {
              <div class="flex justify-end">
                <div class="max-w-xs lg:max-w-md px-4 py-3 rounded-2xl rounded-br-none bg-neutral text-neutral-content shadow-sm text-sm font-medium">
                  {{ msg.text }}
                </div>
              </div>
            } @else {
              <div class="flex justify-start gap-3">
                <div class="w-7 h-7 rounded-lg bg-neutral text-neutral-content flex items-center justify-center shrink-0 mt-1 shadow-sm text-sm leading-none">
                  &#x2605;
                </div>
                <div class="flex-1 min-w-0 max-w-2xl">
                  @if (msg.loading) {
                    <div class="bg-base-100 border border-base-200 rounded-2xl rounded-bl-none px-5 py-4 shadow-sm inline-flex items-center gap-3">
                      <span class="loading loading-dots loading-sm text-neutral"></span>
                      <span class="text-sm text-base-content/40">Searching flights and hotels...</span>
                    </div>
                  } @else if (msg.error) {
                    <div class="bg-error/10 border border-error/20 rounded-2xl rounded-bl-none px-4 py-3 text-error text-sm">
                      Error: {{ msg.error }}
                    </div>
                  } @else if (msg.surface && msg.surface.rootComponentId) {
                    <div class="w-full max-w-2xl">
                      <app-a2ui-renderer
                        [componentId]="msg.surface.rootComponentId"
                        [surface]="msg.surface"
                        (actionTriggered)="handleUserAction($event)"
                      />
                    </div>
                  }
                </div>
              </div>
            }
          }

          <!-- Error toast -->
          @if (errorMessage()) {
            <div class="toast toast-top toast-center z-50">
              <div class="alert alert-error shadow-lg">
                <span>{{ errorMessage() }}</span>
              </div>
            </div>
          }

        </div>
      </main>

      <!-- Sticky bottom input bar (shown only after first message) -->
      @if (messages().length > 0) {
        <footer class="bg-base-100 border-t border-base-200 px-4 py-4 flex-shrink-0">
          <div class="max-w-4xl mx-auto flex gap-3 items-center">
            <input
              type="text"
              [(ngModel)]="inputText"
              (keydown.enter)="send()"
              [disabled]="loading()"
              placeholder="Try: Search hotels in Paris or Find flights to Tokyo"
              class="input bg-base-200 border-transparent focus:border-neutral focus:bg-base-100 flex-1 rounded-xl transition-colors"
            />
            <button
              (click)="send()"
              [disabled]="loading() || !inputText.trim()"
              class="btn btn-neutral rounded-xl px-6 min-w-[100px]"
            >
              @if (loading()) {
                <span class="loading loading-spinner loading-sm"></span>
              } @else {
                Search
              }
            </button>
          </div>
        </footer>
      }

    </div>
  `,
})
export class ChatPageComponent {
  private readonly agentService = inject(TravelAgentService);

  messages = signal<ChatMessage[]>([]);
  loading = signal(false);
  errorMessage = signal<string | null>(null);
  inputText = '';

  private messageContainer = viewChild<ElementRef<HTMLElement>>('messageContainer');

  constructor() {
    effect(() => {
      // Read messages signal to track changes
      this.messages();
      // Scroll to bottom after render
      setTimeout(() => {
        const el = this.messageContainer()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
      }, 50);
    });
  }

  suggestions = [
    'Search for hotels in Paris',
    'Find flights to Tokyo',
    'Search for hotels in London',
    'Find flights to New York',
  ];

  useSuggestion(text: string): void {
    this.inputText = text;
    this.send();
  }

  send(): void {
    const text = this.inputText.trim();
    if (!text || this.loading()) return;

    this.inputText = '';
    this.loading.set(true);

    // Add user message
    const userId = crypto.randomUUID();
    this.messages.update(msgs => [...msgs, { id: userId, role: 'user', text }]);

    // Add loading placeholder for agent
    const agentId = crypto.randomUUID();
    this.messages.update(msgs => [...msgs, { id: agentId, role: 'agent', loading: true }]);

    this.agentService.sendMessage(text).subscribe({
      next: (surface) => {
        this.messages.update(msgs =>
          msgs.map(m => m.id === agentId ? { ...m, loading: false, surface } : m)
        );
        this.loading.set(false);
      },
      error: (err: Error) => {
        const errorText = err.message || 'Agent failed to respond';
        this.messages.update(msgs =>
          msgs.map(m => m.id === agentId ? { ...m, loading: false, error: errorText } : m)
        );
        this.loading.set(false);
        this._showError(errorText);
      },
    });
  }

  handleUserAction(action: UserAction): void {
    this.loading.set(true);

    const agentId = crypto.randomUUID();
    this.messages.update(msgs => [...msgs, { id: agentId, role: 'agent', loading: true }]);

    this.agentService.sendUserAction(action).subscribe({
      next: (surface) => {
        this.messages.update(msgs =>
          msgs.map(m => m.id === agentId ? { ...m, loading: false, surface } : m)
        );
        this.loading.set(false);
      },
      error: (err: Error) => {
        const errorText = err.message || 'Booking failed';
        this.messages.update(msgs =>
          msgs.map(m => m.id === agentId ? { ...m, loading: false, error: errorText } : m)
        );
        this.loading.set(false);
        this._showError(errorText);
      },
    });
  }

  private _showError(msg: string): void {
    this.errorMessage.set(msg);
    setTimeout(() => this.errorMessage.set(null), 5000);
  }
}
