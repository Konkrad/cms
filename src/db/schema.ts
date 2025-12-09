import { pgTable, text, uuid, timestamp, numeric, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  familyName: text('family_name').notNull(),
  displayName: text('display_name').notNull().default(''),
  email: text('email').unique().notNull(),
  city: text('city'),
  country: text('country'),
  longitude: numeric('longitude'),
  latitude: numeric('latitude'),
  yearOfBirth: integer('year_of_birth'),
  sex: text('sex'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const posts = pgTable('posts', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export const events = pgTable('events', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }).notNull(),
  locationType: text('location_type').notNull(),
  address: text('address'),
  longitude: numeric('longitude'),
  latitude: numeric('latitude'),
  onlineUrl: text('online_url'),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
