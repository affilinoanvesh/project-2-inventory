import { Expense, DateRange } from '../../types';

/**
 * Calculate expenses and prorate them based on period type
 */
export function calculateExpenses(expenses: Expense[], dateRange: DateRange) {
  // Group expenses by period type
  const dailyExpenses = expenses.filter(expense => expense.period === 'daily');
  const weeklyExpenses = expenses.filter(expense => expense.period === 'weekly');
  const monthlyExpenses = expenses.filter(expense => expense.period === 'monthly');
  const yearlyExpenses = expenses.filter(expense => expense.period === 'yearly');
  const oneTimeExpenses = expenses.filter(expense => !expense.period);
  
  // Calculate prorated expenses for the period
  const daysBetween = Math.max(1, Math.ceil((dateRange.endDate.getTime() - dateRange.startDate.getTime()) / (1000 * 60 * 60 * 24)));
  const weeksBetween = Math.max(1, Math.ceil(daysBetween / 7));
  const monthsBetween = Math.max(1, Math.ceil(daysBetween / 30));
  const yearsBetween = Math.max(1, Math.ceil(daysBetween / 365));
  
  // Calculate total expenses for the period
  const totalDailyExpenses = dailyExpenses.reduce((sum, expense) => sum + expense.amount * daysBetween, 0);
  const totalWeeklyExpenses = weeklyExpenses.reduce((sum, expense) => sum + expense.amount * weeksBetween, 0);
  const totalMonthlyExpenses = monthlyExpenses.reduce((sum, expense) => sum + expense.amount * monthsBetween, 0);
  const totalYearlyExpenses = yearlyExpenses.reduce((sum, expense) => sum + expense.amount * yearsBetween, 0);
  const totalOneTimeExpenses = oneTimeExpenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  // Total expenses for the period
  const totalExpenses = totalDailyExpenses + totalWeeklyExpenses + totalMonthlyExpenses + totalYearlyExpenses + totalOneTimeExpenses;
  
  // Group expenses by category
  const expensesByCategory: Record<string, number> = {};
  expenses.forEach(expense => {
    if (!expensesByCategory[expense.category]) {
      expensesByCategory[expense.category] = 0;
    }
    
    // Add prorated amount based on period type
    if (expense.period === 'daily') {
      expensesByCategory[expense.category] += expense.amount * daysBetween;
    } else if (expense.period === 'weekly') {
      expensesByCategory[expense.category] += expense.amount * weeksBetween;
    } else if (expense.period === 'monthly') {
      expensesByCategory[expense.category] += expense.amount * monthsBetween;
    } else if (expense.period === 'yearly') {
      expensesByCategory[expense.category] += expense.amount * yearsBetween;
    } else {
      // One-time expense
      expensesByCategory[expense.category] += expense.amount;
    }
  });

  return {
    totalExpenses,
    expensesByCategory,
    periodDetails: {
      dailyExpenses: totalDailyExpenses,
      weeklyExpenses: totalWeeklyExpenses,
      monthlyExpenses: totalMonthlyExpenses,
      yearlyExpenses: totalYearlyExpenses,
      oneTimeExpenses: totalOneTimeExpenses,
      daysBetween,
      weeksBetween,
      monthsBetween,
      yearsBetween
    }
  };
}