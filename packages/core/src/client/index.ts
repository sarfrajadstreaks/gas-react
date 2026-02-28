// ─── Client Entry Point ─────────────────────────────────────────────────────
//
// Everything the app's React code needs from the framework.

// Provider
export { GASAppProvider, useAppConfig, useAppAuth } from './providers/GASAppProvider';

// Hooks
export { useExecuteFn } from './hooks/useExecuteFn';
export { useAuth } from './hooks/useAuth';
export { useDataPolling } from './hooks/useDataPolling';
export { useToast } from './hooks/useToast';
export type { ToastType, ToastMessage } from './hooks/useToast';

// Server bridge
export { executeFn } from './lib/execute-fn';

// Components
export {
  ToastContainer,
  Modal,
  ConfirmDialog,
  Loader,
  StatCard,
  DataTable,
} from './components';
