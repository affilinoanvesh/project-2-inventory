import { InventoryItem } from '../../types';
import { saveInventory, getInventory, getProducts, getProductVariations } from '../../db';
import { updateLastSync } from './sync';
import { safeUpdateProgress } from './utils';

// Sync inventory data from products and variations
export const syncInventory = async (progressCallback?: (progress: number) => void): Promise<InventoryItem[]> => {
  // Get products and variations from database
  const products = await getProducts();
  const variations = await getProductVariations();
  
  // Initial progress update
  safeUpdateProgress(progressCallback, 20);
  
  // Extract inventory data from products
  const productInventory = products.map(product => ({
    product_id: product.id,
    sku: product.sku || '',
    cost_price: product.cost_price || 0,
    supplier_price: product.supplier_price,
    supplier_name: product.supplier_name,
    supplier_updated: product.supplier_updated,
    stock_quantity: product.stock_quantity || 0
  }));
  
  // Update progress
  safeUpdateProgress(progressCallback, 50);
  
  // Extract inventory data from variations
  const variationInventory = variations.map(variation => ({
    product_id: variation.parent_id,
    variation_id: variation.id,
    sku: variation.sku || '',
    cost_price: variation.cost_price || 0,
    supplier_price: variation.supplier_price,
    supplier_name: variation.supplier_name,
    supplier_updated: variation.supplier_updated,
    stock_quantity: variation.stock_quantity || 0
  }));
  
  // Update progress
  safeUpdateProgress(progressCallback, 80);
  
  // Combine product and variation inventory
  let inventory: InventoryItem[] = [...productInventory, ...variationInventory];
  
  await saveInventory(inventory);
  await updateLastSync('inventory');
  
  // Final progress update
  safeUpdateProgress(progressCallback, 100);
  
  return inventory;
};

// Fetch inventory from database
export const fetchInventory = async (): Promise<InventoryItem[]> => {
  return await getInventory();
};