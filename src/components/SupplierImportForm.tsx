import React, { useState } from 'react';
import { AlertCircle, Upload, FileText, RefreshCw } from 'lucide-react';
import { SupplierPriceItem, SupplierPriceImport } from '../types';
import { processSupplierPriceData, getSupplierImports, getSupplierImportItems } from '../db/operations/supplier';

interface SupplierImportFormProps {
  onClose: () => void;
  onSuccess: (updatedImports: any) => void;
  recentImports: {
    id?: number;
    date: string;
    supplier: string;
    filename: string;
    updated: number;
    skipped: number;
  }[];
}

const SupplierImportForm: React.FC<SupplierImportFormProps> = ({ 
  onClose, 
  onSuccess,
  recentImports 
}) => {
  const [supplierName, setSupplierName] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [selectedImportId, setSelectedImportId] = useState<number | null>(null);
  const [importMode, setImportMode] = useState<'file' | 'existing'>('file');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
    }
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (importMode === 'file') {
      if (!importFile) {
        setImportError('Please select a file to import');
        return;
      }
      
      if (!supplierName) {
        setImportError('Please enter a supplier name');
        return;
      }
    } else {
      if (!selectedImportId) {
        setImportError('Please select a previous import to reuse');
        return;
      }
    }
    
    setImportLoading(true);
    setImportError(null);
    setImportSuccess(null);
    setDebugInfo([]);
    
    try {
      let items: SupplierPriceItem[] = [];
      let filename = '';
      let supplier = '';
      
      if (importMode === 'file') {
        // Parse the CSV file
        items = await parseImportFile(importFile!);
        filename = importFile!.name;
        supplier = supplierName;
        
        if (items.length === 0) {
          setImportError('No valid data found in the file');
          setImportLoading(false);
          return;
        }
        
        setDebugInfo(prev => [...prev, `Found ${items.length} items in CSV file`]);
      } else {
        // Get items from previous import
        const selectedImport = recentImports.find(imp => imp.id === selectedImportId);
        if (!selectedImport) {
          setImportError('Selected import not found');
          setImportLoading(false);
          return;
        }
        
        items = await getSupplierImportItems(selectedImportId!);
        filename = selectedImport.filename;
        supplier = selectedImport.supplier;
        
        if (items.length === 0) {
          setImportError('No items found in the selected import');
          setImportLoading(false);
          return;
        }
        
        setDebugInfo(prev => [...prev, `Retrieved ${items.length} items from previous import`]);
      }
      
      // Process the data
      const result = await processSupplierPriceData(items, supplier, filename);
      
      // Update the UI
      setImportSuccess(`Successfully imported ${result.items_updated} items (${result.items_skipped} skipped)`);
      
      // Update recent imports
      const updatedImports = [
        {
          id: result.id,
          date: new Date().toLocaleDateString(),
          supplier: supplier,
          filename: filename,
          updated: result.items_updated,
          skipped: result.items_skipped
        },
        ...recentImports.slice(0, 4)
      ];
      
      // Reset form
      setSupplierName('');
      setImportFile(null);
      setSelectedImportId(null);
      
      // Notify parent component
      onSuccess(updatedImports);
      
      // Close the form after a delay
      setTimeout(() => {
        onClose();
      }, 3000);
    } catch (error) {
      console.error('Error importing supplier prices:', error);
      setImportError('Failed to import supplier prices. Please check your file format and try again.');
      setDebugInfo(prev => [...prev, `Error: ${error instanceof Error ? error.message : String(error)}`]);
    } finally {
      setImportLoading(false);
    }
  };

  const parseImportFile = async (file: File): Promise<SupplierPriceItem[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          setDebugInfo(prev => [...prev, `File content loaded, size: ${content.length} bytes`]);
          
          // Check if it's a CSV file
          if (file.name.toLowerCase().endsWith('.csv')) {
            const items = parseCSV(content);
            resolve(items);
          } else {
            // For now, only support CSV
            reject(new Error('Only CSV files are supported'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsText(file);
    });
  };

  const parseCSV = (content: string): SupplierPriceItem[] => {
    const lines = content.split('\n');
    if (lines.length === 0) {
      return [];
    }
    
    // Find header row
    const headerLine = lines[0].trim();
    const headers = headerLine.split(',').map(h => h.trim().toLowerCase());
    
    setDebugInfo(prev => [...prev, `CSV Headers: ${headers.join(', ')}`]);
    
    // Find column indices based on expected column names
    const skuIndex = headers.findIndex(h => 
      h === 'sku' || 
      h.includes('sku')
    );
    
    const nameIndex = headers.findIndex(h => 
      h === 'name' || 
      h === 'product' || 
      h === 'product name' || 
      h.includes('product') || 
      h.includes('name')
    );
    
    const priceIndex = headers.findIndex(h => 
      h === 'price' || 
      h === 'cost' || 
      h === 'supplier' || 
      h === 'supplier price' || 
      h.includes('price') || 
      h.includes('cost') || 
      h.includes('supplier')
    );
    
    setDebugInfo(prev => [...prev, `Column indices - SKU: ${skuIndex}, Name: ${nameIndex}, Price: ${priceIndex}`]);
    
    if (skuIndex === -1) {
      throw new Error('CSV file must contain a SKU column');
    }
    
    if (priceIndex === -1) {
      throw new Error('CSV file must contain a Price/Supplier column');
    }
    
    // Parse data rows
    const items: SupplierPriceItem[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Handle quoted CSV values properly
      let values: string[] = [];
      if (line.includes('"')) {
        // Handle quoted values (which might contain commas)
        let inQuote = false;
        let currentValue = '';
        
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          
          if (char === '"') {
            inQuote = !inQuote;
          } else if (char === ',' && !inQuote) {
            values.push(currentValue.trim());
            currentValue = '';
          } else {
            currentValue += char;
          }
        }
        
        // Add the last value
        values.push(currentValue.trim());
      } else {
        // Simple split for non-quoted values
        values = line.split(',').map(v => v.trim());
      }
      
      // Make sure we have enough values
      if (values.length <= Math.max(skuIndex, priceIndex)) {
        continue;
      }
      
      const sku = values[skuIndex].replace(/"/g, ''); // Remove any quotes
      const name = nameIndex !== -1 && nameIndex < values.length ? values[nameIndex].replace(/"/g, '') : undefined;
      
      // Handle price with potential $ and comma formatting
      let priceStr = values[priceIndex].replace(/"/g, '');
      if (priceStr) {
        priceStr = priceStr.replace(/[$,]/g, '');
      }
      
      const price = parseFloat(priceStr);
      
      if (sku && !isNaN(price)) {
        items.push({
          sku,
          name,
          supplier_price: price,
          supplier_name: supplierName
        });
        
        setDebugInfo(prev => [...prev, `Parsed item: SKU=${sku}, Price=${price}`]);
      } else {
        setDebugInfo(prev => [...prev, `Skipped invalid row: ${line}`]);
      }
    }
    
    setDebugInfo(prev => [...prev, `Parsed ${items.length} valid items from CSV`]);
    return items;
  };

  return (
    <div className="bg-white shadow rounded-lg p-6 mb-6">
      <h2 className="text-lg font-semibold mb-4">Import Supplier Prices</h2>
      
      {importError && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded flex items-center">
          <AlertCircle className="h-5 w-5 mr-2" />
          {importError}
        </div>
      )}
      
      {importSuccess && (
        <div className="mb-4 p-3 bg-green-100 border border-green-400 text-green-700 rounded">
          {importSuccess}
        </div>
      )}
      
      <div className="mb-4">
        <div className="flex space-x-4 mb-4">
          <button
            type="button"
            onClick={() => setImportMode('file')}
            className={`px-4 py-2 rounded text-sm font-medium ${
              importMode === 'file' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            <Upload className="h-4 w-4 mr-1 inline" />
            Upload New File
          </button>
          <button
            type="button"
            onClick={() => setImportMode('existing')}
            className={`px-4 py-2 rounded text-sm font-medium ${
              importMode === 'existing' 
                ? 'bg-indigo-600 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
            disabled={recentImports.length === 0}
          >
            <RefreshCw className="h-4 w-4 mr-1 inline" />
            Reuse Previous Import
          </button>
        </div>
      </div>
      
      <form onSubmit={handleImportSubmit}>
        {importMode === 'file' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Name
              </label>
              <input
                type="text"
                className="w-full p-2 border rounded"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Price List File (CSV)
              </label>
              <input
                type="file"
                accept=".csv"
                className="w-full p-2 border rounded"
                onChange={handleFileChange}
                required
              />
              <p className="text-xs text-gray-500 mt-1">
                File must contain columns for "Product Name", "SKU", and "Supplier" (price)
              </p>
            </div>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Previous Import
            </label>
            <select
              className="w-full p-2 border rounded"
              value={selectedImportId || ''}
              onChange={(e) => setSelectedImportId(e.target.value ? Number(e.target.value) : null)}
              required
            >
              <option value="">-- Select a previous import --</option>
              {recentImports.map((imp, index) => (
                <option key={index} value={imp.id}>
                  {imp.date} - {imp.supplier} - {imp.filename} ({imp.updated} items)
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Reapply a previous import to update product prices without uploading a new file
            </p>
          </div>
        )}
        
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={importLoading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-indigo-400"
            disabled={importLoading}
          >
            {importLoading ? (
              <>
                <span className="inline-block animate-spin mr-2">⟳</span>
                Importing...
              </>
            ) : (
              <>
                {importMode === 'file' ? (
                  <Upload className="h-4 w-4 mr-1 inline" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-1 inline" />
                )}
                {importMode === 'file' ? 'Import' : 'Reapply Import'}
              </>
            )}
          </button>
        </div>
      </form>
      
      {recentImports.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Recent Imports</h3>
          <div className="bg-gray-50 p-3 rounded">
            <table className="min-w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left font-medium text-gray-500 px-4 py-2">Date</th>
                  <th className="text-left font-medium text-gray-500 px-4 py-2">Supplier</th>
                  <th className="text-left font-medium text-gray-500 px-4 py-2">File</th>
                  <th className="text-left font-medium text-gray-500 px-4 py-2">Updated</th>
                  <th className="text-left font-medium text-gray-500 px-4 py-2">Skipped</th>
                </tr>
              </thead>
              <tbody>
                {recentImports.map((imp, index) => (
                  <tr key={index} className="border-t border-gray-200">
                    <td className="px-4 py-3 text-gray-700">{imp.date}</td>
                    <td className="px-4 py-3 text-gray-700">{imp.supplier}</td>
                    <td className="px-4 py-3 text-gray-700">{imp.filename}</td>
                    <td className="px-4 py-3 text-gray-700">{imp.updated}</td>
                    <td className="px-4 py-3 text-gray-700">{imp.skipped}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {debugInfo.length > 0 && (
        <div className="mt-6 border-t pt-4">
          <details>
            <summary className="text-sm font-medium text-gray-700 cursor-pointer">Debug Information</summary>
            <div className="mt-2 bg-gray-50 p-3 rounded text-xs font-mono">
              {debugInfo.map((info, index) => (
                <div key={index} className="py-1">{info}</div>
              ))}
            </div>
          </details>
        </div>
      )}
    </div>
  );
};

export default SupplierImportForm;