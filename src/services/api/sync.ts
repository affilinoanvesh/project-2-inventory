import { Product, Order, InventoryItem } from '../../types';
import { db, getLastSyncTimes as dbGetLastSyncTimes } from '../../db';
import { syncProducts } from './products';
import { syncOrdersByMonth } from './orders';
import { syncInventory } from './inventory';
import { hasApiCredentials } from './credentials';
import { format, addMonths, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { safeUpdateProgress, isOlderThanOneDay, processBatches } from './utils';

// Sync all data from WooCommerce API
export const syncAllData = async (progressCallback?: (progress: number) => void): Promise<{ products: Product[], orders: Order[], inventory: InventoryItem[] }> => {
  // Ensure the database is initialized before syncing
  await db.initializeDatabase();
  
  // Check if API credentials are set
  const hasCredentials = await hasApiCredentials();
  if (!hasCredentials) {
    throw new Error('API credentials not set');
  }
  
  try {
    // Update progress if callback provided
    safeUpdateProgress(progressCallback, 5);
    
    // Get last sync times
    const lastSyncTimes = await dbGetLastSyncTimes();
    
    // Sync products only if they haven't been synced before or it's been more than a day
    let products: Product[] = [];
    if (!lastSyncTimes.products || isOlderThanOneDay(lastSyncTimes.products)) {
      // Update progress
      safeUpdateProgress(progressCallback, 10);
      
      // Sync products
      products = await syncProducts((progress) => {
        // Map product sync progress to 10-40% of overall progress
        const mappedProgress = 10 + Math.floor((progress * 0.3));
        safeUpdateProgress(progressCallback, mappedProgress);
      });
    } else {
      // Skip product sync, just load from database
      products = await db.products.toArray();
      
      // Update progress
      safeUpdateProgress(progressCallback, 40);
    }
    
    // Sync orders month by month for the last 3 months
    const endDate = new Date();
    const startDate = subMonths(endDate, 3); // Last 3 months
    
    // Get all months in the interval
    const months = eachMonthOfInterval({
      start: startOfMonth(startDate),
      end: endOfMonth(endDate)
    });
    
    console.log(`Syncing orders for ${months.length} months from ${format(startDate, 'MMMM yyyy')} to ${format(endDate, 'MMMM yyyy')}`);
    
    // Define a function to process a month
    const processMonth = async (month: Date): Promise<Order[]> => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);
      
      console.log(`Processing month: ${format(month, 'MMMM yyyy')}`);
      
      // Sync orders for this month
      return await syncOrdersByMonth(
        monthStart,
        monthEnd,
        // We don't pass the progress callback here to avoid nested progress updates
        // that could cause Symbol cloning errors
      );
    };
    
    // Process all months in batches with delays between batches
    const allOrders = await processBatches(
      months,
      async (monthsBatch) => {
        const batchResults: Order[] = [];
        
        for (const month of monthsBatch) {
          const monthOrders = await processMonth(month);
          batchResults.push(...monthOrders);
        }
        
        return batchResults;
      },
      1, // Process 1 month at a time
      500, // 500ms delay between months
      (progress) => {
        // Map batch progress to 40-70% of overall progress
        const mappedProgress = 40 + Math.floor((progress * 0.3));
        safeUpdateProgress(progressCallback, mappedProgress);
      }
    );
    
    // Update progress
    safeUpdateProgress(progressCallback, 70);
    
    // Sync inventory
    const inventory = await syncInventory((progress) => {
      // Map inventory sync progress to 70-100% of overall progress
      const mappedProgress = 70 + Math.floor((progress * 0.3));
      safeUpdateProgress(progressCallback, mappedProgress);
    });
    
    return { products, orders: allOrders, inventory };
  } catch (error) {
    console.error('Error syncing data:', error);
    throw error;
  }
};

// Sync only products
export const syncProductsOnly = async (progressCallback?: (progress: number) => void): Promise<Product[]> => {
  // Ensure the database is initialized before syncing
  await db.initializeDatabase();
  
  // Check if API credentials are set
  const hasCredentials = await hasApiCredentials();
  if (!hasCredentials) {
    throw new Error('API credentials not set');
  }
  
  try {
    // Update progress if callback provided
    safeUpdateProgress(progressCallback, 5);
    
    // Sync products
    const products = await syncProducts((progress) => {
      // Map product sync progress to 5-95% of overall progress
      const mappedProgress = 5 + Math.floor((progress * 0.9));
      safeUpdateProgress(progressCallback, mappedProgress);
    });
    
    // Final progress update
    safeUpdateProgress(progressCallback, 100);
    
    return products;
  } catch (error) {
    console.error('Error syncing products:', error);
    throw error;
  }
};

// Export getLastSyncTimes from the database module
export const getLastSyncTimes = dbGetLastSyncTimes;

// Export updateLastSync function
export const updateLastSync = async (type: string): Promise<void> => {
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
};