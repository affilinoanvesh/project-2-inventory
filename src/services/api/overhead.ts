import { OverheadCost } from '../../types';
import { saveOverheadCosts as dbSaveOverheadCosts, getOverheadCosts as dbGetOverheadCosts } from '../../db';

// Fetch overhead costs from database
export const fetchOverheadCosts = async (): Promise<OverheadCost[]> => {
  return await dbGetOverheadCosts();
};

// Save overhead costs to database
export const saveOverheadCosts = async (costs: OverheadCost[]): Promise<void> => {
  await dbSaveOverheadCosts(costs);
};