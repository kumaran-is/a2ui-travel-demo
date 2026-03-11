import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import {
  A2UIMessage,
  SurfaceState,
  UserAction,
  SurfaceUpdateMsg,
  BeginRenderingMsg,
  DataModelUpdateMsg,
  A2UIComponentDef,
} from '../models/a2ui.models';

const API_BASE = '';  // proxied via proxy.conf.json

/**
 * Folds an array of A2UI messages into a SurfaceState.
 * Pure function — no side effects.
 */
export function buildSurfaceState(messages: A2UIMessage[]): SurfaceState {
  const state: SurfaceState = {
    surfaceId: 'main',
    rootComponentId: null,
    componentMap: new Map<string, A2UIComponentDef>(),
    dataModel: {},
  };

  for (const msg of messages) {
    if ('surfaceUpdate' in msg) {
      const su = (msg as SurfaceUpdateMsg).surfaceUpdate;
      state.surfaceId = su.surfaceId;
      for (const entry of su.components) {
        state.componentMap.set(entry.id, entry.component);
      }
    } else if ('beginRendering' in msg) {
      const br = (msg as BeginRenderingMsg).beginRendering;
      state.rootComponentId = br.root;
    } else if ('dataModelUpdate' in msg) {
      const dm = (msg as DataModelUpdateMsg).dataModelUpdate;
      Object.assign(state.dataModel, dm.data);
    }
  }

  // Fallback: if agent sent surfaceUpdate with a 'root' component but no beginRendering
  if (!state.rootComponentId && state.componentMap.has('root')) {
    state.rootComponentId = 'root';
  }

  return state;
}

@Injectable({ providedIn: 'root' })
export class TravelAgentService {
  private readonly http = inject(HttpClient);

  /** Unique session ID for this browser session */
  readonly sessionId = crypto.randomUUID();

  /**
   * Send a chat message to the agent.
   * Returns an Observable that emits one SurfaceState after the stream completes.
   */
  sendMessage(message: string): Observable<SurfaceState> {
    return this._streamToSurface('/chat', { message, session_id: this.sessionId });
  }

  /**
   * Send a userAction to the agent.
   * Returns an Observable that emits one SurfaceState after the stream completes.
   */
  sendUserAction(action: UserAction): Observable<SurfaceState> {
    const payload = {
      userAction: {
        ...action,
        context: { ...action.context, sessionId: this.sessionId },
      },
    };
    return this._streamToSurface('/action', payload);
  }

  private _streamToSurface(endpoint: string, body: unknown): Observable<SurfaceState> {
    const subject = new Subject<SurfaceState>();

    fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        if (!response.body) {
          throw new Error('Response has no body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        const messages: A2UIMessage[] = [];
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === 'data: [DONE]') continue;
            if (trimmed.startsWith('data: ')) {
              const jsonStr = trimmed.slice(6);
              try {
                const parsed = JSON.parse(jsonStr) as A2UIMessage;
                if ('error' in parsed) {
                  subject.error(new Error((parsed as Record<string, unknown>)['detail'] as string || 'Agent error'));
                  return;
                }
                messages.push(parsed);
              } catch (e) {
                console.warn('[TravelAgent] Failed to parse SSE line:', jsonStr);
              }
            }
          }
        }

        const surface = buildSurfaceState(messages);
        subject.next(surface);
        subject.complete();
      })
      .catch((err: Error) => {
        subject.error(err);
      });

    return subject.asObservable();
  }
}
