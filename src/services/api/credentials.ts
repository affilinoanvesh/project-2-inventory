import axios, { AxiosInstance } from 'axios';
import { ApiCredentials } from '../../types';
import { 
  saveApiCredentials as dbSaveApiCredentials,
  getApiCredentials as dbGetApiCredentials,
  hasApiCredentials as dbHasApiCredentials
} from '../../db';

// Cache for the WooCommerce client
let clientCache: {
  instance: AxiosInstance | null;
  credentials: string | null; // JSON string of credentials for comparison
  timestamp: number | null;
  expiresIn: number; // milliseconds
} = {
  instance: null,
  credentials: null,
  timestamp: null,
  expiresIn: 30 * 60 * 1000 // 30 minutes
};

// Set API credentials
export const setApiCredentials = async (credentials: ApiCredentials): Promise<void> => {
  try {
    // Validate credentials before saving
    if (!credentials.url || !credentials.consumerKey || !credentials.consumerSecret) {
      throw new Error('All API credential fields are required');
    }
    
    // Ensure URL doesn't have trailing slash
    const url = credentials.url.endsWith('/') 
      ? credentials.url.slice(0, -1) 
      : credentials.url;
    
    // Save credentials to database
    await dbSaveApiCredentials({
      ...credentials,
      url
    });
    
    // Also store a flag in localStorage to indicate credentials exist
    localStorage.setItem('has_api_credentials', 'true');
    
    console.log('API credentials saved successfully');
  } catch (error) {
    console.error('Error saving API credentials:', error);
    throw error;
  }
};

// Get API credentials
export const getApiCredentials = async (): Promise<ApiCredentials | null> => {
  try {
    return await dbGetApiCredentials();
  } catch (error) {
    console.error('Error getting API credentials:', error);
    return null;
  }
};

// Check if API credentials are set
export const hasApiCredentials = async (): Promise<boolean> => {
  try {
    // First check localStorage for a quick answer
    const hasCredentialsFlag = localStorage.getItem('has_api_credentials');
    if (hasCredentialsFlag === 'true') {
      // Double-check by actually querying the database
      const credentials = await dbGetApiCredentials();
      return !!credentials;
    }
    
    // If no flag in localStorage, check the database directly
    const credentials = await dbGetApiCredentials();
    if (credentials) {
      // Set the flag if credentials exist
      localStorage.setItem('has_api_credentials', 'true');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking API credentials:', error);
    return false;
  }
};

// Create axios instance with WooCommerce authentication
export const createWooCommerceClient = async (): Promise<AxiosInstance> => {
  const credentials = await getApiCredentials();
  if (!credentials) {
    throw new Error('API credentials not set');
  }
  
  // Create a string representation of credentials for comparison
  const credentialsString = JSON.stringify({
    url: credentials.url,
    consumerKey: credentials.consumerKey,
    consumerSecret: credentials.consumerSecret
  });
  
  // Check if we have a valid cached client
  const now = Date.now();
  if (
    clientCache.instance && 
    clientCache.credentials === credentialsString &&
    clientCache.timestamp && 
    (now - clientCache.timestamp < clientCache.expiresIn)
  ) {
    console.log('Using cached WooCommerce client');
    return clientCache.instance;
  }
  
  // Log the API endpoint for debugging
  console.log(`Creating new WooCommerce client for endpoint: ${credentials.url}/wp-json/wc/v3`);
  
  // Ensure URL doesn't have trailing slash
  const baseURL = credentials.url.endsWith('/') 
    ? `${credentials.url.slice(0, -1)}/wp-json/wc/v3` 
    : `${credentials.url}/wp-json/wc/v3`;
  
  // Create axios instance with extended timeout and better error handling
  const client = axios.create({
    baseURL,
    auth: {
      username: credentials.consumerKey,
      password: credentials.consumerSecret
    },
    timeout: 30000, // 30 second timeout
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  
  // Add request interceptor for debugging
  client.interceptors.request.use(
    config => {
      // Don't log auth details
      const sanitizedConfig = { ...config };
      if (sanitizedConfig.auth) {
        sanitizedConfig.auth = { username: '***', password: '***' };
      }
      console.log('API Request:', {
        method: sanitizedConfig.method,
        url: sanitizedConfig.url,
        params: sanitizedConfig.params
      });
      return config;
    },
    error => {
      console.error('API Request Error:', error);
      return Promise.reject(error);
    }
  );
  
  // Add response interceptor for better error handling
  client.interceptors.response.use(
    response => response,
    error => {
      // Log detailed error information
      console.error('API Error:', {
        url: error.config?.url,
        method: error.config?.method,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      });
      
      // Enhance error message with more details
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        const message = error.response.data?.message || error.response.statusText;
        error.message = `API Error (${error.response.status}): ${message}`;
      } else if (error.request) {
        // The request was made but no response was received
        error.message = 'No response received from the API. Please check your internet connection.';
      }
      // Otherwise, something happened in setting up the request that triggered an Error
      
      return Promise.reject(error);
    }
  );
  
  // Cache the client
  clientCache.instance = client;
  clientCache.credentials = credentialsString;
  clientCache.timestamp = Date.now();
  
  return client;
};

// Check if ATUM API is available
export const checkAtumApiAvailability = async (): Promise<boolean> => {
  return false; // Always return false since we're not using ATUM
};

// Test API credentials
export const testApiCredentials = async (credentials: ApiCredentials): Promise<boolean> => {
  try {
    // Ensure URL doesn't have trailing slash
    const url = credentials.url.endsWith('/') 
      ? credentials.url.slice(0, -1) 
      : credentials.url;
    
    // Create a test client
    const client = axios.create({
      baseURL: `${url}/wp-json/wc/v3`,
      auth: {
        username: credentials.consumerKey,
        password: credentials.consumerSecret
      }
    });
    
    // Try to fetch a simple endpoint
    const response = await client.get('/system_status', { timeout: 5000 });
    return response.status === 200;
  } catch (error) {
    console.error('Error testing API credentials:', error);
    return false;
  }
};