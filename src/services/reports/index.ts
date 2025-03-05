import { DateRange, Order, Product, Expense } from '../../types';
import { fetchOrders, fetchProducts, fetchInventory, fetchOverheadCosts } from '../api';
import { getExpenses } from '../../db/operations/expenses';
import { calculateProfitAndLoss } from '../pnl';
import { 
  generateSalesReport, 
  generateProductsReport, 
  generateExpensesReport, 
  generateProfitabilityReport 
} from './generators';

// Load all report data
export const loadReportData = async (
  dateRange: DateRange, 
  periodType: string
) => {
  try {
    // Fetch data
    const ordersData = await fetchOrders();
    const productsData = await fetchProducts();
    const inventoryData = await fetchInventory();
    const overheadCosts = await fetchOverheadCosts();
    const expensesData = await getExpenses(dateRange.startDate, dateRange.endDate);
    
    // Calculate profit and margins with expenses
    const result = await calculateProfitAndLoss(
      ordersData,
      inventoryData,
      overheadCosts,
      dateRange
    );
    
    // Filter orders by date range
    const filteredOrders = result.orders.filter(order => {
      const orderDate = new Date(order.date_created);
      return orderDate >= dateRange.startDate && orderDate <= dateRange.endDate;
    });
    
    // Generate report data
    const salesData = generateSalesReport(filteredOrders, periodType);
    const productData = generateProductsReport(filteredOrders, productsData, periodType);
    const expenseData = generateExpensesReport(expensesData, periodType);
    const profitabilityData = generateProfitabilityReport(filteredOrders, expensesData, periodType);
    
    return {
      orders: filteredOrders,
      products: productsData,
      expenses: expensesData,
      salesData,
      productData,
      expenseData,
      profitabilityData
    };
  } catch (error) {
    console.error('Error loading report data:', error);
    throw error;
  }
};

// Export all report generators
export * from './generators';
export * from './utils';