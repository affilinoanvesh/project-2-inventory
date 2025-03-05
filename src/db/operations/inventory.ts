import { db } from '../schema';
import { InventoryItem } from '../../types';
import { updateLastSync } from './sync';

export async function saveInventory(inventory: InventoryItem[]): Promise<void> {
  try {
    await db.transaction('rw', db.inventory, async () => {
      await db.inventory.clear();
      
      // Add an id field to each inventory item before saving
      for (const item of inventory) {
        await db.inventory.add({
          ...item,
          id: undefined // Let Dexie auto-generate the id
        });
      }
    });
    await updateLastSync('inventory');
  } catch (error) {
    console.error('Error saving inventory:', error);
    throw error;
  }
}

export async function getInventory(): Promise<InventoryItem[]> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    // Get all inventory items and remove the auto-generated id field
    const items = await db.inventory.toArray();
    return items.map(({ id, ...item }) => item as InventoryItem);
  } catch (error) {
    console.error('Error getting inventory:', error);
    return [];
  }
}

export async function updateInventoryItem(item: InventoryItem): Promise<void> {
  try {
    // Find the item by product_id and variation_id
    const existingItem = await db.inventory
      .where('product_id')
      .equals(item.product_id)
      .and(i => {
        if (item.variation_id) {
          return i.variation_id === item.variation_id;
        } else {
          return !i.variation_id;
        }
      })
      .first();
    
    if (existingItem) {
      // Update existing item
      await db.inventory.update(existingItem.id!, {
        ...item,
        id: existingItem.id
      });
    } else {
      // Add new item
      await db.inventory.add({
        ...item,
        id: undefined // Let Dexie auto-generate the id
      });
    }
  } catch (error) {
    console.error('Error updating inventory item:', error);
    throw error;
  }
}

export async function updateSupplierPrice(
  sku: string, 
  supplierPrice: number, 
  supplierName: string
): Promise<boolean> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    console.log(`Updating supplier price for SKU: ${sku}, price: ${supplierPrice}, supplier: ${supplierName}`);
    
    // First, try to find the product by SKU
    const product = await db.products
      .where('sku')
      .equals(sku)
      .first();
    
    if (product) {
      console.log(`Found product with SKU: ${sku}, ID: ${product.id}`);
      
      // Update the product directly
      await db.products.update(product.id, {
        supplier_price: supplierPrice,
        supplier_name: supplierName,
        supplier_updated: new Date()
      });
      
      // Also update or create inventory item
      await updateInventoryItem({
        product_id: product.id,
        sku: sku,
        cost_price: product.cost_price || 0,
        supplier_price: supplierPrice,
        supplier_name: supplierName,
        supplier_updated: new Date()
      });
      
      console.log(`Updated product with supplier price: ${supplierPrice}`);
      return true;
    }
    
    // If not found as a product, try to find a variation with this SKU
    const variation = await db.productVariations
      .where('sku')
      .equals(sku)
      .first();
    
    if (variation) {
      console.log(`Found variation with SKU: ${sku}, ID: ${variation.id}, parent ID: ${variation.parent_id}`);
      
      // Update the variation directly
      await db.productVariations.update(variation.id, {
        supplier_price: supplierPrice,
        supplier_name: supplierName,
        supplier_updated: new Date()
      });
      
      // Also update or create inventory item
      await updateInventoryItem({
        product_id: variation.parent_id,
        variation_id: variation.id,
        sku: sku,
        cost_price: variation.cost_price || 0,
        supplier_price: supplierPrice,
        supplier_name: supplierName,
        supplier_updated: new Date()
      });
      
      console.log(`Updated variation with supplier price: ${supplierPrice}`);
      return true;
    }
    
    // If we get here, try to find the item in inventory by SKU
    const items = await db.inventory
      .where('sku')
      .equals(sku)
      .toArray();
    
    if (items.length > 0) {
      console.log(`Found ${items.length} inventory items with SKU: ${sku}`);
      
      // Update all matching items (there might be multiple with the same SKU)
      for (const item of items) {
        await db.inventory.update(item.id!, {
          ...item,
          supplier_price: supplierPrice,
          supplier_name: supplierName,
          supplier_updated: new Date()
        });
        
        console.log(`Updated inventory item ID: ${item.id} with supplier price: ${supplierPrice}`);
        
        // Also update the corresponding product or variation
        if (item.variation_id) {
          // Update variation
          const variation = await db.productVariations.get(item.variation_id);
          if (variation) {
            await db.productVariations.update(item.variation_id, {
              ...variation,
              supplier_price: supplierPrice,
              supplier_name: supplierName,
              supplier_updated: new Date()
            });
            console.log(`Updated variation ID: ${item.variation_id} with supplier price: ${supplierPrice}`);
          }
        } else {
          // Update product
          const product = await db.products.get(item.product_id);
          if (product) {
            await db.products.update(item.product_id, {
              ...product,
              supplier_price: supplierPrice,
              supplier_name: supplierName,
              supplier_updated: new Date()
            });
            console.log(`Updated product ID: ${item.product_id} with supplier price: ${supplierPrice}`);
          }
        }
      }
      
      return true;
    }
    
    console.log(`No product, variation, or inventory item found with SKU: ${sku}`);
    return false; // SKU not found
  } catch (error) {
    console.error('Error updating supplier price:', error);
    return false;
  }
}