import React from 'react';
import {
  DataTable,
  Loader,
  useExecuteFn,
  useAppAuth,
} from '@gas-framework/core/client';
import type { ToastType } from '@gas-framework/core/client';

interface Item {
  id: string;
  name: string;
  category: string;
  quantity: number;
  notes: string;
}

interface ItemsProps {
  showToast: (message: string, type?: ToastType) => void;
}

export function Items({ showToast }: ItemsProps) {
  const { token } = useAppAuth();
  const { data, loading, refetch } = useExecuteFn<Item[]>('getItems', [token]);

  if (loading) return <Loader text="Loading items..." fullPage />;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2>Items</h2>
        <button
          onClick={() => {
            showToast('Create item form — build your own!', 'info');
          }}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: '#3b82f6', color: 'white', fontWeight: 600, cursor: 'pointer',
          }}
        >
          + New Item
        </button>
      </div>

      <div style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
        <DataTable<Item>
          data={data ?? []}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'category', label: 'Category' },
            { key: 'quantity', label: 'Qty', format: 'number' },
            { key: 'notes', label: 'Notes' },
          ]}
          onRowClick={(item) => showToast(`Clicked: ${item.name}`, 'info')}
          emptyMessage="No items yet. Click '+ New Item' to add one."
        />
      </div>
    </div>
  );
}
