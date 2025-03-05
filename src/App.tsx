import React, { useEffect } from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import TimeDisplay from './components/TimeDisplay';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import Products from './pages/Products';
import Settings from './pages/Settings';
import Expenses from './pages/Expenses';
import Reports from './pages/Reports';
import Inventory from './pages/Inventory';
import ProductExpiry from './pages/expiry';
import PurchaseOrders from './pages/PurchaseOrders';
import SuppliersPage from './components/suppliers/SuppliersPage';
import AdditionalRevenuePage from './pages/AdditionalRevenue';
import { db } from './db';

function App() {
  useEffect(() => {
    // Initialize the database when the app starts
    const initDb = async () => {
      try {
        await db.initializeDatabase();
        console.log('Database initialized on app start');
      } catch (error) {
        console.error('Failed to initialize database on app start:', error);
      }
    };
    
    initDb();
  }, []);

  return (
    <Router>
      <div className="flex min-h-screen bg-gray-100">
        <Navbar />
        <div className="flex-1 ml-56">
          <div className="px-6 py-3 bg-white shadow-sm border-b">
            <TimeDisplay />
          </div>
          <div className="p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/orders" element={<Orders />} />
              <Route path="/products" element={<Products />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/additional-revenue" element={<AdditionalRevenuePage />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/expiry" element={<ProductExpiry />} />
              <Route path="/purchase-orders" element={<PurchaseOrders />} />
              <Route path="/suppliers" element={<SuppliersPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}

export default App;