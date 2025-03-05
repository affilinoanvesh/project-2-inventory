import { Product, ProductVariation } from '../../types';
import { createWooCommerceClient } from './credentials';
import { saveProducts, saveProductVariations, getProducts } from '../../db';
import { updateLastSync } from './sync';
import { safeUpdateProgress, chunkArray } from './utils';

// Extract cost price from product metadata or attributes
export const extractCostPrice = (product: any): number => {
  // Try to find cost price in meta data
  if (product.meta_data && Array.isArray(product.meta_data)) {
    // Check for cost price meta
    const costMeta = product.meta_data.find((meta: any) => 
      meta.key === '_wc_cog_cost' || 
      meta.key === 'cost_price' || 
      meta.key === '_cost_price'
    );
    
    if (costMeta && costMeta.value) {
      return parseFloat(costMeta.value);
    }
  }
  
  // Try to find cost price in attributes
  if (product.attributes && Array.isArray(product.attributes)) {
    const costAttr = product.attributes.find((attr: any) => 
      attr.name.toLowerCase() === 'cost' || 
      attr.name.toLowerCase() === 'cost price'
    );
    
    if (costAttr && costAttr.options && costAttr.options[0]) {
      return parseFloat(costAttr.options[0]);
    }
  }
  
  // Check if we have a stored cost price in the database
  const storedCostPrice = localStorage.getItem(`product_cost_${product.id}`);
  if (storedCostPrice) {
    return parseFloat(storedCostPrice);
  }
  
  // Default to 0 if no cost price found
  return 0;
};

// Format variation name based on attributes
export const formatVariationName = (productName: string, attributes: Array<{name: string, option: string}>): string => {
  if (!attributes || attributes.length === 0) return productName;
  
  const attributeString = attributes
    .map(attr => `${attr.name}: ${attr.option}`)
    .join(', ');
  
  return `${productName} - ${attributeString}`;
};

// Fetch all products with pagination and optimized for large datasets
const fetchAllProducts = async (progressCallback?: (progress: number) => void): Promise<any[]> => {
  const client = await createWooCommerceClient();
  let allProducts: any[] = [];
  let page = 1;
  let totalPages = 1;
  const perPage = 100; // Maximum allowed by WooCommerce API
  
  try {
    // Get existing products to check for changes
    const existingProducts = await getProducts();
    const existingProductIds = new Set(existingProducts.map(p => p.id));
    
    // Initial progress update
    safeUpdateProgress(progressCallback, 10);
    
    // First request to get total count
    const initialResponse = await client.get('/products', {
      params: {
        per_page: perPage,
        page: 1
      }
    });
    
    // Get total pages from response headers
    totalPages = parseInt(initialResponse.headers['x-wp-totalpages'] || '1', 10);
    const totalProducts = parseInt(initialResponse.headers['x-wp-total'] || '0', 10);
    
    console.log(`Found ${totalProducts} products across ${totalPages} pages`);
    
    // Add first page results
    allProducts = allProducts.concat(initialResponse.data);
    
    // Create an array of page numbers to fetch
    const remainingPages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2);
    
    // Process pages in chunks to avoid overwhelming the API
    const pageChunks = chunkArray(remainingPages, 5);
    
    for (let chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex++) {
      const chunk = pageChunks[chunkIndex];
      
      // Update progress based on chunks processed
      const chunkProgress = 10 + Math.floor((chunkIndex / pageChunks.length) * 60);
      safeUpdateProgress(progressCallback, Math.min(chunkProgress, 70));
      
      // Process each page in the current chunk sequentially to avoid rate limiting
      for (const pageNum of chunk) {
        try {
          const response = await client.get('/products', {
            params: {
              per_page: perPage,
              page: pageNum
            }
          });
          
          // Add products to our collection
          allProducts = allProducts.concat(response.data);
          
          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`Error fetching products page ${pageNum}:`, error);
          // Continue with next page even if one fails
        }
      }
    }
    
    // Log how many products were fetched
    console.log(`Fetched ${allProducts.length} products from API`);
    
    // Check how many are new
    const newProductCount = allProducts.filter(p => !existingProductIds.has(p.id)).length;
    console.log(`${newProductCount} new products found`);
    
    return allProducts;
  } catch (error) {
    console.error('Error fetching all products:', error);
    throw error;
  }
};

