import { db } from '../index';
import { PurchaseOrder, PurchaseOrderItem, ProductExpiry } from '../../types';
import { addProductExpiry } from './expiry';

// Create a new purchase order
export const createPurchaseOrder = async (
  purchaseOrder: PurchaseOrder,
  items: PurchaseOrderItem[]
): Promise<number> => {
  return db.transaction('rw', db.purchaseOrders, db.purchaseOrderItems, db.productExpiry, async () => {
    // Add the purchase order
    const id = await db.purchaseOrders.add({
      ...purchaseOrder,
      created_at: new Date()
    }) as number;
    
    // Add all items with the purchase order ID
    await db.purchaseOrderItems.bulkAdd(
      items.map(item => ({
        ...item,
        purchase_order_id: id
      }))
    );
    
    // Add expiry tracking for items with expiry dates
    for (const item of items) {
      if (item.expiry_date && item.batch_number) {
        try {
          // Create expiry tracking record
          const expiryData: Omit<ProductExpiry, 'id' | 'created_at' | 'updated_at'> = {
            product_id: 0, // Will be updated if product is found
            sku: item.sku,
            product_name: item.product_name,
            expiry_date: item.expiry_date,
            batch_number: item.batch_number,
            quantity: item.quantity,
            notes: `Added from Purchase Order #${id}`
          };
          
          // Try to find the product ID by SKU
          const product = await db.products.where('sku').equals(item.sku).first();
          if (product) {
            expiryData.product_id = product.id;
          } else {
            // Check if it's a variation
            const variation = await db.productVariations.where('sku').equals(item.sku).first();
            if (variation) {
              expiryData.product_id = variation.parent_id;
              expiryData.variation_id = variation.id;
            }
          }
          
          await addProductExpiry(expiryData);
        } catch (error) {
          console.error(`Failed to add expiry tracking for item ${item.sku}:`, error);
          // Continue with other items even if one fails
        }
      }
    }
    
    return id;
  });
};

// Get all purchase orders
export const getPurchaseOrders = async (): Promise<PurchaseOrder[]> => {
  return db.purchaseOrders.toArray();
};

// Get purchase orders with optional filtering
export const getPurchaseOrdersFiltered = async (
  filters?: {
    startDate?: Date;
    endDate?: Date;
    supplier?: string;
    status?: string;
  }
): Promise<PurchaseOrder[]> => {
  let collection = db.purchaseOrders.toCollection();
  
  if (filters) {
    if (filters.startDate && filters.endDate) {
      collection = collection.filter(po => 
        po.date >= filters.startDate! && po.date <= filters.endDate!
      );
    }
    
    if (filters.supplier) {
      collection = collection.filter(po => 
        po.supplier_name.toLowerCase().includes(filters.supplier!.toLowerCase())
      );
    }
    
    if (filters.status) {
      collection = collection.filter(po => po.status === filters.status);
    }
  }
  
  return collection.toArray();
};

// Get a purchase order by ID with its items
export const getPurchaseOrderWithItems = async (id: number): Promise<{
  purchaseOrder: PurchaseOrder;
  items: PurchaseOrderItem[];
} | null> => {
  const purchaseOrder = await db.purchaseOrders.get(id);
  if (!purchaseOrder) return null;
  
  const items = await db.purchaseOrderItems
    .where('purchase_order_id')
    .equals(id)
    .toArray();
  
  return { purchaseOrder, items };
};

