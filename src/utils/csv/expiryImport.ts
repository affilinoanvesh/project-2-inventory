import { parse, isValid } from 'date-fns';
import { ProductExpiry } from '../../types';
import { db } from '../../db/schema';
import { getTotalQuantityBySku } from '../../db/operations/expiry';

interface ExpiryImportRow {
  SKU: string;
  'Expiry Date': string;
  Quantity: string;
  'Batch Number'?: string;
  Notes?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  data: Array<Omit<ProductExpiry, 'id' | 'created_at' | 'updated_at'>>;
}

/**
 * Parse a CSV file containing product expiry data
 */
export const parseExpiryCSV = async (file: File): Promise<ExpiryImportRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (event) => {
      try {
        const csv = event.target?.result as string;
        const lines = csv.split('\n');
        const headers = lines[0].split(',').map(header => header.trim());
        
        const results: ExpiryImportRow[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          if (!lines[i].trim()) continue;
          
          const values = lines[i].split(',').map(value => value.trim());
          const row: Record<string, string> = {};
          
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          
          results.push(row as unknown as ExpiryImportRow);
        }
        
        resolve(results);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = (error) => reject(error);
    reader.readAsText(file);
  });
};

/**
 * Validate expiry data from CSV import
 */
export const validateExpiryData = async (data: ExpiryImportRow[]): Promise<ValidationResult> => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const validData: Array<Omit<ProductExpiry, 'id' | 'created_at' | 'updated_at'>> = [];
  
  // Check required fields in the first row
  const requiredFields = ['SKU', 'Expiry Date', 'Quantity'];
  const firstRow = data[0];
  
  if (firstRow) {
    for (const field of requiredFields) {
      if (!(field in firstRow)) {
        errors.push(`Missing required field: ${field}`);
      }
    }
  } else {
    errors.push('No data found in CSV file');
    return { valid: false, errors, warnings, data: [] };
  }
  
  if (errors.length > 0) {
    return { valid: false, errors, warnings, data: [] };
  }
  
  // Get all products and variations for validation
  const products = await db.products.toArray();
  const variations = await db.productVariations.toArray();
  
  // Create maps for quick lookup
  const productMap = new Map<string, number>();
  const variationMap = new Map<string, { id: number, parent_id: number }>();
  
  // Map products by SKU
  products.forEach(product => {
    if (product.sku) {
      productMap.set(product.sku, product.id);
    }
  });
  
  // Map variations by SKU
  variations.forEach(variation => {
    if (variation.sku) {
      variationMap.set(variation.sku, { 
        id: variation.id, 
        parent_id: variation.parent_id 
      });
    }
  });
  
  // Get existing batch numbers for each SKU
  const existingBatchNumbers = new Map<string, Set<string>>();
  const existingExpiryRecords = await db.productExpiry.toArray();
  
  existingExpiryRecords.forEach(record => {
    if (record.batch_number) {
      if (!existingBatchNumbers.has(record.sku)) {
        existingBatchNumbers.set(record.sku, new Set());
      }
      existingBatchNumbers.get(record.sku)?.add(record.batch_number);
    }
  });
  
  // Check for duplicate SKU/batch combinations in the import data
  const importBatchNumbers = new Map<string, Set<string>>();
  
  // Track total quantities by SKU for validation
  const importQuantities = new Map<string, number>();
  const existingQuantities = new Map<string, number>();
  const stockQuantities = new Map<string, number>();
  
  // Get existing quantities for each SKU
  for (const row of data) {
    if (row.SKU && !existingQuantities.has(row.SKU)) {
      existingQuantities.set(row.SKU, await getTotalQuantityBySku(row.SKU));
    }
  }
  
  // Validate each row
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowNum = i + 2; // +2 because of 0-indexing and header row
    
    // Skip empty rows
    if (!row.SKU && !row['Expiry Date'] && !row.Quantity) {
      continue;
    }
    
    // Check SKU
    if (!row.SKU) {
      errors.push(`Row ${rowNum}: Missing SKU`);
      continue;
    }
    
    // Check if SKU exists in products or variations
    const productId = productMap.get(row.SKU);
    const variation = variationMap.get(row.SKU);
    
    if (!productId && !variation) {
      errors.push(`Row ${rowNum}: SKU "${row.SKU}" not found in products or variations`);
      continue;
    }
    
    // Check Expiry Date
    if (!row['Expiry Date']) {
      errors.push(`Row ${rowNum}: Missing Expiry Date`);
      continue;
    }
    
    // Parse date (expecting DD/MM/YYYY format)
    const dateParts = row['Expiry Date'].split('/');
    let expiryDate: Date;
    
    if (dateParts.length === 3) {
      expiryDate = parse(row['Expiry Date'], 'dd/MM/yyyy', new Date());
    } else {
      expiryDate = new Date(row['Expiry Date']);
    }
    
    if (!isValid(expiryDate)) {
      errors.push(`Row ${rowNum}: Invalid date format. Use DD/MM/YYYY`);
      continue;
    }
    
    // Check Quantity
    if (!row.Quantity) {
      errors.push(`Row ${rowNum}: Missing Quantity`);
      continue;
    }
    
    const quantity = parseInt(row.Quantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      errors.push(`Row ${rowNum}: Quantity must be a positive number`);
      continue;
    }
    
    // Track import quantities by SKU
    if (!importQuantities.has(row.SKU)) {
      importQuantities.set(row.SKU, 0);
    }
    importQuantities.set(row.SKU, importQuantities.get(row.SKU)! + quantity);
    
    // Check stock quantity
    let stockQuantity = 0;
    
    if (variation) {
      // Get variation stock
      const variationObj = await db.productVariations.get(variation.id);
      stockQuantity = variationObj?.stock_quantity || 0;
    } else if (productId) {
      // Get product stock
      const productObj = await db.products.get(productId);
      stockQuantity = productObj?.stock_quantity || 0;
    }
    
    // Store stock quantity for later total validation
    stockQuantities.set(row.SKU, stockQuantity);
    
    // Check batch number
    const batchNumber = row['Batch Number'];
    
    // If multiple expiry dates exist for this SKU, batch number is required
    const existingExpiry = await db.productExpiry.where('sku').equals(row.SKU).count();
    
    if (existingExpiry > 0 && !batchNumber) {
      errors.push(`Row ${rowNum}: Batch Number is required for SKU "${row.SKU}" because it already has expiry records`);
      continue;
    }
    
    // Check for duplicate batch numbers in existing data
    if (batchNumber && existingBatchNumbers.has(row.SKU) && existingBatchNumbers.get(row.SKU)?.has(batchNumber)) {
      errors.push(`Row ${rowNum}: Batch Number "${batchNumber}" already exists for SKU "${row.SKU}"`);
      continue;
    }
    
    // Check for duplicate batch numbers within the import data
    if (batchNumber) {
      if (!importBatchNumbers.has(row.SKU)) {
        importBatchNumbers.set(row.SKU, new Set());
      }
      
      if (importBatchNumbers.get(row.SKU)?.has(batchNumber)) {
        errors.push(`Row ${rowNum}: Duplicate Batch Number "${batchNumber}" for SKU "${row.SKU}" in the import file`);
        continue;
      }
      
      importBatchNumbers.get(row.SKU)?.add(batchNumber);
    }
    
    // Add valid data
    validData.push({
      product_id: productId || (variation ? variation.parent_id : 0),
      variation_id: variation ? variation.id : undefined,
      sku: row.SKU,
      expiry_date: expiryDate,
      batch_number: batchNumber || undefined,
      quantity,
      stock_quantity: stockQuantity,
      notes: row.Notes || undefined
    });
  }
  
  // Check total quantities against stock
  for (const [sku, importQty] of importQuantities.entries()) {
    const existingQty = existingQuantities.get(sku) || 0;
    const stockQty = stockQuantities.get(sku) || 0;
    const totalQty = existingQty + importQty;
    
    if (totalQty > stockQty) {
      warnings.push(`Total quantity (${totalQty}) for SKU "${sku}" exceeds current stock (${stockQty}). Existing: ${existingQty}, Importing: ${importQty}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    data: validData
  };
};

/**
 * Generate a template CSV for expiry import
 */
export const generateExpiryTemplate = (): string => {
  const headers = ['SKU', 'Expiry Date', 'Quantity', 'Batch Number', 'Notes'];
  const exampleRow = ['SKU123', '31/12/2023', '10', 'BATCH001', 'Example note'];
  
  return [
    headers.join(','),
    exampleRow.join(',')
  ].join('\n');
};

/**
 * Download the expiry template
 */
export const downloadExpiryTemplate = (): void => {
  const template = generateExpiryTemplate();
  const blob = new Blob([template], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = 'product_expiry_template.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}; 