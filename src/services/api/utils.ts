/**
 * Utility functions for API services
 */

/**
 * Safely update progress without causing Symbol cloning errors
 * This function ensures that progress callbacks are executed safely
 * and any errors are caught and logged without crashing the application
 */
export const safeUpdateProgress = (
  progressCallback: ((progress: number) => void) | undefined, 
  progress: number
): void => {
  if (!progressCallback || typeof progressCallback !== 'function') {
    return;
  }

  try {
    // Only pass a primitive number value to avoid Symbol cloning errors
    // Ensure the progress is a simple number between 0-100
    const safeProgress = Math.min(Math.max(0, Math.round(progress)), 100);
    
    // Use requestAnimationFrame for better performance and to avoid Symbol cloning issues
    // This also helps with UI updates by syncing with the browser's render cycle
    window.requestAnimationFrame(() => {
      try {
        progressCallback(safeProgress);
      } catch (innerError) {
        // Silently handle errors to prevent crashes
      }
    });
  } catch (error) {
    // Silently handle errors to prevent crashes
  }
};

/**
 * Helper function to check if a date is older than one day
 */
export const isOlderThanOneDay = (date: Date): boolean => {
  const oneDayInMs = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const now = new Date();
  return (now.getTime() - date.getTime()) > oneDayInMs;
};

/**
 * Format date to NZ format (dd/MM/yyyy)
 */
export const formatNZDate = (date: Date): string => {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Format date to ISO string with NZ timezone offset
 */
export const formatDateForAPI = (date: Date): string => {
  // New Zealand is UTC+12 or UTC+13 during daylight saving
  // For December (month 11), we need to be extra careful with timezone handling
  if (date.getMonth() === 11) {
    // For December, ensure we're using the correct timezone offset
    // Clone the date to avoid modifying the original
    const adjustedDate = new Date(date);
    
    // If it's the end of December, add an extra hour to ensure we capture all orders
    if (date.getDate() >= 28) {
      adjustedDate.setHours(adjustedDate.getHours() + 1);
      console.log(`End of December detected - Adding extra hour buffer: ${date.toISOString()} -> ${adjustedDate.toISOString()}`);
    }
    
    return adjustedDate.toISOString();
  }
  
  // For other months, use the standard ISO string
  return date.toISOString();
};

/**
 * Chunk an array into smaller arrays of specified size
 * Used for processing large datasets in smaller batches
 */
export const chunkArray = <T>(array: T[], chunkSize: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

/**
 * Get NZ timezone string
 */
export const getNZTimezone = (): string => {
  // Determine if NZ is currently in daylight saving time
  const now = new Date();
  const jan = new Date(now.getFullYear(), 0, 1);
  const jul = new Date(now.getFullYear(), 6, 1);
  
  // NZ DST typically runs from late September to early April
  // This is a simplified check - for production, use a proper timezone library
  const isDST = now.getMonth() > 8 || now.getMonth() < 4;
  
  return isDST ? 'NZDT' : 'NZST';
};

/**
 * Get NZ timezone offset in hours
 */
export const getNZTimezoneOffset = (): number => {
  // NZ is UTC+12, or UTC+13 during daylight saving
  const isDST = getNZTimezone() === 'NZDT';
  return isDST ? 13 : 12;
};

/**
 * Convert a date to NZ timezone
 */
export const convertToNZTimezone = (date: Date): Date => {
  const nzOffset = getNZTimezoneOffset();
  const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
  return new Date(utcDate.getTime() + nzOffset * 3600000);
};

/**
 * Process data in batches with delay to prevent UI freezing
 * @param items Items to process
 * @param processFn Function to process each batch
 * @param batchSize Size of each batch
 * @param delayMs Delay between batches in milliseconds
 * @param progressCallback Optional callback for progress updates
 */
export const processBatches = async <T, R>(
  items: T[],
  processFn: (batch: T[]) => Promise<R[]>,
  batchSize: number = 10,
  delayMs: number = 50,
  progressCallback?: (progress: number) => void
): Promise<R[]> => {
  const batches = chunkArray(items, batchSize);
  let results: R[] = [];
  
  for (let i = 0; i < batches.length; i++) {
    // Process current batch
    const batchResults = await processFn(batches[i]);
    results = [...results, ...batchResults];
    
    // Update progress
    const progress = Math.round(((i + 1) / batches.length) * 100);
    safeUpdateProgress(progressCallback, progress);
    
    // Add delay between batches to prevent UI freezing
    if (i < batches.length - 1 && delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  return results;
};