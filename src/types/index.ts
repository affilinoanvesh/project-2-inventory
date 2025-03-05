export interface ProductVariation {
  id: number;
  parent_id: number;
  name: string;
  sku?: string;
  price: number;
  regular_price?: number;
  sale_price?: number;
  cost_price?: number;
  supplier_price?: number;
  supplier_name?: string;
  supplier_updated?: Date;
  stock_quantity?: number;
  attributes: Array<{
    name: string;
    option: string;
  }>;
}

export interface ProductExpiry {
  id?: number;
  product_id: number;
  variation_id?: number;
  sku: string;
  product_name?: string;
  expiry_date: Date;
  batch_number?: string;
  quantity: number;
  stock_quantity?: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Product {
  id: number;
  name: string;
  sku?: string;
  price: number;
  regular_price?: number;
  sale_price?: number;
  cost_price?: number;
  supplier_price?: number;
  supplier_name?: string;
  supplier_updated?: Date;
  stock_quantity?: number;
  type?: string;
  variations?: number[];
  productVariations?: ProductVariation[];
}

export interface OrderItem {
  id: number;
  product_id: number;
  variation_id?: number;
  name: string;
  quantity: number;
  price: number;
  total: string;
  sku?: string;
  cost_price?: number;
  profit?: number;
  margin?: number;
  meta_data?: Array<{
    key: string;
    value: string;
  }>;
}

export interface Order {
  id: number;
  number: string;
  date_created: string;
  date_created_nz?: string; // Date in NZ timezone
  date_created_display?: string; // Formatted date for display
  status: string;
  total: string;
  line_items: OrderItem[];
  shipping_total: string;
  payment_method: string;
  payment_method_title: string;
  cost_total?: number;
  profit?: number;
  margin?: number;
}

export interface InventoryItem {
  product_id: number;
  variation_id?: number;
  sku: string;
  cost_price: number;
  supplier_price?: number;
  supplier_name?: string;
  supplier_updated?: Date;
  stock_quantity?: number;
  retail_value?: number;
  cost_value?: number;
  regular_price?: number;
  sale_price?: number;
  price?: number;
}

export interface OverheadCost {
  id: number;
  name: string;
  type: 'fixed' | 'percentage' | 'per_order' | 'per_item';
  value: number;
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface PnLSummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  averageMargin: number;
  orderCount: number;
  itemCount: number;
  periodStart: string;
  periodEnd: string;
}

export interface ApiCredentials {
  url: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface Expense {
  id?: number;
  date: Date;
  category: string;
  amount: number;
  description: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  reference?: string;
  payment_method?: string;
  tax_deductible?: boolean;
  tags?: string[];
}

export interface ExpenseCategory {
  id?: number;
  name: string;
  description?: string;
  color?: string;
  is_tax_deductible?: boolean;
  budget_monthly?: number;
}

export interface ExpenseImport {
  id?: number;
  date: Date;
  filename: string;
  items_imported: number;
  items_skipped: number;
}

export interface AdditionalRevenue {
  id?: number;
  date: Date;
  category: string;
  amount: number;
  description: string;
  period?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  reference?: string;
  payment_method?: string;
  tax_included?: boolean;
  tags?: string[];
}

export interface AdditionalRevenueCategory {
  id?: number;
  name: string;
  description?: string;
  color?: string;
  is_taxable?: boolean;
  budget_monthly?: number;
}

export interface SupplierPriceImport {
  id?: number;
  date: Date;
  filename: string;
  items_updated: number;
  items_skipped: number;
  supplier_name: string;
}

export interface SupplierPriceItem {
  id?: number;
  import_id?: number;
  sku: string;
  name?: string;
  supplier_price: number;
  supplier_name: string;
}

export interface ReportData {
  orders: Order[];
  products: Product[];
  expenses: Expense[];
  additionalRevenue: AdditionalRevenue[];
  salesData: any[];
  productData: any[];
  expenseData: any[];
  additionalRevenueReport: any[];
  profitabilityData: any[];
  totalRevenue: number;
  totalAdditionalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
}

export interface Supplier {
  id?: number;
  name: string;
  contact_person?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  payment_terms?: string;
  notes?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface PurchaseOrder {
  id?: number;
  date: Date;
  supplier_name: string;
  supplier_id?: number;
  reference_number: string;
  total_amount: number;
  payment_method: string;
  status: 'ordered' | 'received' | 'partially_received';
  notes?: string;
  expiry_date?: Date;
  created_at: Date;
  updated_at?: Date;
}

export interface PurchaseOrderItem {
  id?: number;
  purchase_order_id: number;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  quantity_received?: number;
  batch_number?: string;
  expiry_date?: Date;
  notes?: string;
}