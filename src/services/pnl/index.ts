import { Order, InventoryItem, OverheadCost, DateRange } from '../../types';
import { getExpenses } from '../../db/operations/expenses';
import { calculateOrderProfits } from './orderCalculations';
import { calculateExpenses } from './expenseCalculations';
import { createInventoryMap } from './inventoryUtils';

/**
 * Calculate profit and margins for orders with expenses included
 */
export const calculateProfitAndLoss = async (
  orders: Order[],
  inventory: InventoryItem[],
  overheadCosts: OverheadCost[],
  dateRange: DateRange
) => {
  // Create inventory map for quick lookups
  const inventoryMap = createInventoryMap(inventory);

  // Get expenses for the date range
  const expenses = await getExpenses(dateRange.startDate, dateRange.endDate);
  
  // Calculate expense data
  const { 
    totalExpenses, 
    expensesByCategory 
  } = calculateExpenses(expenses, dateRange);

  // Calculate overhead distribution
  const { 
    overheadPerOrder, 
    perOrderOverhead, 
    perItemOverhead, 
    percentageOverheadCalculator 
  } = calculateOverheadDistribution(orders, overheadCosts);

  // Process each order with profit calculations
  const processedOrders = calculateOrderProfits(
    orders, 
    inventoryMap, 
    overheadPerOrder,
    perOrderOverhead,
    perItemOverhead,
    percentageOverheadCalculator
  );

  // Calculate summary
  const totalRevenue = processedOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
  const totalCost = processedOrders.reduce((sum, order) => sum + (order.cost_total || 0), 0);
  const totalProfit = totalRevenue - totalCost;
  const netProfit = totalProfit - totalExpenses;
  const averageMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const orderCount = processedOrders.length;
  const itemCount = processedOrders.reduce(
    (sum, order) => sum + order.line_items.reduce((itemSum, item) => itemSum + item.quantity, 0), 
    0
  );

  return {
    orders: processedOrders,
    summary: {
      totalRevenue,
      totalCost,
      totalProfit,
      totalExpenses,
      netProfit,
      averageMargin,
      orderCount,
      itemCount,
      expensesByCategory
    }
  };
};

/**
 * Calculate overhead distribution across orders
 */
function calculateOverheadDistribution(orders: Order[], overheadCosts: OverheadCost[]) {
  // Calculate monthly overhead costs per day
  const totalMonthlyOverhead = overheadCosts
    .filter(cost => cost.type === 'fixed')
    .reduce((sum, cost) => sum + cost.value, 0);
  
  // Get unique days in the order set
  const uniqueDays = new Set(orders.map(order => {
    const date = new Date(order.date_created);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }));
  
  const daysInPeriod = uniqueDays.size || 1;
  const daysInMonth = 30; // Average days in a month
  const dailyOverhead = totalMonthlyOverhead / daysInMonth;
  const overheadPerDay = dailyOverhead;
  const overheadPerOrder = overheadPerDay / (orders.length / daysInPeriod || 1);

  // Calculate per-order overhead
  const perOrderOverhead = overheadCosts
    .filter(cost => cost.type === 'per_order')
    .reduce((sum, cost) => sum + cost.value, 0);

  // Calculate per-item overhead
  const perItemOverhead = (item: any) => {
    return overheadCosts
      .filter(cost => cost.type === 'per_item')
      .reduce((sum, cost) => sum + (cost.value * item.quantity), 0);
  };

  // Calculate percentage-based overhead
  const percentageOverheadCalculator = (orderTotal: number) => {
    return overheadCosts
      .filter(cost => cost.type === 'percentage')
      .reduce((sum, cost) => sum + (orderTotal * cost.value / 100), 0);
  };

  return {
    overheadPerOrder,
    perOrderOverhead,
    perItemOverhead,
    percentageOverheadCalculator
  };
}

// Export all sub-modules
export * from './orderCalculations';
export * from './expenseCalculations';
export * from './inventoryUtils';