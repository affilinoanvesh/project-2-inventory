import { ApiCredentials, Order, Product, InventoryItem, OverheadCost, ProductVariation, Expense, SupplierPriceImport, SupplierPriceItem, ExpenseCategory, ExpenseImport, ProductExpiry, PurchaseOrder, PurchaseOrderItem, AdditionalRevenue, AdditionalRevenueCategory } from '../types';
import Dexie, { Table } from 'dexie';

export class AppDatabase extends Dexie {
  products!: Table<Product>;
  productVariations!: Table<ProductVariation>;
  orders!: Table<Order>;
  inventory!: Table<InventoryItem & { id?: number }>;
  overheadCosts!: Table<OverheadCost>;
  apiCredentials!: Table<ApiCredentials & { id?: number }>;
  lastSync!: Table<{ id: number; timestamp: Date; type: string }>;
  expenses!: Table<Expense>;
  expenseCategories!: Table<ExpenseCategory>;
  expenseImports!: Table<ExpenseImport>;
  supplierImports!: Table<SupplierPriceImport>;
  supplierImportItems!: Table<SupplierPriceItem & { id?: number; import_id: number }>;
  productExpiry!: Table<ProductExpiry & { id?: number }>;
  purchaseOrders!: Table<PurchaseOrder>;
  purchaseOrderItems!: Table<PurchaseOrderItem>;
  suppliers!: Table<{ id: number; name: string; email: string; phone: string; created_at: Date }>;
  additionalRevenue!: Table<AdditionalRevenue>;
  additionalRevenueCategories!: Table<AdditionalRevenueCategory>;

  constructor() {
    super('WooCommercePnLTracker');
    
    this.version(1).stores({
      products: '++id, name, sku, type',
      productVariations: '++id, parent_id, sku',
      orders: '++id, number, date_created, status',
      inventory: '++id, product_id, variation_id, sku',
      overheadCosts: '++id, name, type',
      apiCredentials: '++id',
      lastSync: '++id, type',
      expenses: '++id, date, category, period',
      expenseCategories: '++id, name',
      expenseImports: '++id, date, filename',
      supplierImports: '++id, date, supplier_name',
      supplierImportItems: '++id, import_id, sku'
    });

    // Add version 2 with the new productExpiry table
    this.version(2).stores({
      productExpiry: '++id, product_id, variation_id, sku, expiry_date'
    });
    
    // Add version 3 with the new purchase order tables
    this.version(3).stores({
      purchaseOrders: '++id, date, supplier_name, supplier_id, reference_number, status, expiry_date, created_at',
      purchaseOrderItems: '++id, purchase_order_id, sku, product_name, quantity, batch_number, expiry_date'
    });

    // Add suppliers table
    this.version(4).stores({
      suppliers: '++id, name, email, phone, created_at'
    });
    
    // Add additional revenue tables
    this.version(5).stores({
      additionalRevenue: '++id, date, category, period',
      additionalRevenueCategories: '++id, name'
    });
  }

