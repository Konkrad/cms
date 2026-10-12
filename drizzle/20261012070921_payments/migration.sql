CREATE TABLE `payment_events` (
	`id` text PRIMARY KEY,
	`payment_id` text NOT NULL,
	`change` text NOT NULL,
	`provider_event_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_payment_events_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` text PRIMARY KEY,
	`module_id` text NOT NULL,
	`kind` text NOT NULL,
	`ref_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`mode` text DEFAULT 'payment' NOT NULL,
	`provider` text NOT NULL,
	`provider_ref` text,
	`provider_payment_ref` text,
	`amount` integer NOT NULL,
	`currency` text NOT NULL,
	`lines` text NOT NULL,
	`subject_ref` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text,
	`paid_at` text,
	CONSTRAINT `fk_payments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_events_change_unique` ON `payment_events` (`payment_id`,`change`);--> statement-breakpoint
CREATE INDEX `payments_status_expires_idx` ON `payments` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `payments_module_idx` ON `payments` (`module_id`,`kind`,`ref_id`);--> statement-breakpoint
CREATE INDEX `payments_provider_ref_idx` ON `payments` (`provider_ref`);--> statement-breakpoint
CREATE INDEX `payments_provider_payment_ref_idx` ON `payments` (`provider_payment_ref`);