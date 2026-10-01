const entries = [];

export function recordAccess(userId, action) {
  entries.push({ userId, action, at: new Date().toISOString() });
}

export function accessLog() {
  return entries.slice();
}
