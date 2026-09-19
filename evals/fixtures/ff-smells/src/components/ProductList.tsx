'use client';

import { useEffect, useState } from 'react';
import { track } from '../lib/analytics';

type Product = { id: string; name: string; price: number };

async function getItems(page: number): Promise<Product[]> {
  const res = await fetch(`/api/products?page=${page}&size=24`);
  const items: Product[] = await res.json();
  track('product_list_viewed', { page, count: items.length });
  return items;
}

export function ProductList({ onOpen }: { onOpen: (id: string) => void }) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Product[]>([]);

  useEffect(() => {
    getItems(page).then((next) => setItems((prev) => [...prev, ...next]));
  }, [page]);

  return (
    <section>
      <ul className="grid grid-cols-2 gap-3">
        {items.map((item, index) => (
          <li key={index} className="rounded-md border p-3" onClick={() => onOpen(item.id)}>
            <span>{item.name}</span>
            <span>{item.price}</span>
          </li>
        ))}
      </ul>
      {items.length % 24 === 0 && items.length > 0 ? (
        <button type="button" onClick={() => setPage(page + 1)}>
          Load more
        </button>
      ) : null}
    </section>
  );
}