  // Initialize the database with default tables if needed
  async initializeDatabase() {
    try {
      // Check if the database is already initialized
      const isInitialized = await this.isInitialized();
      if (!isInitialized) {
        console.log('Initializing database...');
        // Create empty tables to ensure they exist
        await this.products.clear();
        await this.productVariations.clear();
        await this.orders.clear();
        await this.inventory.clear();
        await this.overheadCosts.clear();
        await this.apiCredentials.clear();
        await this.lastSync.clear();
        await this.expenses.clear();
        await this.expenseCategories.clear();
        await this.expenseImports.clear();
        await this.supplierImports.clear();
        await this.supplierImportItems.clear();
        await this.additionalRevenue.clear();
        await this.additionalRevenueCategories.clear();
        
        // Add default expense categories
        await this.expenseCategories.bulkAdd([
          { name: 'Rent', description: 'Office or workspace rent', color: '#4f46e5', is_tax_deductible: true },
          { name: 'Utilities', description: 'Electricity, water, internet, etc.', color: '#0ea5e9', is_tax_deductible: true },
          { name: 'Salaries', description: 'Employee salaries and wages', color: '#10b981', is_tax_deductible: true },
          { name: 'Marketing', description: 'Advertising and marketing expenses', color: '#f59e0b', is_tax_deductible: true },
          { name: 'Software', description: 'Software subscriptions and licenses', color: '#8b5cf6', is_tax_deductible: true },
          { name: 'Office Supplies', description: 'Office supplies and equipment', color: '#ec4899', is_tax_deductible: true },
          { name: 'Travel', description: 'Business travel expenses', color: '#f43f5e', is_tax_deductible: true },
          { name: 'Shipping', description: 'Shipping and postage costs', color: '#6366f1', is_tax_deductible: true },
          { name: 'Insurance', description: 'Business insurance premiums', color: '#14b8a6', is_tax_deductible: true },
          { name: 'Other', description: 'Miscellaneous expenses', color: '#64748b', is_tax_deductible: false }
        ]);
        
        // Add default additional revenue categories
        await this.additionalRevenueCategories.bulkAdd([
          { name: 'Offline Sales', description: 'Sales made offline or in-person', color: '#4f46e5', is_taxable: true },
          { name: 'GST Returns', description: 'GST tax returns', color: '#0ea5e9', is_taxable: false },
          { name: 'Refunds', description: 'Refunds from suppliers or services', color: '#10b981', is_taxable: false },
          { name: 'Grants', description: 'Business grants or subsidies', color: '#f59e0b', is_taxable: true },
          { name: 'Investments', description: 'Investment returns', color: '#8b5cf6', is_taxable: true },
          { name: 'Other', description: 'Other revenue sources', color: '#64748b', is_taxable: true }
        ]);
        
        // Add a flag to indicate the database has been initialized
        localStorage.setItem('db_initialized', 'true');
        console.log('Database initialized successfully');
      }
    } catch (error) {
      console.error('Error initializing database:', error);
      // If there's an error, try to recreate the database
      await this.recreateDatabase();
    }
  }

  // Check if the database has been initialized
  async isInitialized() {
    try {
      // Try to access each table to see if they exist
      await this.products.count();
      await this.productVariations.count();
      await this.orders.count();
      await this.inventory.count();
      await this.overheadCosts.count();
      await this.apiCredentials.count();
      await this.lastSync.count();
      await this.expenses.count();
      await this.expenseCategories.count();
      await this.expenseImports.count();
      await this.supplierImports.count();
      await this.supplierImportItems.count();
      await this.additionalRevenue.count();
      await this.additionalRevenueCategories.count();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Recreate the database if there are issues
  async recreateDatabase() {
    try {
      console.log('Recreating database...');
      // Delete the database
      await Dexie.delete('WooCommercePnLTracker');
      
      // Create a new instance
      const newDb = new AppDatabase();
      
      // Open the new database
      await newDb.open();
      
      // Copy the new instance properties to this instance
      Object.assign(this, newDb);
      
      console.log('Database recreated successfully');
      return true;
    } catch (error) {
      console.error('Failed to recreate database:', error);
      return false;
    }
  }

  // Reset the database (for troubleshooting)
  async resetDatabase() {
    try {
      console.log('Resetting database...');
      
      // Delete the database
      await Dexie.delete('WooCommercePnLTracker');
      
      // Remove localStorage flags
      localStorage.removeItem('db_initialized');
      localStorage.removeItem('has_api_credentials');
      
      // Create a new instance
      const newDb = new AppDatabase();
      
      // Open the new database
      await newDb.open();
      
      // Copy the new instance properties to this instance
      Object.assign(this, newDb);
      
      // Initialize the database
      await this.initializeDatabase();
      
      console.log('Database reset successfully');
      return true;
    } catch (error) {
      console.error('Failed to reset database:', error);
      return false;
    }
  }
}

export const db = new AppDatabase();

// Initialize the database when the module is loaded
db.initializeDatabase().catch(error => {
  console.error('Failed to initialize database:', error);
});