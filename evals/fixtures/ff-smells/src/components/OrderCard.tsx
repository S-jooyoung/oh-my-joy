type Order = {
  id: string;
  productName: string;
  thumbnailUrl: string;
  status: 'paid' | 'shipped' | 'delivered' | 'cancelled';
  orderedAt: number;
  total: number;
};

export function OrderCard({ order, onSelect }: { order: Order; onSelect: (id: string) => void }) {
  return (
    <div className="flex gap-3 rounded-md border p-3" onClick={() => onSelect(order.id)}>
      <img src={order.thumbnailUrl} className="h-16 w-16 rounded" />
      <div className="flex flex-col">
        <p className="text-fg-primary">{order.productName}</p>
        <p className="text-sm">
          {order.status === 'cancelled'
            ? 'Cancelled'
            : order.status === 'delivered'
              ? Date.now() - order.orderedAt > 604800000
                ? 'Purchase confirmed'
                : 'Delivered'
              : order.status === 'shipped'
                ? 'On the way'
                : 'Paid'}
        </p>
        <p className="text-sm">
          {order.status === 'delivered' && Date.now() - order.orderedAt > 604800000 ? 'Return window closed' : 'Returns available'}
        </p>
        <p className="font-semibold">{order.total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
      </div>
    </div>
  );
}
