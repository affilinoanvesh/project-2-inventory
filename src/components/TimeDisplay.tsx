import React, { useState, useEffect } from 'react';
import { db } from '../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { RefreshCw } from 'lucide-react';
import { formatNZDate, formatRelativeTime, getCurrentNZDate } from '../utils/dateUtils';

interface TimeDisplayProps {
  className?: string;
}

interface SyncInfo {
  type: string;
  timestamp: Date;
  id: number;
}

const TimeDisplay: React.FC<TimeDisplayProps> = ({ className = '' }) => {
  const [currentTime, setCurrentTime] = useState<Date>(getCurrentNZDate());
  
  // Get the last sync times from the database
  const lastSyncTimes = useLiveQuery(async () => {
    return await db.lastSync.toArray();
  }, []);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(getCurrentNZDate());
    }, 60000); // Update every minute
    
    return () => clearInterval(timer);
  }, []);

  // Get sync info by type
  const getSyncInfo = (type: string): SyncInfo | undefined => {
    return lastSyncTimes?.find(sync => sync.type === type);
  };

  const productSync = getSyncInfo('products');
  const orderSync = getSyncInfo('orders');
  const inventorySync = getSyncInfo('inventory');

  return (
    <div className={`text-sm ${className}`}>
      <div className="flex justify-between items-center">
        <div className="font-medium text-gray-800">Current Time (NZ): {formatNZDate(currentTime)}</div>
        
        <div className="flex space-x-6">
          {productSync && (
            <div className="flex items-center text-gray-600">
              <RefreshCw size={14} className="mr-1" />
              <span>Products: {formatRelativeTime(productSync.timestamp)}</span>
            </div>
          )}
          
          {orderSync && (
            <div className="flex items-center text-gray-600">
              <RefreshCw size={14} className="mr-1" />
              <span>Orders: {formatRelativeTime(orderSync.timestamp)}</span>
            </div>
          )}
          
          {inventorySync && (
            <div className="flex items-center text-gray-600">
              <RefreshCw size={14} className="mr-1" />
              <span>Inventory: {formatRelativeTime(inventorySync.timestamp)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TimeDisplay; 