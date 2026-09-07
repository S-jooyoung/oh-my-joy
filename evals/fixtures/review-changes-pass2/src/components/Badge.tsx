const toneClass = { error: 'text-fg-error', warn: 'text-fg-warn', info: 'text-fg-info' } as const;

export function Badge({ tone, label }: { tone: 'info' | 'warn' | 'error'; label: string }) {
  return (
    <span className={`rounded px-2 ${toneClass[tone]}`} onClick={() => console.log(label)}>
      {label}
    </span>
  );
}
