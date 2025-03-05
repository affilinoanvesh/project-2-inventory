// Main API service entry point
import { ApiCredentials, Order, Product, InventoryItem } from '../../types';
import { 
  updateProductCostPrice as dbUpdateProductCostPrice,
  resetDatabase as dbResetDatabase
} from '../../db';

// Re-export all API services
export * from './credentials';
export * from './products';
export * from './orders';
export * from './inventory';
export * from './overhead';
export * from './sync';
export * from './utils';

// Export database operations that are directly used by components
export const updateProductCostPrice = dbUpdateProductCostPrice;
export const resetDatabase = dbResetDatabase;

// Export testApiCredentials from credentials
export { testApiCredentials } from './credentials';

// Export order-related functions
export { 
  deleteOrder, 
  syncOrdersByYear, 
  syncOrdersByMonth,
  syncOrdersByDateRange,
  forceDecemberSync,
  fetchDecemberOrdersDirectly,
  fetchDecemberOrdersInChunks,
  hasDecemberOrders,
  testDecemberApiConnection
} from './orders';