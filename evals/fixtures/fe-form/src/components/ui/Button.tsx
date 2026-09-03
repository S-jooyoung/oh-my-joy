import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary';

export function Button({ variant = 'primary', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  const tone = variant === 'primary' ? 'bg-brand-primary text-surface-default' : 'bg-surface-default text-fg-primary';
  return <button className={`min-h-11 w-full rounded-md px-4 ${tone}`} {...props} />;
}
