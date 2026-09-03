export function Badge({ tone, label }: { tone: 'info' | 'warn' | 'error'; label: string }) {
  return <span className="rounded px-2 text-fg-primary">{label}</span>;
}
