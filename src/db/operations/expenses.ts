import { db } from '../schema';
import { Expense, ExpenseCategory, ExpenseImport } from '../../types';
import { format } from 'date-fns';
import { convertToNZTimezone } from '../../services/api/utils';

// Expense operations
export async function saveExpense(expense: Expense): Promise<number> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.expenses.add(expense);
  } catch (error) {
    console.error('Error saving expense:', error);
    throw error;
  }
}

export async function updateExpense(id: number, expense: Partial<Expense>): Promise<void> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    await db.expenses.update(id, expense);
  } catch (error) {
    console.error('Error updating expense:', error);
    throw error;
  }
}

export async function deleteExpense(id: number): Promise<void> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    await db.expenses.delete(id);
  } catch (error) {
    console.error('Error deleting expense:', error);
    throw error;
  }
}

export async function getExpenses(startDate?: Date, endDate?: Date): Promise<Expense[]> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    if (!startDate && !endDate) {
      return await db.expenses.toArray();
    }
    
    return await db.expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        if (startDate && endDate) {
          return expenseDate >= startDate && expenseDate <= endDate;
        } else if (startDate) {
          return expenseDate >= startDate;
        } else if (endDate) {
          return expenseDate <= endDate;
        }
        return true;
      })
      .toArray();
  } catch (error) {
    console.error('Error getting expenses:', error);
    return [];
  }
}

export async function getExpensesByCategory(category: string, startDate?: Date, endDate?: Date): Promise<Expense[]> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.expenses
      .filter(expense => {
        const expenseDate = new Date(expense.date);
        const categoryMatch = expense.category === category;
        
        if (startDate && endDate) {
          return categoryMatch && expenseDate >= startDate && expenseDate <= endDate;
        } else if (startDate) {
          return categoryMatch && expenseDate >= startDate;
        } else if (endDate) {
          return categoryMatch && expenseDate <= endDate;
        }
        return categoryMatch;
      })
      .toArray();
  } catch (error) {
    console.error('Error getting expenses by category:', error);
    return [];
  }
}

export async function getExpenseCategories(): Promise<ExpenseCategory[]> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.expenseCategories.toArray();
  } catch (error) {
    console.error('Error getting expense categories:', error);
    return [];
  }
}

export async function saveExpenseCategory(category: ExpenseCategory): Promise<number> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.expenseCategories.add(category);
  } catch (error) {
    console.error('Error saving expense category:', error);
    throw error;
  }
}

export async function updateExpenseCategory(id: number, category: Partial<ExpenseCategory>): Promise<void> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    await db.expenseCategories.update(id, category);
  } catch (error) {
    console.error('Error updating expense category:', error);
    throw error;
  }
}

export async function deleteExpenseCategory(id: number): Promise<void> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    await db.expenseCategories.delete(id);
  } catch (error) {
    console.error('Error deleting expense category:', error);
    throw error;
  }
}

export async function getExpensesByPeriod(period: 'daily' | 'weekly' | 'monthly' | 'yearly', startDate?: Date, endDate?: Date): Promise<Record<string, number>> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    // Get expenses within date range
    const expenses = await getExpenses(startDate, endDate);
    
    // Group expenses by period
    const expensesByPeriod: Record<string, number> = {};
    
    expenses.forEach(expense => {
      const date = new Date(expense.date);
      let periodKey: string;
      
      switch (period) {
        case 'daily':
          periodKey = date.toISOString().split('T')[0]; // YYYY-MM-DD
          break;
        case 'weekly':
          // Get ISO week number (1-53)
          const weekNumber = getWeekNumber(date);
          periodKey = `${date.getFullYear()}-W${weekNumber.toString().padStart(2, '0')}`;
          break;
        case 'monthly':
          periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          break;
        case 'yearly':
          periodKey = date.getFullYear().toString();
          break;
        default:
          periodKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
      }
      
      if (!expensesByPeriod[periodKey]) {
        expensesByPeriod[periodKey] = 0;
      }
      
      expensesByPeriod[periodKey] += expense.amount;
    });
    
    return expensesByPeriod;
  } catch (error) {
    console.error('Error getting expenses by period:', error);
    return {};
  }
}

// Helper function to get ISO week number
function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

// CSV Import functions
export async function saveExpenseImport(importData: ExpenseImport): Promise<number> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.expenseImports.add(importData);
  } catch (error) {
    console.error('Error saving expense import:', error);
    throw error;
  }
}

export async function getExpenseImports(): Promise<ExpenseImport[]> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.expenseImports.toArray();
  } catch (error) {
    console.error('Error getting expense imports:', error);
    return [];
  }
}

