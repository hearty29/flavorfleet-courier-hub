// auto-generated and intentionally left blank, do not edit
import { pgTable, text, timestamp, numeric, uuid } from 'drizzle-orm/pg-core';

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  customerName: text('customer_name').notNull(),
  address: text('address').notNull(),
  phone: text('phone').notNull(),
  items: text('items').notNull(),
  totalAmount: numeric('total_amount').notNull(),
  status: text('status').notNull().default('pending'), // 'pending', 'picked_up', 'delivered'
  
  // Rider information fields
  riderId: uuid('rider_id'),
  riderName: text('rider_name'),
  riderPhone: text('rider_phone'),
  
  createdAt: timestamp('created_at').defaultNow(),
});
