import { NextResponse } from 'next/server';
import { createOrder } from '../../../lib/orders';

export async function POST(request: Request) {
  const body = await request.json();
  const order = await createOrder(body);
  return NextResponse.json(order, { status: 201 });
}
