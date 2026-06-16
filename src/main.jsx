// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { AuthProvider }  from './contexts/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import App from './App.jsx';
import './index.css';
import { db } from './db';


ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    </AuthProvider>
  </React.StrictMode>
) 
