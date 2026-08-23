import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import { LanguageProvider } from './lib/language';
import './styles/global.scss';
import './parivahan_extracted.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
);

