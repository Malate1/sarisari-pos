// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './ProtectedRoute';
import App from './App.jsx'
import './index.css'
import { db } from './db.js'

// Simple script to pre-fill products if the database is completely empty
const seedDatabase = async () => {
  const count = await db.inventory.count();
  if (count === 0) {
    await db.inventory.bulkAdd([
      { name: 'Lucky Me Pancit Canton Extra Hot', barcode: '4800016644781', costPrice: 12.00, sellingPrice: 15.00, stock: 24 },
      { name: 'Coca-Cola Mismo 290ml', barcode: '4800002101113', costPrice: 16.00, sellingPrice: 20.00, stock: 12 },
      { name: 'Nescafé 3-in-1 Original Sachet', barcode: '4800092111009', costPrice: 7.50, sellingPrice: 9.00, stock: 30 },
      { name: 'Silver Swan Soy Sauce 200ml', barcode: '4800013111026', costPrice: 11.00, sellingPrice: 14.00, stock: 10 }
    ]);
    console.log("Offline database seeded with sample products.");
  }
};

seedDatabase();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthProvider>
      <ProtectedRoute>
        <App />
      </ProtectedRoute>
    </AuthProvider>
  </React.StrictMode>
)