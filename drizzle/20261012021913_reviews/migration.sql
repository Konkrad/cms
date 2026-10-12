CREATE TABLE `reviews` (
	`id` text PRIMARY KEY,
	`ref` text NOT NULL,
	`scope_id` text NOT NULL,
	`status` text DEFAULT 'in_review' NOT NULL,
	`submitted_by` text NOT NULL,
	`reviewed_by` text,
	`comment` text,
	`data` text,
	`form_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`decided_at` text,
	CONSTRAINT `fk_reviews_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_reviews_submitted_by_users_id_fk` FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_reviews_reviewed_by_users_id_fk` FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `handler_calls` (
	`id` text PRIMARY KEY,
	`dedupe_key` text NOT NULL,
	`owner` text NOT NULL,
	`kind` text NOT NULL,
	`type` text NOT NULL,
	`hook` text NOT NULL,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text,
	`next_attempt_at` text NOT NULL,
	`created_at` text NOT NULL,
	`done_at` text
);
--> statement-breakpoint
CREATE INDEX `reviews_ref_idx` ON `reviews` (`ref`,`created_at`);--> statement-breakpoint
CREATE INDEX `reviews_status_scope_idx` ON `reviews` (`status`,`scope_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `handler_calls_dedupe_unique` ON `handler_calls` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `handler_calls_due_idx` ON `handler_calls` (`status`,`next_attempt_at`);