export async function processExpenseImport(
  csvData: string,
  columnMapping: Record<string, string>,
  defaultCategory: string
): Promise<{ imported: number, skipped: number, importId: number }> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    // Parse CSV data
    const lines = csvData.split('\n');
    if (lines.length <= 1) {
      throw new Error('CSV file is empty or contains only headers');
    }
    
    // Get headers
    const headers = lines[0].split(',').map(h => h.trim());
    
    // Get expense categories for validation
    const categories = await getExpenseCategories();
    const categoryNames = categories.map(c => c.name);
    
    // Add default category if it doesn't exist
    if (!categoryNames.includes(defaultCategory)) {
      await saveExpenseCategory({
        name: defaultCategory,
        description: 'Imported expenses',
        color: '#64748b'
      });
    }
    
    // Process each line
    const expenses: Expense[] = [];
    let skipped = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      // Split the line into values, handling quoted values
      const values = parseCSVLine(line);
      
      // Map CSV columns to expense properties
      try {
        const expense: Expense = {
          date: new Date(),
          category: defaultCategory,
          amount: 0,
          description: ''
        };
        
        // Map each column according to the mapping
        for (const [field, headerName] of Object.entries(columnMapping)) {
          const index = headers.indexOf(headerName);
          if (index !== -1 && index < values.length) {
            const value = values[index].trim();
            
            switch (field) {
              case 'date':
                // Try to parse the date in various formats
                expense.date = parseDate(value);
                break;
              case 'amount':
                // Parse amount, handling currency symbols and commas
                expense.amount = parseAmount(value);
                break;
              case 'category':
                // Use the value if it exists in our categories, otherwise use default
                expense.category = categoryNames.includes(value) ? value : defaultCategory;
                break;
              case 'description':
                expense.description = value;
                break;
              case 'reference':
                expense.reference = value;
                break;
              case 'payment_method':
                expense.payment_method = value;
                break;
              case 'tags':
                expense.tags = value.split(',').map(tag => tag.trim());
                break;
            }
          }
        }
        
        // Validate the expense
        if (expense.amount <= 0 || !isValidDate(expense.date)) {
          console.warn(`Skipping invalid expense on line ${i + 1}`);
          skipped++;
          continue;
        }
        
        // Convert to NZ timezone
        expense.date = convertToNZTimezone(expense.date);
        
        // Add to expenses array
        expenses.push(expense);
      } catch (error) {
        console.error(`Error processing line ${i + 1}:`, error);
        skipped++;
      }
    }
    
    // Save expenses to database
    if (expenses.length > 0) {
      await db.expenses.bulkAdd(expenses);
    }
    
    // Create import record
    const importRecord: ExpenseImport = {
      date: new Date(),
      filename: 'expense_import.csv',
      items_imported: expenses.length,
      items_skipped: skipped
    };
    
    // Save import record
    const importId = await saveExpenseImport(importRecord);
    
    return {
      imported: expenses.length,
      skipped,
      importId
    };
  } catch (error) {
    console.error('Error processing expense import:', error);
    throw error;
  }
}

// Helper function to parse a CSV line, handling quoted values
function parseCSVLine(line: string): string[] {
  const values: string[] = [];
  let currentValue = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      values.push(currentValue);
      currentValue = '';
    } else {
      currentValue += char;
    }
  }
  
  // Add the last value
  values.push(currentValue);
  
  return values;
}

// Helper function to parse a date string in various formats
function parseDate(dateStr: string): Date {
  // Try various date formats
  const formats = [
    // NZ format: dd/mm/yyyy
    (str: string) => {
      const parts = str.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      return null;
    },
    // ISO format: yyyy-mm-dd
    (str: string) => {
      const parts = str.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      return null;
    },
    // US format: mm/dd/yyyy
    (str: string) => {
      const parts = str.split('/');
      if (parts.length === 3) {
        const month = parseInt(parts[0], 10) - 1;
        const day = parseInt(parts[1], 10);
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      return null;
    },
    // Try parsing with Date constructor
    (str: string) => {
      const date = new Date(str);
      return isValidDate(date) ? date : null;
    }
  ];
  
  for (const formatFn of formats) {
    const date = formatFn(dateStr);
    if (date && isValidDate(date)) {
      return date;
    }
  }
  
  // Default to today if parsing fails
  console.warn(`Could not parse date: ${dateStr}, using today's date`);
  return new Date();
}

// Helper function to parse an amount string
function parseAmount(amountStr: string): number {
  // Remove currency symbols and commas
  const cleanedStr = amountStr.replace(/[$£€,]/g, '');
  
  // Parse as float
  const amount = parseFloat(cleanedStr);
  
  // Return absolute value (expenses are positive in our system)
  return Math.abs(amount);
}

// Helper function to check if a date is valid
function isValidDate(date: Date): boolean {
  return date instanceof Date && !isNaN(date.getTime());
}