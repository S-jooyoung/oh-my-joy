export type NewOrder = { productId: string; quantity: number; couponCode?: string };

export async function createOrder(input: NewOrder): Promise<{ id: string }> {
  const res = await fetch('https://orders.internal/orders', { method: 'POST', body: JSON.stringify(input) });
  return res.json();
}
