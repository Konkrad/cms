ALTER TABLE `events` ADD `status` text DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `announce_on_approval` integer DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `announcement_note_id` text;