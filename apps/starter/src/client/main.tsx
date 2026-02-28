import React from 'react';
import ReactDOM from 'react-dom/client';
import { GASAppProvider } from '@gas-framework/core/client';
import { appConfig } from '../app.config';
import { App } from './App';
import './styles/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GASAppProvider config={appConfig}>
      <App />
    </GASAppProvider>
  </React.StrictMode>
);
