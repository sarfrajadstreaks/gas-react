import React, { useState } from 'react';
import {
  useAppAuth,
  useAppConfig,
  useToast,
  ToastContainer,
} from '@gas-framework/core/client';
import { LoginPage } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Items } from './pages/Items';

export function App() {
  const { isAuthenticated } = useAppAuth();
  const config = useAppConfig();
  const { toasts, showToast, dismissToast } = useToast();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  const pages: Record<string, React.ReactNode> = {
    dashboard: <Dashboard />,
    items: <Items showToast={showToast} />,
    settings: <div style={{ padding: 40 }}>Settings page — coming soon</div>,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Navigation */}
      <nav style={{
        background: 'white', padding: '0 24px', height: 56,
        display: 'flex', alignItems: 'center', gap: 24,
        borderBottom: '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <span style={{ fontWeight: 700, fontSize: 18, marginRight: 'auto' }}>
          {config.name}
        </span>
        {config.pages.map((page) => (
          <button
            key={page.id}
            onClick={() => setCurrentPage(page.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 12px', borderRadius: 6, fontSize: 14,
              fontWeight: currentPage === page.id ? 600 : 400,
              color: currentPage === page.id ? '#3b82f6' : '#64748b',
              borderBottom: currentPage === page.id ? '2px solid #3b82f6' : '2px solid transparent',
            }}
          >
            {page.icon} {page.label}
          </button>
        ))}
      </nav>

      {/* Page content */}
      <main style={{ flex: 1, overflow: 'auto', background: '#f8fafc' }}>
        {pages[currentPage] ?? pages.dashboard}
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
