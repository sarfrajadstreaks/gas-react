import React, { type ReactNode } from 'react';
import type { ToastMessage, ToastType } from '../hooks/useToast';

// ─── Toast Container ────────────────────────────────────────────────────────

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

const typeStyles: Record<ToastType, { bg: string; border: string; icon: string }> = {
  success: { bg: '#f0fdf4', border: '#22c55e', icon: '✓' },
  error: { bg: '#fef2f2', border: '#ef4444', icon: '✕' },
  warning: { bg: '#fffbeb', border: '#f59e0b', icon: '⚠' },
  info: { bg: '#eff6ff', border: '#3b82f6', icon: 'ℹ' },
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 20, right: 20, zIndex: 10000,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map((toast) => {
        const s = typeStyles[toast.type];
        return (
          <div
            key={toast.id}
            style={{
              background: s.bg, border: `1px solid ${s.border}`, borderLeft: `4px solid ${s.border}`,
              borderRadius: 8, padding: '12px 16px', minWidth: 280, maxWidth: 400,
              display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              animation: 'slideIn 0.3s ease-out',
            }}
          >
            <span style={{ fontWeight: 600 }}>{s.icon}</span>
            <span style={{ flex: 1, fontSize: 14 }}>{toast.message}</span>
            <button onClick={() => onDismiss(toast.id)} style={{
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, opacity: 0.5,
            }}>×</button>
          </div>
        );
      })}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: string;
}

export function Modal({ isOpen, onClose, title, children, width = '500px' }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'white', borderRadius: 12, maxWidth: width, width: '90vw',
        maxHeight: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        {title && (
          <div style={{
            padding: '16px 20px', borderBottom: '1px solid #e5e7eb',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h3 style={{ margin: 0, fontSize: 18 }}>{title}</h3>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', opacity: 0.5,
            }}>×</button>
          </div>
        )}
        <div style={{ padding: 20, overflow: 'auto', flex: 1 }}>
          {children}
        </div>
      </div>
    </div>
  );
}

// ─── Confirm Dialog ─────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen, title, message,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  variant = 'default', onConfirm, onCancel,
}: ConfirmDialogProps) {
  const btnColor = variant === 'danger' ? '#ef4444' : '#3b82f6';

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} width="400px">
      <p style={{ color: '#666', marginBottom: 20 }}>{message}</p>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={{
          padding: '8px 16px', borderRadius: 6, border: '1px solid #d1d5db',
          background: 'white', cursor: 'pointer',
        }}>{cancelLabel}</button>
        <button onClick={onConfirm} style={{
          padding: '8px 16px', borderRadius: 6, border: 'none',
          background: btnColor, color: 'white', cursor: 'pointer',
        }}>{confirmLabel}</button>
      </div>
    </Modal>
  );
}

// ─── Loader ─────────────────────────────────────────────────────────────────

interface LoaderProps {
  text?: string;
  fullPage?: boolean;
}

export function Loader({ text = 'Loading...', fullPage = false }: LoaderProps) {
  const content = (
    <div style={{ textAlign: 'center', padding: 40, color: '#666' }}>
      <div style={{
        border: '3px solid #f3f3f3', borderTop: '3px solid #3b82f6',
        borderRadius: '50%', width: 40, height: 40,
        animation: 'spin 1s linear infinite', margin: '0 auto 15px',
      }} />
      <p>{text}</p>
    </div>
  );

  if (fullPage) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', width: '100%',
      }}>
        {content}
      </div>
    );
  }

  return content;
}

// ─── Stat Card ──────────────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: string;
  trend?: { value: number; label: string };
  color?: string;
}

export function StatCard({ label, value, icon, trend, color = '#3b82f6' }: StatCardProps) {
  return (
    <div style={{
      background: 'white', borderRadius: 12, padding: 20,
      boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderLeft: `4px solid ${color}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <div>
          <p style={{ color: '#64748b', fontSize: 13, margin: '0 0 4px' }}>{label}</p>
          <p style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>{value}</p>
          {trend && (
            <p style={{
              fontSize: 12, margin: '8px 0 0',
              color: trend.value >= 0 ? '#22c55e' : '#ef4444',
            }}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {icon && <span style={{ fontSize: 28, opacity: 0.3 }}>{icon}</span>}
      </div>
    </div>
  );
}

// ─── Data Table ─────────────────────────────────────────────────────────────

interface Column<T> {
  key: keyof T & string;
  label: string;
  format?: 'currency' | 'date' | 'number' | ((value: unknown, row: T) => ReactNode);
  width?: string;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
}

export function DataTable<T extends Record<string, unknown>>({
  data, columns, onRowClick, emptyMessage = 'No data found',
}: DataTableProps<T>) {
  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8' }}>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  function formatCell(value: unknown, col: Column<T>, row: T): ReactNode {
    if (typeof col.format === 'function') return col.format(value, row);
    if (col.format === 'currency') return `₹${Number(value).toLocaleString()}`;
    if (col.format === 'date') return value ? new Date(String(value)).toLocaleDateString() : '-';
    if (col.format === 'number') return Number(value).toLocaleString();
    return String(value ?? '-');
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col.key} style={{
                padding: '10px 12px', textAlign: 'left', fontSize: 12,
                fontWeight: 600, color: '#64748b', borderBottom: '2px solid #e2e8f0',
                whiteSpace: 'nowrap', width: col.width,
              }}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              onClick={() => onRowClick?.(row)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ''; }}
            >
              {columns.map((col) => (
                <td key={col.key} style={{
                  padding: '10px 12px', fontSize: 14,
                  borderBottom: '1px solid #f1f5f9',
                }}>{formatCell(row[col.key], col, row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
