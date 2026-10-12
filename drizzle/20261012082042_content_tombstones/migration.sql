CREATE TABLE `content_tombstones` (
	`ref` text PRIMARY KEY,
	`type` text NOT NULL,
	`item_id` text NOT NULL,
	`scope_id` text NOT NULL,
	`published_at` text NOT NULL,
	`deleted_at` text NOT NULL,
	CONSTRAINT `fk_content_tombstones_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `content_tombstones_deleted_at_idx` ON `content_tombstones` (`deleted_at`);