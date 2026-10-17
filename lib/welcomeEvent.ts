// lib/welcomeEvent.ts
//
// A one-shot signal from NameSetupModal (finishes first-sign-in name setup)
// to WelcomeModal (shows the "Welcome, {name}!" pop-up) — both are mounted
// globally in components/Providers.tsx, decoupled from whatever page the
// user happens to land on, so this can't rely on either component's mount
// order or the current route.

const WELCOME_EVENT = "gelcards:welcome";

export function dispatchWelcome(name: string) {
  window.dispatchEvent(new CustomEvent<string>(WELCOME_EVENT, { detail: name }));
}

export function onWelcome(handler: (name: string) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  window.addEventListener(WELCOME_EVENT, listener);
  return () => window.removeEventListener(WELCOME_EVENT, listener);
}
