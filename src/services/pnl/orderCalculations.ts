import { Order } from '../../types';

/**
 * Calculate profits for all orders
 */
export function calculateOrderProfits(
  orders: Order[],
  inventoryMap: Map<string, any>,
  overheadPerOrder: number,
  perOrderOverhead: number,
  perItemOverhead: (item: any) => number,
  percentageOverheadCalculator: (orderTotal: number) => number
) {
  return orders.map(order => {
    // Calculate percentage-based overhead
    const orderTotal = parseFloat(order.total);
    const percentageOverhead = percentageOverheadCalculator(orderTotal);

    // Process line items
    const lineItems = order.line_items.map(item => {
      // First try to find by SKU (most accurate)
      let costPrice = 0;
      let supplierPrice = 0;
      
      if (item.sku) {
        const inventoryItem = inventoryMap.get(item.sku);
        if (inventoryItem) {
          costPrice = inventoryItem.cost_price || 0;
          supplierPrice = inventoryItem.supplier_price || 0;
        }
      }
      
      // If no SKU match, try by product/variation ID
      if (costPrice === 0 && supplierPrice === 0) {
        const lookupKey = item.variation_id 
          ? `${item.product_id}_${item.variation_id}` 
          : `${item.product_id}`;
        const inventoryItem = inventoryMap.get(lookupKey);
        if (inventoryItem) {
          costPrice = inventoryItem.cost_price || 0;
          supplierPrice = inventoryItem.supplier_price || 0;
        }
      }
      
      // If still no match, use the item's cost_price if available
      if (costPrice === 0 && supplierPrice === 0) {
        costPrice = item.cost_price || 0;
      }
      
      // Use supplier price if available, otherwise use cost price
      const finalCostPrice = supplierPrice > 0 ? supplierPrice : costPrice;
      const itemCost = finalCostPrice * item.quantity;
      
      // Calculate per-item overhead
      const itemOverhead = perItemOverhead(item);
      
      const totalCost = itemCost + itemOverhead;
      const revenue = parseFloat(item.total);
      const profit = revenue - totalCost;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      return {
        ...item,
        cost_price: finalCostPrice,
        profit,
        margin
      };
    });

    // Calculate order totals
    const costTotal = lineItems.reduce((sum, item) => sum + (item.cost_price || 0) * item.quantity, 0);
    const totalOverhead = perOrderOverhead + percentageOverhead + overheadPerOrder;
    const totalCost = costTotal + totalOverhead;
    const revenue = parseFloat(order.total);
    const profit = revenue - totalCost;
    const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      ...order,
      line_items: lineItems,
      cost_total: totalCost,
      profit,
      margin
    };
  });
}