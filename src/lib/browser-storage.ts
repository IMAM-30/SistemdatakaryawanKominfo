// Preferences are optional: browser privacy settings or storage limits must not
// interrupt authentication, navigation, or in-memory UI state.
export function getStoredPreference(key: string): string | null {
  try { return typeof window === "undefined" ? null : window.localStorage.getItem(key); }
  catch { return null; }
}

export function setStoredPreference(key: string, value: string): void {
  try { if (typeof window !== "undefined") window.localStorage.setItem(key, value); }
  catch { /* Keep the current preference in component state when persistence is unavailable. */ }
}
