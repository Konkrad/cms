CREATE TABLE `notification_outbox` (
	`id` text PRIMARY KEY,
	`notification_id` text NOT NULL,
	`channel` text NOT NULL,
	`recipient_user_id` text,
	`recipient_address` text,
	`data` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_attempt_at` text NOT NULL,
	`created_at` text NOT NULL,
	`sent_at` text,
	CONSTRAINT `fk_notification_outbox_recipient_user_id_users_id_fk` FOREIGN KEY (`recipient_user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `notification_outbox_due_idx` ON `notification_outbox` (`status`,`next_attempt_at`);