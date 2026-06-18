/// <reference types="vite/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

// GitHub Pages 子路径部署：basename 跟 vite.config.ts 的 base 保持一致
// 本地 dev 时 basename='/'（访问 localhost:5173/），生产 basename='/ganntlens'
const basename = import.meta.env.PROD
  ? (import.meta.env.BASE_URL.replace(/\/$/, '') || '/ganntlens')
  : '/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
