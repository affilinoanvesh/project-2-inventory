import React, { useRef } from 'react';
import { PurchaseOrderItem, Product } from '../../../types';
import { X, Plus, Upload, Calendar, Tag, FileText } from 'lucide-react';
import * as Papa from 'papaparse';

interface POFormItemsTableProps {
  items: PurchaseOrderItem[];
  searchTerm: string;
  searchResults: Product[];
  showProductSearch: number | null;
  totalAmount: number;
  purchaseOrderId?: number;
  onAddItem: () => void;
  onRemoveItem: (index: number) => void;
  onUpdateItem: (index: number, field: keyof PurchaseOrderItem, value: unknown) => void;
  onSearchTermChange: (term: string) => void;
  onShowProductSearch: (index: number | null) => void;
  onSelectProduct: (product: Product, index: number) => void;
  onExpiryDateChange: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onItemsUploaded: (items: PurchaseOrderItem[]) => void;
  onError: (error: string | null) => void;
}

interface CsvRow {
  sku: string;
  product_name: string;
  quantity: string;
  unit_price: string;
  batch_number?: string;
  expiry_date?: string;
  notes?: string;
}

const POFormItemsTable: React.FC<POFormItemsTableProps> = ({
  items,
  searchTerm,
  searchResults,
  showProductSearch,
  totalAmount,
  purchaseOrderId,
  onAddItem,
  onRemoveItem,
  onUpdateItem,
  onSearchTermChange,
  onShowProductSearch,
  onSelectProduct,
  onExpiryDateChange,
  onItemsUploaded,
  onError
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const csvData = event.target?.result as string;
        
        Papa.parse<CsvRow>(csvData, {
          header: true,
          skipEmptyLines: true,
          complete: function(results) {
            const parsedItems = results.data.map((row) => {
              // Expected CSV columns: sku, product_name, quantity, unit_price, batch_number, expiry_date
              const quantity = parseInt(row.quantity, 10) || 1;
              const unitPrice = parseFloat(row.unit_price) || 0;
              
              return {
                purchase_order_id: purchaseOrderId || 0,
                sku: row.sku || '',
                product_name: row.product_name || '',
                quantity: quantity,
                unit_price: unitPrice,
                total_price: quantity * unitPrice,
                batch_number: row.batch_number || '',
                expiry_date: row.expiry_date ? new Date(row.expiry_date) : undefined,
                notes: row.notes || ''
              } as PurchaseOrderItem;
            });
            
            // Add the parsed items to the existing items
            onItemsUploaded(parsedItems);
            
            // Reset the file input
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          },
          error: function(error: Error) {
            onError(`Failed to parse CSV file: ${error.message}`);
          }
        });
      } catch (err) {
        onError(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
      }
    };
    
    reader.readAsText(file);
  };

  const downloadSampleCSV = () => {
    const headers = ['sku', 'product_name', 'quantity', 'unit_price', 'batch_number', 'expiry_date', 'notes'];
    const sampleData = [
      ['SKU123', 'Sample Product 1', '10', '15.99', 'BATCH001', '2023-12-31', 'Sample notes'],
      ['SKU456', 'Sample Product 2', '5', '25.50', 'BATCH002', '2024-06-30', '']
    ];
    
    // Create CSV content
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row => row.join(','))
    ].join('\n');
    
    // Create a blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'purchase_order_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-medium text-gray-700">Order Items</h3>
        <div className="flex space-x-2">
          <input
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            ref={fileInputRef}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center cursor-pointer transition-colors"
          >
            <Upload className="h-4 w-4 mr-1" />
            Upload Items
          </label>
          <button
            type="button"
            onClick={downloadSampleCSV}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center transition-colors"
          >
            <FileText className="h-4 w-4 mr-1" />
            Download Template
          </button>
          <button
            type="button"
            onClick={onAddItem}
            className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center transition-colors"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Item
          </button>
        </div>
      </div>
      
      {items.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No items added yet. Click "Add Item" to add products to this order.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch #</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="relative">
                      <input
                        type="text"
                        value={item.product_name}
                        onChange={(e) => onUpdateItem(index, 'product_name', e.target.value)}
                        onFocus={() => onShowProductSearch(index)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Search product..."
                      />
                      {showProductSearch === index && (
                        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-auto">
                          <div className="p-2 border-b">
                            <input
                              type="text"
                              value={searchTerm}
                              onChange={(e) => onSearchTermChange(e.target.value)}
                              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                              placeholder="Type to search..."
                              autoFocus
                            />
                          </div>
                          {searchResults.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                              {searchTerm ? 'No products found' : 'Type to search products'}
                            </div>
                          ) : (
                            <ul>
                              {searchResults.map(product => (
                                <li
                                  key={product.id}
                                  className="px-4 py-2 hover:bg-blue-50 cursor-pointer"
                                  onClick={() => onSelectProduct(product, index)}
                                >
                                  <div className="font-medium">{product.name}</div>
                                  <div className="text-sm text-gray-500">
                                    SKU: {product.sku || 'N/A'} | Price: ${product.cost_price?.toFixed(2) || 'N/A'}
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      value={item.sku}
                      onChange={(e) => onUpdateItem(index, 'sku', e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      placeholder="SKU"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center">
                      <Tag className="h-4 w-4 text-gray-400 mr-1" />
                      <input
                        type="text"
                        value={item.batch_number || ''}
                        onChange={(e) => onUpdateItem(index, 'batch_number', e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                        placeholder="Batch #"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 text-gray-400 mr-1" />
                      <input
                        type="date"
                        value={item.expiry_date ? item.expiry_date.toISOString().split('T')[0] : ''}
                        onChange={(e) => onExpiryDateChange(index, e)}
                        className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => onUpdateItem(index, 'quantity', parseInt(e.target.value, 10) || 0)}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-right"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(e) => onUpdateItem(index, 'unit_price', parseFloat(e.target.value) || 0)}
                      className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors text-right"
                    />
                  </td>
                  <td className="px-4 py-2 text-right font-medium">
                    ${item.total_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onRemoveItem(index)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan={6} className="px-4 py-2 text-right font-medium">Total:</td>
                <td className="px-4 py-2 text-right font-bold">${totalAmount.toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default POFormItemsTable; 