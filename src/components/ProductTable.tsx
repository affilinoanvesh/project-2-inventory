import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Edit, Save, X, ChevronRight } from 'lucide-react';
import { Product, ProductVariation } from '../types';
import { updateProductCostPrice } from '../services/api';

interface ProductTableProps {
  products: Product[];
  sortField: keyof Product;
  sortDirection: 'asc' | 'desc';
  onSort: (field: keyof Product) => void;
  onProductsUpdated: (products: Product[]) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ 
  products, 
  sortField, 
  sortDirection, 
  onSort,
  onProductsUpdated
}) => {
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [editingVariationId, setEditingVariationId] = useState<number | null>(null);
  const [editedCostPrice, setEditedCostPrice] = useState<string>('');
  const [expandedProductIds, setExpandedProductIds] = useState<Set<number>>(new Set());

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value);
  };

  const startEditing = (product: Product, variationId?: number) => {
    setEditingProductId(product.id);
    setEditingVariationId(variationId || null);
    
    if (variationId) {
      const variation = product.productVariations?.find(v => v.id === variationId);
      setEditedCostPrice((variation?.cost_price || 0).toString());
    } else {
      setEditedCostPrice((product.cost_price || 0).toString());
    }
  };

  const cancelEditing = () => {
    setEditingProductId(null);
    setEditingVariationId(null);
    setEditedCostPrice('');
  };

  const saveProductCost = async (productId: number, variationId?: number) => {
    const costPrice = parseFloat(editedCostPrice) || 0;
    
    try {
      // Update in database
      await updateProductCostPrice(productId, costPrice, variationId);
      
      // Update local state
      const updatedProducts = products.map(product => {
        if (product.id === productId) {
          if (variationId && product.productVariations) {
            // Update variation cost price
            const updatedVariations = product.productVariations.map(variation => {
              if (variation.id === variationId) {
                return {
                  ...variation,
                  cost_price: costPrice
                };
              }
              return variation;
            });
            
            return {
              ...product,
              productVariations: updatedVariations
            };
          } else {
            // Update product cost price
            return {
              ...product,
              cost_price: costPrice
            };
          }
        }
        return product;
      });
      
      onProductsUpdated(updatedProducts);
      setEditingProductId(null);
      setEditingVariationId(null);
    } catch (error) {
      console.error('Error saving product cost:', error);
      alert('Failed to save product cost. Please try again.');
    }
  };

  const calculateMargin = (price: number, costPrice: number | undefined) => {
    if (!costPrice || costPrice === 0) return 0;
    return ((price - costPrice) / price) * 100;
  };

  const toggleProductExpand = (productId: number) => {
    const newExpandedIds = new Set(expandedProductIds);
    if (newExpandedIds.has(productId)) {
      newExpandedIds.delete(productId);
    } else {
      newExpandedIds.add(productId);
    }
    setExpandedProductIds(newExpandedIds);
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Expand
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => onSort('name')}
              >
                <div className="flex items-center">
                  Product Name
                  {sortField === 'name' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => onSort('sku')}
              >
                <div className="flex items-center">
                  SKU
                  {sortField === 'sku' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => onSort('regular_price')}
              >
                <div className="flex items-center">
                  Regular Price
                  {sortField === 'regular_price' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => onSort('sale_price')}
              >
                <div className="flex items-center">
                  Sale Price
                  {sortField === 'sale_price' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => onSort('cost_price')}
              >
                <div className="flex items-center">
                  Cost Price
                  {sortField === 'cost_price' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => onSort('supplier_price')}
              >
                <div className="flex items-center">
                  Supplier Price
                  {sortField === 'supplier_price' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <div className="flex items-center">
                  Margin
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => onSort('stock_quantity')}
              >
                <div className="flex items-center">
                  Stock
                  {sortField === 'stock_quantity' && (
                    sortDirection === 'asc' ? <ChevronUp className="h-4 w-4 ml-1" /> : <ChevronDown className="h-4 w-4 ml-1" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {products.map(product => (
              <React.Fragment key={product.id}>
                <tr className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.type === 'variable' && product.productVariations && product.productVariations.length > 0 ? (
                      <button 
                        onClick={() => toggleProductExpand(product.id)}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        <ChevronRight className={`h-5 w-5 transform transition-transform ${expandedProductIds.has(product.id) ? 'rotate-90' : ''}`} />
                      </button>
                    ) : (
                      <span className="text-gray-300">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {product.name}
                    {product.type === 'variable' && (
                      <span className="ml-2 text-xs text-indigo-600 bg-indigo-100 px-2 py-1 rounded-full">
                        Variable
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.sku || 'N/A'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.type === 'variable' ? 'Varies' : formatCurrency(product.regular_price || product.price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.type === 'variable' ? 'Varies' : 
                      product.sale_price ? formatCurrency(product.sale_price) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingProductId === product.id && editingVariationId === null ? (
                      <div className="flex items-center">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-24 p-1 border rounded"
                          value={editedCostPrice}
                          onChange={(e) => setEditedCostPrice(e.target.value)}
                        />
                      </div>
                    ) : (
                      product.type === 'variable' ? 'Varies' : formatCurrency(product.cost_price || 0)
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.type === 'variable' ? 'Varies' : 
                      product.supplier_price ? (
                        <div>
                          {formatCurrency(product.supplier_price)}
                          {product.supplier_name && (
                            <div className="text-xs text-gray-400">
                              {product.supplier_name}
                              {product.supplier_updated && (
                                <span> ({new Date(product.supplier_updated).toLocaleDateString()})</span>
                              )}
                            </div>
                          )}
                        </div>
                      ) : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.type === 'variable' ? 'Varies' : 
                      `${calculateMargin(
                        product.sale_price || product.regular_price || product.price, 
                        product.supplier_price || product.cost_price
                      ).toFixed(2)}%`}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {product.stock_quantity || 0}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {editingProductId === product.id && editingVariationId === null ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => saveProductCost(product.id)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Save className="h-5 w-5" />
                        </button>
                        <button
                          onClick={cancelEditing}
                          className="text-red-600 hover:text-red-900"
                        >
                          <X className="h-5 w-5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEditing(product)}
                        className="text-indigo-600 hover:text-indigo-900"
                        disabled={product.type === 'variable'}
                      >
                        <Edit className={`h-5 w-5 ${product.type === 'variable' ? 'opacity-50 cursor-not-allowed' : ''}`} />
                      </button>
                    )}
                  </td>
                </tr>
                
                {/* Variations rows */}
                {expandedProductIds.has(product.id) && product.productVariations && 
                  product.productVariations.map(variation => (
                    <tr key={variation.id} className="bg-gray-50 hover:bg-gray-100">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 pl-10">
                        <span className="text-gray-600">└ </span>
                        {variation.name.replace(product.name + ' - ', '')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {variation.sku || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatCurrency(variation.regular_price || variation.price)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {variation.sale_price ? formatCurrency(variation.sale_price) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {editingProductId === product.id && editingVariationId === variation.id ? (
                          <div className="flex items-center">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              className="w-24 p-1 border rounded"
                              value={editedCostPrice}
                              onChange={(e) => setEditedCostPrice(e.target.value)}
                            />
                          </div>
                        ) : (
                          formatCurrency(variation.cost_price || 0)
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {variation.supplier_price ? (
                          <div>
                            {formatCurrency(variation.supplier_price)}
                            {variation.supplier_name && (
                              <div className="text-xs text-gray-400">
                                {variation.supplier_name}
                                {variation.supplier_updated && (
                                  <span> ({new Date(variation.supplier_updated).toLocaleDateString()})</span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {calculateMargin(
                          variation.sale_price || variation.regular_price || variation.price, 
                          variation.supplier_price || variation.cost_price
                        ).toFixed(2)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {variation.stock_quantity || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        {editingProductId === product.id && editingVariationId === variation.id ? (
                          <div className="flex space-x-2">
                            <button
                              onClick={() => saveProductCost(product.id, variation.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              <Save className="h-5 w-5" />
                            </button>
                            <button
                              onClick={cancelEditing}
                              className="text-red-600 hover:text-red-900"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditing(product, variation.id)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </React.Fragment>
            ))}
            
            {products.length === 0 && (
              <tr>
                <td colSpan={10} className="px-6 py-4 text-center text-sm text-gray-500">
                  No products found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductTable;