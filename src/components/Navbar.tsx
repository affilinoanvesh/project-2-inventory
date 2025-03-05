import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, ShoppingCart, Package, Settings, DollarSign, Receipt, FileBarChart, Boxes, Calendar, ShoppingBag, Truck, PlusCircle } from 'lucide-react';

const Navbar: React.FC = () => {
  const location = useLocation();
  
  const isActive = (path: string) => {
    return location.pathname === path ? 'bg-blue-700' : '';
  };

  return (
    <nav className="bg-blue-800 text-white h-screen w-56 fixed left-0 top-0 p-4">
      <div className="flex items-center mb-8">
        <DollarSign className="h-7 w-7 mr-2" />
        <h1 className="text-xl font-bold">PetWise</h1>
      </div>
      
      <ul className="space-y-1">
        <li>
          <Link 
            to="/" 
            className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive('/')}`}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            <span className="text-sm">Dashboard</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/orders" 
            className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive('/orders')}`}
          >
            <ShoppingCart className="h-4 w-4 mr-2" />
            <span className="text-sm">Orders</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/products" 
            className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive('/products')}`}
          >
            <Package className="h-4 w-4 mr-2" />
            <span className="text-sm">Products</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/inventory" 
            className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive('/inventory')}`}
          >
            <Boxes className="h-4 w-4 mr-2" />
            <span className="text-sm">Inventory</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/purchase-orders" 
            className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive('/purchase-orders')}`}
          >
            <ShoppingBag className="h-4 w-4 mr-2" />
            <span className="text-sm">Purchase Orders</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/suppliers" 
            className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive('/suppliers')}`}
          >
            <Truck className="h-4 w-4 mr-2" />
            <span className="text-sm">Suppliers</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/expiry" 
            className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive('/expiry')}`}
          >
            <Calendar className="h-4 w-4 mr-2" />
            <span className="text-sm">Expiry Tracking</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/expenses" 
            className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive('/expenses')}`}
          >
            <Receipt className="h-4 w-4 mr-2" />
            <span className="text-sm">Expenses</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/additional-revenue" 
            className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive('/additional-revenue')}`}
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            <span className="text-sm">Additional Revenue</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/reports" 
            className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive('/reports')}`}
          >
            <FileBarChart className="h-4 w-4 mr-2" />
            <span className="text-sm">Reports</span>
          </Link>
        </li>
        <li>
          <Link 
            to="/settings" 
            className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive('/settings')}`}
          >
            <Settings className="h-4 w-4 mr-2" />
            <span className="text-sm">Settings</span>
          </Link>
        </li>
      </ul>
      
      <div className="absolute bottom-4 left-4 right-4 text-xs text-blue-300">
        <p>PetWise v0.1.0</p>
      </div>
    </nav>
  );
};

export default Navbar;