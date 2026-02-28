import React from 'react';
import { StatCard, Loader, useExecuteFn } from '@gas-framework/core/client';

export function Dashboard() {
  const { data, loading } = useExecuteFn<Record<string, unknown>[]>('getItems', [], {
    manual: false,
  });

  if (loading) return <Loader text="Loading dashboard..." fullPage />;

  const itemCount = data?.length ?? 0;

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ marginBottom: 20 }}>Dashboard</h2>
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
      }}>
        <StatCard label="Total Items" value={itemCount} icon="📦" color="#3b82f6" />
        <StatCard label="Active Users" value="-" icon="👥" color="#22c55e" />
        <StatCard label="Status" value="Online" icon="✓" color="#8b5cf6" />
      </div>
    </div>
  );
}
