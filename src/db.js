// src/db.js
import Dexie from 'dexie';

// 1. Create the local browser database instance
export const db = new Dexie('SariSariStoreDB');

// 2. Define the schema tables and indexes
// IMPORTANT: Only index fields you intend to search or filter with (.where())
db.version(1).stores({
  inventory: '++id, &barcode, name', 
  // '++id' auto-increments unique primary IDs
  // '&barcode' ensures every barcode is completely unique (no duplicates)
  // 'name' is indexed for quick search lookup

  sales: '++id, timestamp',
  // 'timestamp' is indexed to pull sales reports by specific dates

  saleItems: '++id, saleId, productId',
  // 'saleId' links back to parent sales transaction
  // 'productId' links back to the source inventory item

  creditLog: '++id, customerName, status'
  // 'customerName' and 'status' (e.g., 'unpaid', 'paid') tracking for "lista" records
});