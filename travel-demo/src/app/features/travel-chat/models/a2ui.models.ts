/**
 * A2UI Protocol v0.8 TypeScript models.
 * All agent-provided payloads are untrusted and must be validated before use.
 */

/** Typed value — static literal or JSON Pointer path into data model */
export interface A2UIValue {
  literalString?: string;
  path?: string;
}

/** Children reference — explicit list of component IDs */
export interface A2UIChildren {
  explicitList?: string[];
}

/** A2UI action definition on a component */
export interface A2UIAction {
  name: string;
  context?: Array<{ key: string; value: A2UIValue }>;
}

/** Raw component definition from agent payload */
export interface A2UIComponentDef {
  type: string;
  // Layout
  children?: A2UIChildren;
  alignment?: 'start' | 'center' | 'end';
  // Display
  text?: A2UIValue;
  usageHint?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'body';
  url?: A2UIValue;
  name?: A2UIValue;
  axis?: 'horizontal' | 'vertical';
  // Interactive
  child?: string;
  primary?: boolean;
  action?: A2UIAction;
  label?: A2UIValue;
  binding?: string;
  placeholder?: A2UIValue;
  textFieldType?: 'shortText' | 'longText' | 'email';
  // Text (shorthand direct on component for Text type)
  literalString?: string;
  path?: string;
}

/** Component entry in the flat array */
export interface A2UIComponentEntry {
  id: string;
  component: A2UIComponentDef;
}

/** surfaceUpdate message (agent → client) */
export interface SurfaceUpdateMsg {
  surfaceUpdate: {
    surfaceId: string;
    components: A2UIComponentEntry[];
  };
}

/** beginRendering message (agent → client) */
export interface BeginRenderingMsg {
  beginRendering: {
    surfaceId: string;
    root: string;
  };
}

/** dataModelUpdate message (agent → client) */
export interface DataModelUpdateMsg {
  dataModelUpdate: {
    surfaceId: string;
    data: Record<string, unknown>;
  };
}

/** Union of all A2UI message types */
export type A2UIMessage = SurfaceUpdateMsg | BeginRenderingMsg | DataModelUpdateMsg;

/** Resolved surface state after processing A2UI messages */
export interface SurfaceState {
  surfaceId: string;
  rootComponentId: string | null;
  componentMap: Map<string, A2UIComponentDef>;
  dataModel: Record<string, unknown>;
}

/** User action sent from client to agent */
export interface UserAction {
  name: string;
  surfaceId: string;
  sourceComponentId: string;
  timestamp: string;
  context: Record<string, unknown>;
}

/** Chat message in the UI */
export interface ChatMessage {
  id: string;
  role: 'user' | 'agent';
  text?: string;
  surface?: SurfaceState;
  loading?: boolean;
  error?: string;
}