// Fetch all variations for a product with pagination
const fetchAllVariations = async (productId: number): Promise<any[]> => {
  const client = await createWooCommerceClient();
  let allVariations: any[] = [];
  let page = 1;
  let totalPages = 1;
  const perPage = 100; // Maximum allowed by WooCommerce API
  
  try {
    // First request to get total count
    const initialResponse = await client.get(`/products/${productId}/variations`, {
      params: {
        per_page: perPage,
        page: 1
      }
    });
    
    // Get total pages from response headers
    totalPages = parseInt(initialResponse.headers['x-wp-totalpages'] || '1', 10);
    
    // Add first page results
    allVariations = allVariations.concat(initialResponse.data);
    
    // Fetch remaining pages
    for (let pageNum = 2; pageNum <= totalPages; pageNum++) {
      try {
        const response = await client.get(`/products/${productId}/variations`, {
          params: {
            per_page: perPage,
            page: pageNum
          }
        });
        
        allVariations = allVariations.concat(response.data);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`Error fetching variations page ${pageNum} for product ${productId}:`, error);
        // Continue with next page even if one fails
      }
    }
    
    return allVariations;
  } catch (error) {
    console.error(`Error fetching variations for product ${productId}:`, error);
    throw error;
  }
};

// Fetch products from WooCommerce API and store in database
export const syncProducts = async (progressCallback?: (progress: number) => void): Promise<Product[]> => {
  // Initial progress update
  safeUpdateProgress(progressCallback, 10);
  
  try {
    // Get existing products and variations
    const existingProducts = await getProducts();
    const existingProductMap = new Map(existingProducts.map(p => [p.id, p]));
    
    // Fetch all products with pagination
    const rawProducts = await fetchAllProducts(progressCallback);
    
    // Process products
    const products = rawProducts.map((product: any) => {
      // Check if we already have this product
      const existingProduct = existingProductMap.get(product.id);
      
      // If we have an existing product, preserve its cost_price and supplier info
      if (existingProduct) {
        return {
          ...product,
          regular_price: parseFloat(product.regular_price || product.price || '0'),
          sale_price: product.sale_price ? parseFloat(product.sale_price) : undefined,
          cost_price: existingProduct.cost_price,
          supplier_price: existingProduct.supplier_price,
          supplier_name: existingProduct.supplier_name,
          supplier_updated: existingProduct.supplier_updated
        };
      }
      
      // Otherwise, create a new product
      return {
        ...product,
        regular_price: parseFloat(product.regular_price || product.price || '0'),
        sale_price: product.sale_price ? parseFloat(product.sale_price) : undefined,
        cost_price: extractCostPrice(product)
      };
    });
    
    // Process products to identify variable products
    const variableProducts = products.filter(product => product.type === 'variable');
    
    // Update progress
    safeUpdateProgress(progressCallback, 70);
    
    // Fetch variations for variable products
    const variations: ProductVariation[] = [];
    let variationCount = 0;
    const totalVariableProducts = variableProducts.length;
    
    // Process variable products in chunks to avoid overwhelming the API
    const productChunks = chunkArray(variableProducts, 5);
    
    for (let chunkIndex = 0; chunkIndex < productChunks.length; chunkIndex++) {
      const chunk = productChunks[chunkIndex];
      
      // Process each product in the current chunk
      for (const product of chunk) {
        if (product.variations && product.variations.length > 0) {
          // Fetch all variations with pagination
          const productVariationsRaw = await fetchAllVariations(product.id);
          
          const productVariations = productVariationsRaw.map((variation: any) => {
            // Extract attributes
            const attributes = variation.attributes.map((attr: any) => ({
              name: attr.name,
              option: attr.option
            }));
            
            // Create a formatted variation object
            return {
              id: variation.id,
              parent_id: product.id,
              name: formatVariationName(product.name, attributes),
              sku: variation.sku || '',
              price: parseFloat(variation.price || '0'),
              regular_price: parseFloat(variation.regular_price || variation.price || '0'),
              sale_price: variation.sale_price ? parseFloat(variation.sale_price) : undefined,
              stock_quantity: variation.stock_quantity || 0,
              attributes,
              cost_price: extractCostPrice(variation)
            };
          });
          
          variations.push(...productVariations);
        }
        
        // Update progress for variations
        variationCount++;
        if (totalVariableProducts > 0) {
          const variationProgress = 70 + Math.floor((variationCount / totalVariableProducts) * 20);
          safeUpdateProgress(progressCallback, Math.min(variationProgress, 90));
        }
      }
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Update progress
    safeUpdateProgress(progressCallback, 90);
    
    // Save products and variations to database
    await saveProducts(products);
    await saveProductVariations(variations);
    await updateLastSync('products');
    
    // Final progress update
    safeUpdateProgress(progressCallback, 100);
    
    return products;
  } catch (error) {
    console.error('Error syncing products:', error);
    throw error;
  }
};

// Fetch products from database
export const fetchProducts = async () => {
  return await getProducts();
};