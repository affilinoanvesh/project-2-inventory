import { db } from '../schema';

export async function updateLastSync(type: string): Promise<void> {
  try {
    const id = 
      type === 'products' ? 1 : 
      type === 'orders' ? 2 : 
      type === 'inventory' ? 3 : 
      type === 'product_variations' ? 4 : 5;
      
    await db.lastSync.put({
      id,
      type,
      timestamp: new Date()
    });
  } catch (error) {
    console.error('Error updating last sync:', error);
  }
}

export async function getLastSync(type: string): Promise<Date | null> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    const id = 
      type === 'products' ? 1 : 
      type === 'orders' ? 2 : 
      type === 'inventory' ? 3 : 
      type === 'product_variations' ? 4 : 5;
      
    const sync = await db.lastSync.get(id);
    return sync?.timestamp || null;
  } catch (error) {
    console.error('Error getting last sync:', error);
    return null;
  }
}

export async function getLastSyncTimes(): Promise<{
  products: Date | null;
  orders: Date | null;
  inventory: Date | null;
}> {
  const productsSync = await getLastSync('products');
  const ordersSync = await getLastSync('orders');
  const inventorySync = await getLastSync('inventory');
  
  return {
    products: productsSync,
    orders: ordersSync,
    inventory: inventorySync
  };
}