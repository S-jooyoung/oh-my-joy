export function track(event: string, payload: Record<string, unknown>): void {
  navigator.sendBeacon('/api/events', JSON.stringify({ event, payload }));
}
