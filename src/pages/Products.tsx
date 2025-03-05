import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, ChevronUp, Edit, Save, X, ChevronRight, Upload, AlertCircle } from 'lucide-react';
import { Product, ProductVariation, SupplierPriceItem } from '../types';
import { 
  fetchProducts, 
  fetchInventory, 
  hasApiCredentials, 
  updateProductCostPrice 
} from '../services/api';
import { processSupplierPriceData, getSupplierImports } from '../db/operations/supplier';
import ProductTable from '../components/ProductTable';
import SupplierImportForm from '../components/SupplierImportForm';

const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showImportForm, setShowImportForm] = useState(false);
  const [recentImports, setRecentImports] = useState<{
    id?: number;
    date: string;
    supplier: string;
    filename: string;
    updated: number;
    skipped: number;
  }[]>([]);

  // Sorting
  const [sortField, setSortField] = useState<keyof Product>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const loadProductData = async () => {
    try {
      // Fetch products and inventory data
      const productsData = await fetchProducts();
      const inventoryData = await fetchInventory();
      
      console.log(`Loaded ${productsData.length} products and ${inventoryData.length} inventory items`);
      
      // Merge product data with inventory cost data
      const mergedProducts = productsData.map(product => {
        // Find inventory items for this product (excluding variations)
        const inventoryItem = inventoryData.find(
          item => item.product_id === product.id && !item.variation_id
        );
        
        // If this is a variable product, also find inventory items for variations
        if (product.type === 'variable' && product.productVariations) {
          product.productVariations = product.productVariations.map(variation => {
            const variationInventory = inventoryData.find(
              item => item.product_id === product.id && item.variation_id === variation.id
            );
            
            return {
              ...variation,
              cost_price: variationInventory?.cost_price || variation.cost_price || 0,
              supplier_price: variationInventory?.supplier_price || variation.supplier_price || 0,
              supplier_name: variationInventory?.supplier_name || variation.supplier_name || '',
              supplier_updated: variationInventory?.supplier_updated || variation.supplier_updated
            };
          });
        }
        
        return {
          ...product,
          cost_price: inventoryItem?.cost_price || product.cost_price || 0,
          supplier_price: inventoryItem?.supplier_price || product.supplier_price || 0,
          supplier_name: inventoryItem?.supplier_name || product.supplier_name || '',
          supplier_updated: inventoryItem?.supplier_updated || product.supplier_updated
        };
      });
      
      setProducts(mergedProducts);
      setFilteredProducts(mergedProducts);
      
      return mergedProducts;
    } catch (error) {
      console.error('Error loading product data:', error);
      throw error;
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Check if API credentials are set
        const hasCredentials = await hasApiCredentials();
        if (!hasCredentials) {
          setError('API credentials not set. Please go to Settings to configure your WooCommerce API credentials.');
          setLoading(false);
          return;
        }
        
        await loadProductData();
        
        // Load recent imports
        const imports = await getSupplierImports();
        setRecentImports(imports.map(imp => ({
          id: imp.id,
          date: new Date(imp.date).toLocaleDateString(),
          supplier: imp.supplier_name,
          filename: imp.filename,
          updated: imp.items_updated,
          skipped: imp.items_skipped
        })).slice(0, 5));
      } catch (error) {
        console.error('Error loading products data:', error);
        setError('Failed to load products data. Please check your API credentials and try again.');
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Filter products when search term changes
  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredProducts(products);
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = products.filter(product => {
        // Check if product name or SKU matches
        const productMatches = 
          product.name.toLowerCase().includes(term) ||
          (product.sku && product.sku.toLowerCase().includes(term));
          
        // Check if any variation matches
        const variationMatches = product.productVariations?.some(
          variation => 
            variation.name.toLowerCase().includes(term) ||
            (variation.sku && variation.sku.toLowerCase().includes(term))
        );
        
        return productMatches || variationMatches;
      });
      
      setFilteredProducts(filtered);
    }
  }, [searchTerm, products]);

  const handleSort = (field: keyof Product) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleImportSuccess = async (updatedImports: any) => {
    // Update recent imports list
    setRecentImports(updatedImports);
    
    // Reload products to show updated supplier prices
    try {
      const updatedProducts = await loadProductData();
      console.log(`Reloaded ${updatedProducts.length} products after import`);
    } catch (error) {
      console.error('Error reloading products after import:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6">
          <strong className="font-bold">Error:</strong>
          <span className="block sm:inline"> {error}</span>
        </div>
      </div>
    );
  }

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aValue: any = a[sortField];
    let bValue: any = b[sortField];
    
    // Handle special cases for numeric fields
    if (sortField === 'price' || sortField === 'cost_price' || sortField === 'stock_quantity' || 
        sortField === 'regular_price' || sortField === 'sale_price' || sortField === 'supplier_price') {
      aValue = aValue || 0;
      bValue = bValue || 0;
    }
    
    if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <h1 className="text-2xl font-bold">Products</h1>
        
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button
            onClick={() => setShowImportForm(true)}
            className="flex items-center text-sm bg-indigo-600 text-white px-3 py-2 rounded hover:bg-indigo-700"
          >
            <Upload className="h-4 w-4 mr-1" />
            Import Supplier Prices
          </button>
        </div>
      </div>
      
      {/* Supplier Price Import Form */}
      {showImportForm && (
        <SupplierImportForm 
          onClose={() => setShowImportForm(false)}
          onSuccess={handleImportSuccess}
          recentImports={recentImports}
        />
      )}
      
      {/* Products Table */}
      <ProductTable 
        products={sortedProducts}
        sortField={sortField}
        sortDirection={sortDirection}
        onSort={handleSort}
        onProductsUpdated={(updatedProducts) => {
          setProducts(updatedProducts);
          setFilteredProducts(updatedProducts);
        }}
      />
    </div>
  );
};

export default Products;