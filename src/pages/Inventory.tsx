import React, { useState, useEffect } from 'react';
import { InventoryItem, Product } from '../types';
import { fetchProducts, fetchInventory, hasApiCredentials } from '../services/api';

// Import components
import InventoryFilters from '../components/inventory/InventoryFilters';
import InventoryTable from '../components/inventory/InventoryTable';
import InventoryStats from '../components/inventory/InventoryStats';
import InventorySummary from '../components/inventory/InventorySummary';
import { calculateTotals, Tooltip } from '../components/inventory/InventoryUtils';

const Inventory: React.FC = () => {
  // State for inventory data
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredInventory, setFilteredInventory] = useState<InventoryItem[]>([]);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [productTypeFilter, setProductTypeFilter] = useState<'all' | 'simple' | 'variation'>('all');
  
  // Sorting state
  const [sortField, setSortField] = useState<keyof InventoryItem>('sku');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  // Summary values - calculated from filtered inventory
  const [summaryValues, setSummaryValues] = useState({
    totalRetailValue: 0,
    totalCostValue: 0,
    potentialProfit: 0
  });
  
  // Projections
  const [showProjections, setShowProjections] = useState(false);
  const [projectionMonths, setProjectionMonths] = useState(3);
  const [projectionData, setProjectionData] = useState<{
    month: string;
    retailValue: number;
    costValue: number;
    profit: number;
  }[]>([]);

  // Load data on component mount
  useEffect(() => {
    loadInventoryData();
  }, []);
  
  // Update summary values when filtered inventory changes
  useEffect(() => {
    const totals = calculateTotals(filteredInventory);
    setSummaryValues(totals);
  }, [filteredInventory]);

  // Load inventory data from local storage or API if needed
  const loadInventoryData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First try to get data from local storage
      const storedProducts = localStorage.getItem('products');
      const storedInventory = localStorage.getItem('inventory');
      
      if (storedProducts && storedInventory) {
        // Use data from local storage
        const productsData = JSON.parse(storedProducts);
        const inventoryData = JSON.parse(storedInventory);
        
        setProducts(productsData);
        
        // Process inventory data
        const processedInventory = processInventoryData(inventoryData, productsData);
        setInventory(processedInventory);
        setFilteredInventory(processedInventory);
        
        setLoading(false);
        return;
      }
      
      // If no local data, check if API credentials are set
      const hasCredentials = await hasApiCredentials();
      if (!hasCredentials) {
        setError('No local data found and API credentials not set. Please configure them in Settings and sync data.');
        setLoading(false);
        return;
      }
      
      // Fetch products and inventory data from API
      const [productsData, inventoryData] = await Promise.all([
        fetchProducts(),
        fetchInventory()
      ]);
      
      // Save to local storage for future use
      localStorage.setItem('products', JSON.stringify(productsData));
      localStorage.setItem('inventory', JSON.stringify(inventoryData));
      
      setProducts(productsData);
      
      // Process inventory data
      const processedInventory = processInventoryData(inventoryData, productsData);
      setInventory(processedInventory);
      setFilteredInventory(processedInventory);
      
      setLoading(false);
    } catch (err) {
      console.error('Error loading inventory data:', err);
      setError('Failed to load inventory data. Please try again or sync data from Settings.');
      setLoading(false);
    }
  };

  // Process inventory data to calculate values
  const processInventoryData = (inventoryData: InventoryItem[], productsData: Product[]): InventoryItem[] => {
    return inventoryData.map(item => {
      // Find the corresponding product or variation
      const product = productsData.find(p => p.id === item.product_id);
      
      if (!product) return item;
      
      let stockQuantity = 0;
      let price = 0;
      let regularPrice = 0;
      let salePrice = 0;
      
      if (item.variation_id) {
        // This is a variation
        const variation = product.productVariations?.find(v => v.id === item.variation_id);
        if (variation) {
          stockQuantity = variation.stock_quantity ?? 0;
          price = variation.price ?? 0;
          regularPrice = variation.regular_price ?? variation.price ?? 0;
          salePrice = variation.sale_price ?? 0;
        }
      } else {
        // This is a simple product
        stockQuantity = product.stock_quantity ?? 0;
        price = product.price ?? 0;
        regularPrice = product.regular_price ?? product.price ?? 0;
        salePrice = product.sale_price ?? 0;
      }
      
      // Calculate values - use supplier_price if available, otherwise use cost_price
      const costPrice = item.supplier_price ?? item.cost_price ?? 0;
      const retailPrice = salePrice > 0 ? salePrice : regularPrice;
      const retailValue = stockQuantity * retailPrice;
      const costValue = stockQuantity * costPrice;
      
      return {
        ...item,
        stock_quantity: stockQuantity,
        retail_value: retailValue,
        cost_value: costValue,
        regular_price: regularPrice,
        sale_price: salePrice,
        price: price
      };
    });
  };

  // Calculate inventory projections based on current inventory and estimated sales
  const calculateProjections = () => {
    const months = [];
    const currentDate = new Date();
    
    // Assume a 10% monthly sales rate for projection purposes
    const monthlySalesRate = 0.10;
    
    // Start with current inventory values
    let currentRetailValue = summaryValues.totalRetailValue;
    let currentCostValue = summaryValues.totalCostValue;
    
    // Generate projections for the specified number of months
    for (let i = 1; i <= projectionMonths; i++) {
      const projectionDate = new Date(currentDate);
      projectionDate.setMonth(currentDate.getMonth() + i);
      
      // Calculate projected values based on monthly sales rate
      const salesAmount = currentRetailValue * monthlySalesRate;
      const costAmount = currentCostValue * monthlySalesRate;
      
      // Reduce inventory values for next month
      currentRetailValue -= salesAmount;
      currentCostValue -= costAmount;
      
      months.push({
        month: projectionDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
        retailValue: currentRetailValue,
        costValue: currentCostValue,
        profit: currentRetailValue - currentCostValue
      });
    }
    
    setProjectionData(months);
  };

  // Update projections when summary values or projection months change
  useEffect(() => {
    if (showProjections) {
      calculateProjections();
    }
  }, [showProjections, projectionMonths, summaryValues]);

  // Handle projection months change
  const handleProjectionMonthsChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setProjectionMonths(parseInt(e.target.value));
  };

  // Handle product type filter change
  const handleProductTypeFilterChange = (filter: 'all' | 'simple' | 'variation') => {
    setProductTypeFilter(filter);
    applyFilters(searchTerm, stockFilter, filter);
  };

  // Handle search input change
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    applyFilters(value, stockFilter, productTypeFilter);
  };

  // Handle stock filter change
  const handleStockFilterChange = (filter: 'all' | 'in_stock' | 'out_of_stock') => {
    setStockFilter(filter);
    applyFilters(searchTerm, filter, productTypeFilter);
  };

  // Apply all filters to inventory
  const applyFilters = (
    search: string, 
    stockStatus: 'all' | 'in_stock' | 'out_of_stock',
    productType: 'all' | 'simple' | 'variation'
  ) => {
    let filtered = [...inventory];
    
    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(item => {
        const product = products.find(p => p.id === item.product_id);
        const productName = product ? product.name.toLowerCase() : '';
        const sku = item.sku ? item.sku.toLowerCase() : '';
        
        return productName.includes(searchLower) || sku.includes(searchLower);
      });
    }
    
    // Apply stock status filter
    if (stockStatus === 'in_stock') {
      filtered = filtered.filter(item => (item.stock_quantity || 0) > 0);
    } else if (stockStatus === 'out_of_stock') {
      filtered = filtered.filter(item => (item.stock_quantity || 0) === 0);
    }
    
    // Apply product type filter
    if (productType === 'simple') {
      filtered = filtered.filter(item => !item.variation_id);
    } else if (productType === 'variation') {
      filtered = filtered.filter(item => !!item.variation_id);
    }
    
    setFilteredInventory(filtered);
  };

  // Handle sorting
  const handleSort = (field: keyof InventoryItem) => {
    // If clicking the same field, toggle direction
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // If clicking a new field, set it as the sort field with ascending direction
      setSortField(field);
      setSortDirection('asc');
    }
  };

  // Get sorted inventory
  const getSortedInventory = () => {
    return [...filteredInventory].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      
      // Handle undefined values
      if (aValue === undefined && bValue === undefined) return 0;
      if (aValue === undefined) return sortDirection === 'asc' ? 1 : -1;
      if (bValue === undefined) return sortDirection === 'asc' ? -1 : 1;
      
      // Compare values
      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Loading state
  if (loading) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Inventory</h1>
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold mb-6">Inventory</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 relative">
      <h1 className="text-2xl font-bold mb-6">Inventory</h1>
      
      {/* Data sync note */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              This page displays inventory data from local storage. To sync with the latest data from WooCommerce, go to <a href="/settings" className="font-medium underline">Settings</a> and use the sync options.
            </p>
          </div>
        </div>
      </div>
      
      {/* Summary Cards */}
      <InventorySummary 
        totalRetailValue={summaryValues.totalRetailValue}
        totalCostValue={summaryValues.totalCostValue}
        potentialProfit={summaryValues.potentialProfit}
      />
      
      {/* Projections Toggle */}
      <div className="mb-6">
        <button
          onClick={() => setShowProjections(!showProjections)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded flex items-center"
        >
          {showProjections ? 'Hide Projections' : 'Show Inventory Projections'}
        </button>
      </div>
      
      {/* Projections Section */}
      {showProjections && (
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center space-x-2">
              <h2 className="text-lg font-semibold">Inventory Projections</h2>
              <Tooltip text="Estimated future inventory values based on a 10% monthly sales rate. This helps forecast how your inventory value will change over time if current sales patterns continue." />
            </div>
            <div className="flex items-center">
              <label htmlFor="projectionMonths" className="mr-2 text-sm flex items-center">
                <span>Months:</span>
                <div className="ml-1">
                  <Tooltip text="Number of months to project into the future" />
                </div>
              </label>
              <select
                id="projectionMonths"
                value={projectionMonths}
                onChange={handleProjectionMonthsChange}
                className="border rounded p-1"
              >
                {[1, 2, 3, 6, 12].map(month => (
                  <option key={month} value={month}>{month}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center space-x-1">
                      <span>Month</span>
                      <Tooltip text="Future month for the projection" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center space-x-1">
                      <span>Projected Retail Value</span>
                      <Tooltip text="Estimated total retail value of inventory after projected sales" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center space-x-1">
                      <span>Projected Cost Value</span>
                      <Tooltip text="Estimated total cost value of inventory after projected sales" />
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center space-x-1">
                      <span>Projected Profit</span>
                      <Tooltip text="Estimated potential profit from remaining inventory after projected sales" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {projectionData.map((data, index) => (
                  <tr key={index}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{data.month}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.retailValue)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.costValue)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(data.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-sm text-gray-500 italic">
            <div className="flex items-center space-x-1">
              <span>Note: Projections assume a 10% monthly sales rate based on current inventory values.</span>
              <Tooltip text="This is a simplified model that assumes 10% of your current inventory (by value) will be sold each month. Actual results may vary based on seasonality, promotions, and other factors." />
            </div>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <InventoryFilters 
        searchTerm={searchTerm}
        stockFilter={stockFilter}
        productTypeFilter={productTypeFilter}
        onSearch={handleSearch}
        onStockFilterChange={handleStockFilterChange}
        onProductTypeFilterChange={handleProductTypeFilterChange}
        onRefresh={loadInventoryData}
      />
      
      {/* Inventory Table */}
      <InventoryTable 
        inventory={getSortedInventory()}
        products={products}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        formatCurrency={(amount) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)}
        calculateProfitMargin={(retailPrice, costPrice, stockQuantity) => {
          // If there's no stock, return "N/A"
          if (stockQuantity <= 0) {
            return <span className="text-gray-400">N/A</span>;
          }
          
          // If cost price is zero, handle specially
          if (costPrice <= 0) {
            return <span className="text-green-600 font-medium">100.00%</span>; // Assuming 100% profit if no cost
          }
          
          // Calculate margin
          const margin = ((retailPrice - costPrice) / retailPrice) * 100;
          
          // Handle edge cases
          if (isNaN(margin) || !isFinite(margin)) {
            return <span className="text-gray-500">0.00%</span>;
          }
          
          // Color code based on margin
          let colorClass = "text-red-600"; // Default for low margins
          
          if (margin >= 50) {
            colorClass = "text-green-600";
          } else if (margin >= 30) {
            colorClass = "text-green-500";
          } else if (margin >= 20) {
            colorClass = "text-yellow-600";
          } else if (margin >= 10) {
            colorClass = "text-orange-500";
          }
          
          return <span className={colorClass}>{margin.toFixed(2)}%</span>;
        }}
      />
      
      {/* Inventory Stats */}
      <InventoryStats 
        inventory={inventory}
        filteredInventory={filteredInventory}
      />
    </div>
  );
};

export default Inventory; 