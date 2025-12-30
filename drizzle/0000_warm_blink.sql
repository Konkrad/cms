CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`location_type` text NOT NULL,
	`address` text,
	`city` text,
	`country` text,
	`longitude` text,
	`latitude` text,
	`online_url` text,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `logins` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`magic_hash` text,
	`otp_hash` text,
	`expires_at` text NOT NULL,
	`otp_attempts` integer DEFAULT 0 NOT NULL,
	`magic_used` integer DEFAULT false NOT NULL,
	`otp_used` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `logins_email_unique` ON `logins` (`email`);--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY NOT NULL,
	`menu_name` text NOT NULL,
	`label` text NOT NULL,
	`url` text NOT NULL,
	`parent_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`icon` text,
	`target` text DEFAULT '_self' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`parent_id` text,
	`content` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`editor_state` text,
	`user_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`login_id` text,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_unique` ON `sessions` (`token`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`family_name` text NOT NULL,
	`display_name` text NOT NULL,
	`login_id` text,
	`city` text,
	`country` text,
	`longitude` text,
	`latitude` text,
	`year_of_birth` integer,
	`sex` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `inventory_groups` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`max_capacity` integer NOT NULL,
	`needs_ticket` integer DEFAULT true NOT NULL,
	`sales_start_date` text,
	`sales_end_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `inventory_groups_sales_start_idx` ON `inventory_groups` (`sales_start_date`);--> statement-breakpoint
CREATE INDEX `inventory_groups_sales_end_idx` ON `inventory_groups` (`sales_end_date`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`inventory_group_id` text NOT NULL,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`max_quantity` integer DEFAULT 0 NOT NULL,
	`participant_capacity` integer DEFAULT 1 NOT NULL,
	`features` text NOT NULL,
	`image_url` text,
	`stripe_product_id` text,
	`sold_quantity` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inventory_group_id`) REFERENCES `inventory_groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`total_amount` real NOT NULL,
	`transaction_fee` real DEFAULT 0 NOT NULL,
	`stripe_session_id` text NOT NULL,
	`stripe_payment_id` text,
	`payment_date` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_stripe_session_id_unique` ON `transactions` (`stripe_session_id`);--> statement-breakpoint
CREATE TABLE `transaction_items` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`qr_code_uuid` text NOT NULL,
	`transaction_id` text NOT NULL,
	`product_id` text NOT NULL,
	`event_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`is_free` integer DEFAULT false NOT NULL,
	`scanned_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tickets_qr_code_uuid_unique` ON `tickets` (`qr_code_uuid`);--> statement-breakpoint
CREATE INDEX `tickets_scanned_at_idx` ON `tickets` (`scanned_at`);--> statement-breakpoint
CREATE INDEX `tickets_event_scanned_idx` ON `tickets` (`event_id`,`scanned_at`);--> statement-breakpoint
CREATE TABLE `ticket_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_id` text NOT NULL,
	`participant_order` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`additional_data` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ticket_participants_ticket_id_participant_order_unique` ON `ticket_participants` (`ticket_id`,`participant_order`);--> statement-breakpoint
CREATE TABLE `participation_status` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `participation_status_event_id_idx` ON `participation_status` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `participation_status_user_id_event_id_unique` ON `participation_status` (`user_id`,`event_id`);--> statement-breakpoint
CREATE TABLE `event_photos` (
	`id` text PRIMARY KEY NOT NULL,
	`event_id` text NOT NULL,
	`file_path` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`thumbnail_path` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `event_photos_event_id_idx` ON `event_photos` (`event_id`);
