ALTER TABLE `transactions` ADD `status` text DEFAULT 'paid' NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `payment_id` text REFERENCES payments(id);--> statement-breakpoint
ALTER TABLE `transactions` ADD `participants` text;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_transactions` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`total_amount` real NOT NULL,
	`transaction_fee` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'paid' NOT NULL,
	`payment_id` text UNIQUE,
	`participants` text,
	`payment_date` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_transactions_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`),
	CONSTRAINT `fk_transactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_transactions_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`)
);
--> statement-breakpoint
INSERT INTO `__new_transactions`(`id`, `event_id`, `user_id`, `total_amount`, `transaction_fee`, `payment_date`, `created_at`) SELECT `id`, `event_id`, `user_id`, `total_amount`, `transaction_fee`, `payment_date`, `created_at` FROM `transactions`;--> statement-breakpoint
DROP TABLE `transactions`;--> statement-breakpoint
ALTER TABLE `__new_transactions` RENAME TO `transactions`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `products` DROP COLUMN `stripe_product_id`;