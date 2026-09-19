type PriceTagProps = { amount: number; currency: string; locale: string };

export function PriceTag({ amount, currency, locale }: PriceTagProps) {
  const formatted = new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount);
  return <span className="font-semibold text-fg-primary">{formatted}</span>;
}
