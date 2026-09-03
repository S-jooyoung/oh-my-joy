export function Badge({ tone, label }: { tone: 'info' | 'warn' | 'error'; label: string }) {
  const color = tone === 'error' ? '#e5484d' : tone === 'warn' ? '#f5a623' : '#3182f6';
  return (
    <span style={{ color }} className="rounded px-2" onClick={() => console.log(label)}>
      {label}
    </span>
  );
}
