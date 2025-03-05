import { format } from 'date-fns';
import { Order, Product, Expense } from '../../types';
import { groupDataByPeriod } from './utils';

// Generate sales report
export const generateSalesReport = (orders: Order[], periodType: string) => {
  // Group orders by period
  const groupedData = groupDataByPeriod(orders, (order) => parseFloat(order.total), 'date_created', periodType);
  
  // Add additional metrics
  return groupedData.map(item => {
    const periodOrders = orders.filter(order => {
      const orderDate = new Date(order.date_created);
      const periodFormat = getPeriodFormat(periodType);
      return format(orderDate, periodFormat) === item.period;
    });
    
    const totalRevenue = periodOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const totalCost = periodOrders.reduce((sum, order) => sum + (order.cost_total || 0), 0);
    const totalProfit = totalRevenue - totalCost;
    const orderCount = periodOrders.length;
    const averageOrderValue = orderCount > 0 ? totalRevenue / orderCount : 0;
    
    return {
      ...item,
      revenue: totalRevenue,
      cost: totalCost,
      profit: totalProfit,
      orderCount,
      averageOrderValue
    };
  });
};

// Generate products report
export const generateProductsReport = (orders: Order[], products: Product[], periodType: string) => {
  // Extract all line items from orders
  const lineItems = orders.flatMap(order => order.line_items);
  
  // Group by product
  const productMap = new Map<string, {
    id: number,
    name: string,
    sku: string,
    quantity: number,
    revenue: number,
    cost: number,
    profit: number,
    margin: number
  }>();
  
  lineItems.forEach(item => {
    const key = `${item.product_id}${item.variation_id ? `-${item.variation_id}` : ''}`;
    
    if (!productMap.has(key)) {
      productMap.set(key, {
        id: item.product_id,
        name: item.name,
        sku: item.sku || '',
        quantity: 0,
        revenue: 0,
        cost: 0,
        profit: 0,
        margin: 0
      });
    }
    
    const product = productMap.get(key)!;
    product.quantity += item.quantity;
    product.revenue += parseFloat(item.total);
    product.cost += (item.cost_price || 0) * item.quantity;
  });
  
  // Calculate profit and margin
  return Array.from(productMap.values()).map(product => {
    const profit = product.revenue - product.cost;
    const margin = product.revenue > 0 ? (profit / product.revenue) * 100 : 0;
    
    return {
      ...product,
      profit,
      margin
    };
  });
};

// Generate expenses report
export const generateExpensesReport = (expenses: Expense[], periodType: string) => {
  // Group by category
  const categoryMap = new Map<string, {
    category: string,
    amount: number,
    count: number,
    percentage: number
  }>();
  
  const totalExpenseAmount = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  expenses.forEach(expense => {
    if (!categoryMap.has(expense.category)) {
      categoryMap.set(expense.category, {
        category: expense.category,
        amount: 0,
        count: 0,
        percentage: 0
      });
    }
    
    const category = categoryMap.get(expense.category)!;
    category.amount += expense.amount;
    category.count += 1;
  });
  
  // Calculate percentages
  categoryMap.forEach(category => {
    category.percentage = totalExpenseAmount > 0 
      ? (category.amount / totalExpenseAmount) * 100 
      : 0;
  });
  
  // Convert to array
  const categoryData = Array.from(categoryMap.values());
  
  // Group by time period
  const timeData = groupDataByPeriod(expenses, (expense) => expense.amount, 'date', periodType);
  
  // Return both category and time-based data
  return [...categoryData, ...timeData];
};

// Generate profitability report
export const generateProfitabilityReport = (orders: Order[], expenses: Expense[], periodType: string) => {
  // Group orders by period
  const monthlyData = groupDataByPeriod(orders, (order) => parseFloat(order.total), 'date_created', periodType);
  
  // Group expenses by period
  const monthlyExpenses = groupDataByPeriod(expenses, (expense) => expense.amount, 'date', periodType);
  
  // Merge data
  return monthlyData.map(item => {
    const matchingExpense = monthlyExpenses.find(exp => exp.period === item.period);
    const expenseAmount = matchingExpense ? matchingExpense.value : 0;
    
    const periodOrders = orders.filter(order => {
      const orderDate = new Date(order.date_created);
      const periodFormat = getPeriodFormat(periodType);
      return format(orderDate, periodFormat) === item.period;
    });
    
    const totalRevenue = periodOrders.reduce((sum, order) => sum + parseFloat(order.total), 0);
    const totalCost = periodOrders.reduce((sum, order) => sum + (order.cost_total || 0), 0);
    const grossProfit = totalRevenue - totalCost;
    const netProfit = grossProfit - expenseAmount;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    
    return {
      period: item.period,
      revenue: totalRevenue,
      cost: totalCost,
      expenses: expenseAmount,
      grossProfit,
      netProfit,
      profitMargin
    };
  });
};

// Helper function to get period format based on period type
const getPeriodFormat = (periodType: string): string => {
  switch (periodType) {
    case 'daily':
      return 'yyyy-MM-dd';
    case 'weekly':
      return "yyyy-'W'ww"; // ISO week
    case 'monthly':
      return 'MMM yyyy';
    case 'quarterly':
      return 'QQQ yyyy';
    case 'yearly':
      return 'yyyy';
    default:
      return 'MMM yyyy';
  }
};