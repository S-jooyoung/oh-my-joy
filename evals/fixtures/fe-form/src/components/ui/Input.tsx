import type { InputHTMLAttributes } from 'react';

export function Input({ id, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input id={id} className="min-h-11 w-full rounded-md border border-gray-100 px-3 text-fg-primary" {...props} />;
}
