import { db } from '../schema';
import { SupplierPriceImport, SupplierPriceItem } from '../../types';
import { updateSupplierPrice } from './inventory';

export async function saveSupplierImport(importData: SupplierPriceImport): Promise<number> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.supplierImports.add(importData);
  } catch (error) {
    console.error('Error saving supplier import:', error);
    throw error;
  }
}

export async function getSupplierImports(): Promise<SupplierPriceImport[]> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    return await db.supplierImports.toArray();
  } catch (error) {
    console.error('Error getting supplier imports:', error);
    return [];
  }
}

export async function saveSupplierImportItems(importId: number, items: SupplierPriceItem[]): Promise<void> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    // Save each item with the import ID
    await db.transaction('rw', db.supplierImportItems, async () => {
      for (const item of items) {
        await db.supplierImportItems.add({
          import_id: importId,
          sku: item.sku,
          name: item.name,
          supplier_price: item.supplier_price,
          supplier_name: item.supplier_name
        });
      }
    });
  } catch (error) {
    console.error('Error saving supplier import items:', error);
    throw error;
  }
}

export async function getSupplierImportItems(importId: number): Promise<SupplierPriceItem[]> {
  try {
    // Ensure the database is initialized before accessing
    await db.initializeDatabase();
    
    // Get items for the specified import
    const items = await db.supplierImportItems
      .where('import_id')
      .equals(importId)
      .toArray();
    
    // Convert to SupplierPriceItem format
    return items.map(item => ({
      sku: item.sku,
      name: item.name,
      supplier_price: item.supplier_price,
      supplier_name: item.supplier_name
    }));
  } catch (error) {
    console.error('Error getting supplier import items:', error);
    return [];
  }
}

export async function processSupplierPriceData(
  items: SupplierPriceItem[],
  supplierName: string,
  filename: string
): Promise<SupplierPriceImport> {
  try {
    console.log(`Processing ${items.length} supplier price items for ${supplierName}`);
    let updatedCount = 0;
    let skippedCount = 0;
    
    // Process each item
    for (const item of items) {
      if (!item.sku || !item.supplier_price) {
        console.log(`Skipping item with missing SKU or price: ${JSON.stringify(item)}`);
        skippedCount++;
        continue;
      }
      
      console.log(`Processing item: SKU=${item.sku}, Price=${item.supplier_price}`);
      
      const success = await updateSupplierPrice(
        item.sku,
        item.supplier_price,
        supplierName || item.supplier_name
      );
      
      if (success) {
        console.log(`Successfully updated supplier price for SKU: ${item.sku}`);
        updatedCount++;
      } else {
        console.log(`Failed to update supplier price for SKU: ${item.sku}`);
        skippedCount++;
      }
    }
    
    console.log(`Finished processing supplier prices. Updated: ${updatedCount}, Skipped: ${skippedCount}`);
    
    // Create import record
    const importRecord: SupplierPriceImport = {
      date: new Date(),
      filename,
      items_updated: updatedCount,
      items_skipped: skippedCount,
      supplier_name: supplierName
    };
    
    // Save import record
    const importId = await saveSupplierImport(importRecord);
    
    // Save the import items for future reuse
    await saveSupplierImportItems(importId, items);
    
    return {
      ...importRecord,
      id: importId
    };
  } catch (error) {
    console.error('Error processing supplier price data:', error);
    throw error;
  }
}