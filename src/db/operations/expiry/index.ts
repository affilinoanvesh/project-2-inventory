import { db } from '../../schema';
import { ProductExpiry } from '../../../types';

/**
 * Add a new product expiry record
 */
export async function addProductExpiry(expiry: Omit<ProductExpiry, 'id' | 'created_at' | 'updated_at'>): Promise<number> {
  // Check if there's already an expiry record with the same SKU and batch number
  if (expiry.batch_number) {
    const existingRecords = await db.productExpiry
      .where('sku')
      .equals(expiry.sku)
      .and(item => item.batch_number === expiry.batch_number)
      .toArray();
    
    if (existingRecords.length > 0) {
      throw new Error(`An expiry record with batch number "${expiry.batch_number}" already exists for this product`);
    }
  }
  
  const id = await db.productExpiry.add({
    ...expiry,
    created_at: new Date(),
    updated_at: new Date()
  });
  return typeof id === 'number' ? id : parseInt(id.toString(), 10);
}

/**
 * Update an existing product expiry record
 */
export async function updateProductExpiry(id: number, expiry: Partial<ProductExpiry>): Promise<number> {
  // If batch number is being updated, check for duplicates
  if (expiry.batch_number) {
    const currentRecord = await db.productExpiry.get(id);
    
    if (currentRecord && expiry.batch_number !== currentRecord.batch_number) {
      const existingRecords = await db.productExpiry
        .where('sku')
        .equals(currentRecord.sku)
        .and(item => item.batch_number === expiry.batch_number)
        .toArray();
      
      if (existingRecords.length > 0) {
        throw new Error(`An expiry record with batch number "${expiry.batch_number}" already exists for this product`);
      }
    }
  }
  
  return await db.productExpiry.update(id, {
    ...expiry,
    updated_at: new Date()
  });
}

/**
 * Delete a product expiry record
 */
export async function deleteProductExpiry(id: number): Promise<void> {
  await db.productExpiry.delete(id);
}

/**
 * Get all product expiry records
 */
export async function getAllProductExpiry(): Promise<ProductExpiry[]> {
  return await db.productExpiry.toArray();
}

/**
 * Get product expiry records by SKU
 */
export async function getProductExpiryBySku(sku: string): Promise<ProductExpiry[]> {
  return await db.productExpiry.where('sku').equals(sku).toArray();
}

/**
 * Get expiring products within a specified number of days
 */
export async function getExpiringProducts(days: number = 90): Promise<ProductExpiry[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() + days);
  
  return await db.productExpiry
    .where('expiry_date')
    .belowOrEqual(cutoffDate)
    .toArray();
}

/**
 * Add multiple product expiry records in bulk
 */
export async function addBulkProductExpiry(expiryData: Array<Omit<ProductExpiry, 'id' | 'created_at' | 'updated_at'>>): Promise<number[]> {
  // Check for duplicate batch numbers
  const skuBatchMap = new Map<string, Set<string>>();
  
  // First, get all existing SKU and batch number combinations
  const existingRecords = await db.productExpiry.toArray();
  
  existingRecords.forEach(record => {
    if (record.batch_number) {
      const key = record.sku;
      if (!skuBatchMap.has(key)) {
        skuBatchMap.set(key, new Set());
      }
      skuBatchMap.get(key)?.add(record.batch_number);
    }
  });
  
  // Check for duplicates in the new data
  const duplicates: string[] = [];
  
  expiryData.forEach(item => {
    if (item.batch_number) {
      const key = item.sku;
      if (skuBatchMap.has(key) && skuBatchMap.get(key)?.has(item.batch_number)) {
        duplicates.push(`SKU: ${item.sku}, Batch: ${item.batch_number}`);
      }
    }
  });
  
  if (duplicates.length > 0) {
    throw new Error(`Duplicate batch numbers found: ${duplicates.join('; ')}`);
  }
  
  const now = new Date();
  const dataWithTimestamps = expiryData.map(item => ({
    ...item,
    created_at: now,
    updated_at: now
  }));
  
  const ids = await db.productExpiry.bulkAdd(dataWithTimestamps, { allKeys: true });
  return ids.map(id => typeof id === 'number' ? id : parseInt(id.toString(), 10));
}

/**
 * Get product expiry records with product details
 * This joins the expiry data with product data to get product names
 */
export async function getProductExpiryWithDetails(): Promise<ProductExpiry[]> {
  const expiryRecords = await db.productExpiry.toArray();
  const products = await db.products.toArray();
  const variations = await db.productVariations.toArray();
  
  // Create maps for quick lookup
  const productMap = new Map(products.map(p => [p.id, p]));
  const variationMap = new Map(variations.map(v => [v.id, v]));
  
  // Enrich expiry records with product details
  return expiryRecords.map(record => {
    let productName = 'Unknown Product';
    let stockQuantity = 0;
    
    if (record.variation_id) {
      // This is a variation
      const variation = variationMap.get(record.variation_id);
      const product = variation ? productMap.get(variation.parent_id) : null;
      
      if (variation && product) {
        productName = `${product.name} (${variation.attributes.map(a => a.option).join(', ')})`;
        stockQuantity = variation.stock_quantity || 0;
      }
    } else if (record.product_id) {
      // This is a simple product
      const product = productMap.get(record.product_id);
      
      if (product) {
        productName = product.name;
        stockQuantity = product.stock_quantity || 0;
      }
    }
    
    return {
      ...record,
      product_name: productName,
      stock_quantity: stockQuantity
    };
  });
}

/**
 * Get product expiry records sorted by expiry date
 */
export async function getProductExpiryByExpiryDate(ascending: boolean = true): Promise<ProductExpiry[]> {
  const records = await getProductExpiryWithDetails();
  
  return records.sort((a, b) => {
    const dateA = new Date(a.expiry_date).getTime();
    const dateB = new Date(b.expiry_date).getTime();
    return ascending ? dateA - dateB : dateB - dateA;
  });
}

/**
 * Get all batch numbers for a specific SKU
 */
export async function getBatchNumbersBySku(sku: string): Promise<string[]> {
  const records = await db.productExpiry
    .where('sku')
    .equals(sku)
    .and(item => item.batch_number !== undefined && item.batch_number !== '')
    .toArray();
  
  return records
    .map(record => record.batch_number as string)
    .filter((value, index, self) => self.indexOf(value) === index); // Remove duplicates
}

/**
 * Get total quantity across all expiry records for a SKU
 */
export async function getTotalQuantityBySku(sku: string): Promise<number> {
  const records = await db.productExpiry
    .where('sku')
    .equals(sku)
    .toArray();
  
  return records.reduce((total, record) => total + record.quantity, 0);
} 