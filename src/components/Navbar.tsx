import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { BarChart3, ShoppingCart, Package, Settings, DollarSign, Receipt, FileBarChart, Boxes, Calendar, ShoppingBag, Truck, PlusCircle, ChevronDown, ChevronRight } from 'lucide-react';

// Define the navigation structure with parent-child relationships
const navigationItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    path: '/',
    icon: BarChart3,
  },
  {
    id: 'reports',
    label: 'Reports',
    path: '/reports',
    icon: FileBarChart,
  },
  {
    id: 'inventory',
    label: 'Inventory',
    icon: Boxes,
    children: [
      { id: 'products', label: 'Products', path: '/products', icon: Package },
      { id: 'inventory-management', label: 'Inventory Management', path: '/inventory', icon: Boxes },
      { id: 'expiry', label: 'Expiry Tracking', path: '/expiry', icon: Calendar },
    ]
  },
  {
    id: 'purchasing',
    label: 'Purchasing',
    icon: ShoppingBag,
    children: [
      { id: 'purchase-orders', label: 'Purchase Orders', path: '/purchase-orders', icon: ShoppingBag },
      { id: 'suppliers', label: 'Suppliers', path: '/suppliers', icon: Truck },
    ]
  },
  {
    id: 'sales',
    label: 'Sales',
    icon: ShoppingCart,
    children: [
      { id: 'orders', label: 'Orders', path: '/orders', icon: ShoppingCart },
      { id: 'additional-revenue', label: 'Additional Revenue', path: '/additional-revenue', icon: PlusCircle },
    ]
  },
  {
    id: 'finance',
    label: 'Finance',
    icon: DollarSign,
    children: [
      { id: 'expenses', label: 'Expenses', path: '/expenses', icon: Receipt },
    ]
  },
  {
    id: 'settings',
    label: 'Settings',
    path: '/settings',
    icon: Settings,
  },
];

const Navbar: React.FC = () => {
  const location = useLocation();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  
  // Check if a path is active
  const isActive = (path: string) => {
    return location.pathname === path ? 'bg-blue-700' : '';
  };

  // Check if a section should be expanded based on current path
  React.useEffect(() => {
    const newExpandedSections = { ...expandedSections };
    
    navigationItems.forEach(item => {
      if (item.children) {
        const shouldExpand = item.children.some(child => child.path === location.pathname);
        if (shouldExpand) {
          newExpandedSections[item.id] = true;
        }
      }
    });
    
    setExpandedSections(newExpandedSections);
  }, [location.pathname]);

  // Toggle a section's expanded state
  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionId]: !prev[sectionId]
    }));
  };

  return (
    <nav className="bg-blue-800 text-white h-screen w-56 fixed left-0 top-0 p-4 overflow-y-auto">
      <div className="flex items-center mb-8">
        <DollarSign className="h-7 w-7 mr-2" />
        <h1 className="text-xl font-bold">PetWise</h1>
      </div>
      
      <ul className="space-y-1">
        {navigationItems.map(item => (
          <li key={item.id}>
            {item.children ? (
              <div>
                <button
                  onClick={() => toggleSection(item.id)}
                  className="w-full flex items-center justify-between p-2 rounded-md hover:bg-blue-700 transition-colors"
                >
                  <div className="flex items-center">
                    <item.icon className="h-4 w-4 mr-2" />
                    <span className="text-sm">{item.label}</span>
                  </div>
                  {expandedSections[item.id] ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                
                {expandedSections[item.id] && (
                  <ul className="ml-4 mt-1 space-y-1">
                    {item.children.map(child => (
                      <li key={child.id}>
                        <Link
                          to={child.path}
                          className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive(child.path)}`}
                        >
                          <child.icon className="h-4 w-4 mr-2" />
                          <span className="text-sm">{child.label}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <Link
                to={item.path}
                className={`flex items-center p-2 rounded-md hover:bg-blue-700 transition-colors ${isActive(item.path)}`}
              >
                <item.icon className="h-4 w-4 mr-2" />
                <span className="text-sm">{item.label}</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
      
      <div className="absolute bottom-4 left-4 right-4 text-xs text-blue-300">
        <p>PetWise v0.1.0</p>
      </div>
    </nav>
  );
};

export default Navbar;