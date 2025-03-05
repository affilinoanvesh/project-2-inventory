// Export the database schema
export { db } from './schema';

// Export a function to reset the database for troubleshooting
export const resetDatabase = async (): Promise<boolean> => {
  try {
    const { db } = await import('./schema');
    return await db.resetDatabase();
  } catch (error) {
    console.error('Error resetting database:', error);
    return false;
  }
};

// Export all operations
export * from './operations/credentials';
export * from './operations/products';
export * from './operations/orders';
export * from './operations/inventory';
export * from './operations/overhead';
export * from './operations/expenses';
export * from './operations/sync';
export * from './operations/supplier';
export * from './operations/expiry';