// Update a purchase order
export const updatePurchaseOrder = async (
  id: number,
  purchaseOrder: Partial<PurchaseOrder>,
  items?: PurchaseOrderItem[]
): Promise<void> => {
  return db.transaction('rw', db.purchaseOrders, db.purchaseOrderItems, db.productExpiry, db.inventory, async () => {
    // Get the current purchase order to check for status changes
    const currentPO = await db.purchaseOrders.get(id);
    
    // Update the purchase order
    await db.purchaseOrders.update(id, {
      ...purchaseOrder,
      updated_at: new Date()
    });
    
    // If items are provided, update them
    if (items) {
      // Get existing items to check for changes in expiry data
      const existingItems = await db.purchaseOrderItems
        .where('purchase_order_id')
        .equals(id)
        .toArray();
      
      // Delete existing items
      await db.purchaseOrderItems
        .where('purchase_order_id')
        .equals(id)
        .delete();
      
      // Add new items
      await db.purchaseOrderItems.bulkAdd(
        items.map(item => ({
          ...item,
          purchase_order_id: id
        }))
      );
      
      // Update expiry tracking for items with expiry dates
      for (const item of items) {
        if (item.expiry_date && item.batch_number) {
          try {
            // Check if this item already had expiry tracking
            const existingItem = existingItems.find(ei => ei.sku === item.sku && ei.batch_number === item.batch_number);
            
            if (existingItem) {
              // Find the existing expiry record
              const existingExpiry = await db.productExpiry
                .where('sku')
                .equals(item.sku)
                .and(record => record.batch_number === item.batch_number)
                .first();
              
              if (existingExpiry) {
                // Update the existing expiry record
                await db.productExpiry.update(existingExpiry.id!, {
                  expiry_date: item.expiry_date,
                  quantity: item.quantity,
                  updated_at: new Date()
                });
              } else {
                // Create a new expiry record
                await createExpiryRecord(item, id);
              }
            } else {
              // Create a new expiry record
              await createExpiryRecord(item, id);
            }
          } catch (error) {
            console.error(`Failed to update expiry tracking for item ${item.sku}:`, error);
            // Continue with other items even if one fails
          }
        }
      }
      
      // If the status changed to received or partially_received, update inventory
      if (currentPO && 
          (purchaseOrder.status === 'received' || purchaseOrder.status === 'partially_received') && 
          currentPO.status === 'ordered') {
        
        // Update inventory for each item
        for (const item of items) {
          try {
            // Get the current inventory item
            const inventoryItem = await db.inventory
              .where('sku')
              .equals(item.sku)
              .first();
            
            if (inventoryItem) {
              // Update existing inventory item
              const receivedQuantity = purchaseOrder.status === 'received' ? 
                item.quantity : 
                (item.quantity_received || 0);
              
              await db.inventory.update(inventoryItem.id!, {
                stock_quantity: (inventoryItem.stock_quantity || 0) + receivedQuantity,
                updated_at: new Date()
              });
            } else {
              // Create new inventory item
              const receivedQuantity = purchaseOrder.status === 'received' ? 
                item.quantity : 
                (item.quantity_received || 0);
              
              // Try to find product information
              const product = await db.products.where('sku').equals(item.sku).first();
              const variation = !product ? 
                await db.productVariations.where('sku').equals(item.sku).first() : 
                null;
              
              await db.inventory.add({
                product_id: product ? product.id : (variation ? variation.parent_id : 0),
                variation_id: variation ? variation.id : undefined,
                sku: item.sku,
                cost_price: item.unit_price,
                stock_quantity: receivedQuantity,
                supplier_name: currentPO.supplier_name,
                supplier_updated: new Date()
              });
            }
          } catch (error) {
            console.error(`Failed to update inventory for item ${item.sku}:`, error);
            // Continue with other items even if one fails
          }
        }
      }
    }
  });
};

// Helper function to create an expiry record from a purchase order item
async function createExpiryRecord(item: PurchaseOrderItem, purchaseOrderId: number): Promise<void> {
  const expiryData: Omit<ProductExpiry, 'id' | 'created_at' | 'updated_at'> = {
    product_id: 0, // Will be updated if product is found
    sku: item.sku,
    product_name: item.product_name,
    expiry_date: item.expiry_date!,
    batch_number: item.batch_number,
    quantity: item.quantity,
    notes: `Added from Purchase Order #${purchaseOrderId}`
  };
  
  // Try to find the product ID by SKU
  const product = await db.products.where('sku').equals(item.sku).first();
  if (product) {
    expiryData.product_id = product.id;
  } else {
    // Check if it's a variation
    const variation = await db.productVariations.where('sku').equals(item.sku).first();
    if (variation) {
      expiryData.product_id = variation.parent_id;
      expiryData.variation_id = variation.id;
    }
  }
  
  await addProductExpiry(expiryData);
}

// Delete a purchase order and its items
export const deletePurchaseOrder = async (id: number): Promise<void> => {
  return db.transaction('rw', db.purchaseOrders, db.purchaseOrderItems, async () => {
    // Delete the items first
    await db.purchaseOrderItems
      .where('purchase_order_id')
      .equals(id)
      .delete();
    
    // Delete the purchase order
    await db.purchaseOrders.delete(id);
  });
};

// Get purchase order items by SKU
export const getPurchaseOrderItemsBySku = async (sku: string): Promise<PurchaseOrderItem[]> => {
  return db.purchaseOrderItems
    .where('sku')
    .equals(sku)
    .toArray();
};

// Get total purchase amount for a date range
export const getTotalPurchaseAmount = async (startDate: Date, endDate: Date): Promise<number> => {
  const orders = await db.purchaseOrders
    .where('date')
    .between(startDate, endDate)
    .toArray();
  
  return orders.reduce((total, order) => total + order.total_amount, 0);
}; 