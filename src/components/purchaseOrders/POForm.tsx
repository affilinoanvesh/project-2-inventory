import React, { useState, useEffect } from 'react';
import { PurchaseOrder, PurchaseOrderItem, Product, Supplier } from '../../types';
import { createPurchaseOrder, updatePurchaseOrder } from '../../db/operations/purchaseOrders';
import { db } from '../../db';
import POFormHeader from './form/POFormHeader';
import POFormDetails from './form/POFormDetails';
import POFormItemsTable from './form/POFormItemsTable';
import POFormActions from './form/POFormActions';

interface POFormProps {
  purchaseOrderId?: number;
  onCancel: () => void;
  onSave: () => void;
}

const POForm: React.FC<POFormProps> = ({ purchaseOrderId, onCancel, onSave }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [showProductSearch, setShowProductSearch] = useState<number | null>(null);
  const [isFormDirty, setIsFormDirty] = useState(false);

  // Form state
  const [formData, setFormData] = useState<PurchaseOrder>({
    date: new Date(),
    supplier_name: '',
    supplier_id: undefined,
    reference_number: '',
    total_amount: 0,
    payment_method: 'Bank Transfer',
    status: 'ordered',
    notes: '',
    created_at: new Date()
  });

  const [items, setItems] = useState<PurchaseOrderItem[]>([]);

  // Load existing purchase order if editing
  useEffect(() => {
    const loadPurchaseOrder = async () => {
      if (!purchaseOrderId) return;
      
      setIsLoading(true);
      try {
        const result = await db.transaction('r', db.purchaseOrders, db.purchaseOrderItems, async () => {
          const po = await db.purchaseOrders.get(purchaseOrderId);
          if (!po) throw new Error('Purchase order not found');
          
          const poItems = await db.purchaseOrderItems
            .where('purchase_order_id')
            .equals(purchaseOrderId)
            .toArray();
            
          return { po, poItems };
        });
        
        setFormData(result.po);
        setItems(result.poItems);
      } catch (err) {
        setError(`Failed to load purchase order: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadPurchaseOrder();
  }, [purchaseOrderId]);

  // Load products and suppliers
  useEffect(() => {
    const loadData = async () => {
      try {
        const [allProducts, allSuppliers] = await Promise.all([
          db.products.toArray(),
          db.suppliers.toArray()
        ]);
        setProducts(allProducts);
        setSuppliers(allSuppliers);
      } catch (err) {
        console.error('Failed to load data:', err);
      }
    };
    
    loadData();
  }, []);

  // Search products when search term changes
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    
    const term = searchTerm.toLowerCase();
    const results = products.filter(product => 
      product.name.toLowerCase().includes(term) || 
      (product.sku && product.sku.toLowerCase().includes(term))
    ).slice(0, 10); // Limit to 10 results
    
    setSearchResults(results);
  }, [searchTerm, products]);

  // Track form changes
  useEffect(() => {
    setIsFormDirty(true);
  }, [formData, items]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, date: new Date(e.target.value) }));
  };

  const handleSupplierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const supplierId = e.target.value ? parseInt(e.target.value, 10) : undefined;
    const supplier = suppliers.find(s => s.id === supplierId);
    
    setFormData(prev => ({
      ...prev,
      supplier_id: supplierId,
      supplier_name: supplier ? supplier.name : prev.supplier_name
    }));
  };

  const addItem = () => {
    const newItem: PurchaseOrderItem = {
      purchase_order_id: purchaseOrderId || 0,
      sku: '',
      product_name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      batch_number: '',
      notes: ''
    };
    
    setItems(prev => [...prev, newItem]);
  };

  const removeItem = (index: number) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof PurchaseOrderItem, value: any) => {
    setItems(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Recalculate total price if quantity or unit price changes
      if (field === 'quantity' || field === 'unit_price') {
        const quantity = field === 'quantity' ? value : updated[index].quantity;
        const unitPrice = field === 'unit_price' ? value : updated[index].unit_price;
        updated[index].total_price = quantity * unitPrice;
      }
      
      return updated;
    });
  };

  const handleItemExpiryDateChange = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value ? new Date(e.target.value) : undefined;
    updateItem(index, 'expiry_date', value);
  };

  const selectProduct = (product: Product, index: number) => {
    updateItem(index, 'sku', product.sku || '');
    updateItem(index, 'product_name', product.name);
    updateItem(index, 'unit_price', product.cost_price || 0);
    updateItem(index, 'total_price', (product.cost_price || 0) * items[index].quantity);
    setShowProductSearch(null);
    setSearchTerm('');
  };

  const calculateTotal = () => {
    const total = items.reduce((sum, item) => sum + item.total_price, 0);
    setFormData(prev => ({ ...prev, total_amount: total }));
    return total;
  };

  useEffect(() => {
    calculateTotal();
  }, [items]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (items.length === 0) {
      setError('Please add at least one item to the purchase order');
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      if (purchaseOrderId) {
        // Update existing purchase order
        await updatePurchaseOrder(purchaseOrderId, formData, items);
      } else {
        // Create new purchase order
        await createPurchaseOrder(formData, items);
      }
      
      onSave();
    } catch (err) {
      setError(`Failed to save purchase order: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemsUploaded = (newItems: PurchaseOrderItem[]) => {
    setItems(prev => [...prev, ...newItems]);
  };

  if (isLoading && purchaseOrderId) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-2 text-gray-600">Loading purchase order...</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      <POFormHeader 
        title={purchaseOrderId ? 'Edit Purchase Order' : 'Create Purchase Order'} 
        error={error}
        purchaseOrderId={purchaseOrderId}
      />
      
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <POFormDetails 
            formData={formData}
            suppliers={suppliers}
            handleInputChange={handleInputChange}
            handleDateChange={handleDateChange}
            handleSupplierChange={handleSupplierChange}
          />
          
          <POFormItemsTable 
            items={items}
            searchTerm={searchTerm}
            searchResults={searchResults}
            showProductSearch={showProductSearch}
            totalAmount={formData.total_amount}
            purchaseOrderId={purchaseOrderId}
            onAddItem={addItem}
            onRemoveItem={removeItem}
            onUpdateItem={updateItem}
            onSearchTermChange={setSearchTerm}
            onShowProductSearch={setShowProductSearch}
            onSelectProduct={selectProduct}
            onExpiryDateChange={handleItemExpiryDateChange}
            onItemsUploaded={handleItemsUploaded}
            onError={setError}
          />
          
          <POFormActions 
            isLoading={isLoading}
            purchaseOrderId={purchaseOrderId}
            onCancel={onCancel}
            isFormDirty={isFormDirty}
          />
        </form>
      </div>
    </div>
  );
};

export default POForm; 