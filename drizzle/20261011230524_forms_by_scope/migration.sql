CREATE TABLE `form_assignments` (
	`purpose` text NOT NULL,
	`scope_id` text NOT NULL,
	`form_id` text NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `form_assignments_pk` PRIMARY KEY(`purpose`, `scope_id`),
	CONSTRAINT `fk_form_assignments_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_form_assignments_form_id_forms_id_fk` FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `form_results` RENAME COLUMN `result_json` TO `answers`;--> statement-breakpoint
ALTER TABLE `form_results` RENAME COLUMN `submitted_at` TO `created_at`;--> statement-breakpoint
ALTER TABLE `forms` RENAME COLUMN `schema_json` TO `schema`;--> statement-breakpoint
ALTER TABLE `form_results` ADD `subject_ref` text;--> statement-breakpoint
ALTER TABLE `forms` ADD `purpose` text;--> statement-breakpoint
UPDATE `forms` SET `purpose` = 'core.onboarding' WHERE `system_key` = 'affilation';--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_forms` (
	`id` text PRIMARY KEY,
	`scope_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`schema` text NOT NULL,
	`purpose` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`allow_resubmission` integer DEFAULT false NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_forms_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_forms_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_forms`(`id`, `title`, `slug`, `description`, `schema`, `visibility`, `scope_id`, `allow_resubmission`, `created_by`, `created_at`, `updated_at`) SELECT `id`, `title`, `slug`, `description`, `schema`, `visibility`, COALESCE(`scope_id`, (SELECT `id` FROM `scopes` WHERE `parent_id` IS NULL)), `allow_resubmission`, `created_by`, `created_at`, `updated_at` FROM `forms`;--> statement-breakpoint
DROP TABLE `forms`;--> statement-breakpoint
ALTER TABLE `__new_forms` RENAME TO `forms`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_form_results` (
	`id` text PRIMARY KEY,
	`form_id` text NOT NULL,
	`user_id` text,
	`subject_ref` text,
	`answers` text NOT NULL,
	`altcha_payload` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_form_results_form_id_forms_id_fk` FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_form_results_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_form_results`(`id`, `form_id`, `user_id`, `answers`, `altcha_payload`, `created_at`) SELECT `id`, `form_id`, `user_id`, `answers`, `altcha_payload`, `created_at` FROM `form_results`;--> statement-breakpoint
DROP TABLE `form_results`;--> statement-breakpoint
ALTER TABLE `__new_form_results` RENAME TO `form_results`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `form_results_form_user_unique`;--> statement-breakpoint
DROP INDEX IF EXISTS `forms_system_key_unique`;--> statement-breakpoint
CREATE INDEX `forms_scope_idx` ON `forms` (`scope_id`);--> statement-breakpoint
CREATE INDEX `forms_purpose_idx` ON `forms` (`purpose`);--> statement-breakpoint
CREATE INDEX `form_results_form_idx` ON `form_results` (`form_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `form_results_user_idx` ON `form_results` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `form_results_subject_idx` ON `form_results` (`subject_ref`);--> statement-breakpoint
INSERT INTO `form_assignments` (`purpose`, `scope_id`, `form_id`, `updated_at`) SELECT 'core.onboarding', `scope_id`, `id`, CURRENT_TIMESTAMP FROM `forms` WHERE `purpose` = 'core.onboarding' ORDER BY `created_at` LIMIT 1;