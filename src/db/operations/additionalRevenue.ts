import { db } from '../schema';
import { AdditionalRevenue, AdditionalRevenueCategory } from '../../types';
import { format } from 'date-fns';
import { convertToNZTimezone } from '../../services/api/utils';

// Additional Revenue operations
export async function saveAdditionalRevenue(revenue: AdditionalRevenue): Promise<number> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.additionalRevenue.add(revenue) as number;
  } catch (error) {
    console.error('Error saving additional revenue:', error);
    throw error;
  }
}

export async function updateAdditionalRevenue(id: number, revenue: Partial<AdditionalRevenue>): Promise<void> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    await db.additionalRevenue.update(id, revenue);
  } catch (error) {
    console.error('Error updating additional revenue:', error);
    throw error;
  }
}

export async function deleteAdditionalRevenue(id: number): Promise<void> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    await db.additionalRevenue.delete(id);
  } catch (error) {
    console.error('Error deleting additional revenue:', error);
    throw error;
  }
}

export async function getAdditionalRevenue(startDate?: Date, endDate?: Date): Promise<AdditionalRevenue[]> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    if (!startDate && !endDate) {
      return await db.additionalRevenue.toArray();
    }
    
    return await db.additionalRevenue
      .filter(revenue => {
        const revenueDate = new Date(revenue.date);
        if (startDate && endDate) {
          return revenueDate >= startDate && revenueDate <= endDate;
        } else if (startDate) {
          return revenueDate >= startDate;
        } else if (endDate) {
          return revenueDate <= endDate;
        }
        return true;
      })
      .toArray();
  } catch (error) {
    console.error('Error getting additional revenue:', error);
    return [];
  }
}

export async function getAdditionalRevenueByCategory(category: string, startDate?: Date, endDate?: Date): Promise<AdditionalRevenue[]> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.additionalRevenue
      .filter(revenue => {
        const revenueDate = new Date(revenue.date);
        const categoryMatch = revenue.category === category;
        
        if (startDate && endDate) {
          return categoryMatch && revenueDate >= startDate && revenueDate <= endDate;
        } else if (startDate) {
          return categoryMatch && revenueDate >= startDate;
        } else if (endDate) {
          return categoryMatch && revenueDate <= endDate;
        }
        return categoryMatch;
      })
      .toArray();
  } catch (error) {
    console.error('Error getting additional revenue by category:', error);
    return [];
  }
}

export async function getAdditionalRevenueCategories(): Promise<AdditionalRevenueCategory[]> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.additionalRevenueCategories.toArray();
  } catch (error) {
    console.error('Error getting additional revenue categories:', error);
    return [];
  }
}

export async function saveAdditionalRevenueCategory(category: AdditionalRevenueCategory): Promise<number> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.additionalRevenueCategories.add(category) as number;
  } catch (error) {
    console.error('Error saving additional revenue category:', error);
    throw error;
  }
}

export async function updateAdditionalRevenueCategory(id: number, category: Partial<AdditionalRevenueCategory>): Promise<void> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    await db.additionalRevenueCategories.update(id, category);
  } catch (error) {
    console.error('Error updating additional revenue category:', error);
    throw error;
  }
}

export async function deleteAdditionalRevenueCategory(id: number): Promise<void> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    await db.additionalRevenueCategories.delete(id);
  } catch (error) {
    console.error('Error deleting additional revenue category:', error);
    throw error;
  }
}

export async function getAdditionalRevenueByPeriod(period: 'daily' | 'weekly' | 'monthly' | 'yearly', startDate?: Date, endDate?: Date): Promise<Record<string, number>> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    // Get additional revenue within date range
    const revenues = await getAdditionalRevenue(startDate, endDate);
    
    // Group additional revenue by period
    const revenueByPeriod: Record<string, number> = {};
    
    revenues.forEach(revenue => {
      const date = new Date(revenue.date);
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
      
      if (!revenueByPeriod[periodKey]) {
        revenueByPeriod[periodKey] = 0;
      }
      
      revenueByPeriod[periodKey] += revenue.amount;
    });
    
    return revenueByPeriod;
  } catch (error) {
    console.error('Error getting additional revenue by period:', error);
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