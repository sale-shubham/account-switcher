import type { ActionResult } from './api';

// What the busy overlay shows while an action runs.
export interface Busy {
  text: string;
  hint?: string;
}

// App's action runner: shows the overlay, records the result in Activity, then refreshes the status.
export type Run = (title: string, busy: Busy | null, action: () => Promise<ActionResult>) => Promise<ActionResult | null>;

// GitHub actions close GitHub Desktop and VS Code, which may ask about unsaved work.
export const appsHint = 'If an app asks about unsaved changes, answer it there. The switcher waits up to 20 seconds per app.';
