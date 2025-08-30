
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css'      // <--- thêm dòng này

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Không tìm thấy phần tử root để gắn ứng dụng");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
