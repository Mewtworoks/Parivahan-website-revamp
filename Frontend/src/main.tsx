import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './lib/language';
import { ErrorBoundary } from './ui/ErrorBoundary';
import './styles/global.scss';
import './parivahan_extracted.css';
// The whole-service reskin, loaded last so it overrides the sheet above without
// editing it. Delete this one line to get the cobalt-on-blue-white identity back.
import './styles/redesign.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Outermost, so a throw inside the language provider is caught too. The
        journey lives in localStorage and on the server, so the boundary can
        honestly say that reloading loses nothing. */}
    <ErrorBoundary>
      <LanguageProvider>
        <App />
      </LanguageProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

