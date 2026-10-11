CREATE TABLE `notification_preferences` (
	`user_id` text NOT NULL,
	`notification_id` text NOT NULL,
	`channel` text NOT NULL,
	`enabled` integer NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `notification_preferences_pk` PRIMARY KEY(`user_id`, `notification_id`, `channel`),
	CONSTRAINT `fk_notification_preferences_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
