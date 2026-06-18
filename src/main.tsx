/// <reference types="vite/client" />
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/globals.css';

// GitHub Pages 子路径部署：basename 跟 vite.config.ts 的 base 保持一致
// D7 修：dev 和 prod 都用 BASE_URL（Vite dev server 也会以 /ganntlens/ 为入口，
// 访问 http://localhost:5173/ 也会被 Vite 改写到 /ganntlens/，否则 React Router 找不到 route）
const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter basename={basename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
