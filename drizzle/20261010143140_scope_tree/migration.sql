CREATE TABLE `scope_memberships` (
	`user_id` text NOT NULL,
	`scope_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `scope_memberships_pk` PRIMARY KEY(`user_id`, `scope_id`),
	CONSTRAINT `fk_scope_memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_scope_memberships_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `scope_roles` (
	`user_id` text NOT NULL,
	`scope_id` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `scope_roles_pk` PRIMARY KEY(`user_id`, `scope_id`, `role`),
	CONSTRAINT `fk_scope_roles_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_scope_roles_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `scopes` (
	`id` text PRIMARY KEY,
	`parent_id` text,
	`kind` text NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL UNIQUE,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_scopes_parent_id_scopes_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `scopes`(`id`),
	CONSTRAINT `scopes_parent_slug_unique` UNIQUE(`parent_id`,`slug`)
);
--> statement-breakpoint
CREATE INDEX `scope_memberships_scope_idx` ON `scope_memberships` (`scope_id`);--> statement-breakpoint
CREATE INDEX `scope_roles_scope_idx` ON `scope_roles` (`scope_id`);