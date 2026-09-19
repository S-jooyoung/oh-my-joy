'use client';

import { useEffect, useState } from 'react';
import { track } from '../lib/analytics';

type CartItem = { id: string; name: string; price: number; quantity: number };
type Coupon = { code: string; percentOff: number };

export function useCheckout(userId: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/cart?user=${userId}`)
      .then((res) => res.json())
      .then((data: CartItem[]) => {
        setItems(data);
        setLoading(false);
        track('checkout_viewed', { userId, count: data.length });
      });
  }, [userId]);

  async function applyCoupon(code: string) {
    if (code.length < 4 || code.length > 12 || !/^[A-Z0-9]+$/.test(code)) {
      setCouponError('Invalid coupon format');
      track('coupon_rejected', { userId, code, reason: 'format' });
      return;
    }
    const res = await fetch(`/api/coupons/${code}`);
    if (!res.ok) {
      setCouponError('Coupon not found');
      track('coupon_rejected', { userId, code, reason: 'not_found' });
      return;
    }
    const found: Coupon = await res.json();
    setCoupon(found);
    setCouponError(null);
    track('coupon_applied', { userId, code });
  }

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const total = coupon ? subtotal - (subtotal * coupon.percentOff) / 100 : subtotal;
  const formattedTotal = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(total / 100);

  return { items, loading, total, formattedTotal, coupon, couponError, applyCoupon };
}
