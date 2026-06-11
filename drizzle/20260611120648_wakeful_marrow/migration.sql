CREATE TABLE `events` (
	`id` text PRIMARY KEY,
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
	`group_id` text,
	`visibility` text DEFAULT 'global' NOT NULL,
	`image1` text,
	`image2` text,
	`deleted_at` text,
	`deleted_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_events_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_events_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`),
	CONSTRAINT `fk_events_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `logins` (
	`id` text PRIMARY KEY,
	`email` text NOT NULL UNIQUE,
	`magic_hash` text,
	`otp_hash` text,
	`expires_at` text NOT NULL,
	`otp_attempts` integer DEFAULT 0 NOT NULL,
	`magic_used` integer DEFAULT false NOT NULL,
	`otp_used` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `menu_items` (
	`id` text PRIMARY KEY,
	`menu_name` text NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`page_id` text,
	`parent_id` text,
	`position` integer DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'hidden' NOT NULL,
	`icon` text,
	`target` text DEFAULT '_self' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY,
	`content` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY,
	`user_id` text,
	`login_id` text,
	`token` text NOT NULL UNIQUE,
	`expires_at` text NOT NULL,
	`ip` text,
	`user_agent` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`family_name` text NOT NULL,
	`login_id` text,
	`city` text,
	`country` text,
	`longitude` text,
	`latitude` text,
	`year_of_birth` integer,
	`sex` text,
	`food_preference` text,
	`photo_consent_given` integer,
	`profile_picture` text,
	`profile_picture_small` text,
	`consent` text DEFAULT '{}' NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`slug` text NOT NULL UNIQUE,
	`latitude` text NOT NULL,
	`longitude` text NOT NULL,
	`image1` text,
	`image2` text,
	`image3` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `group_memberships` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	`joined_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_group_memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_group_memberships_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`),
	CONSTRAINT `group_memberships_user_id_group_id_unique` UNIQUE(`user_id`,`group_id`)
);
--> statement-breakpoint
CREATE TABLE `group_representatives` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`group_id` text NOT NULL,
	`promoted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`promoted_by` text NOT NULL,
	CONSTRAINT `fk_group_representatives_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_group_representatives_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`),
	CONSTRAINT `fk_group_representatives_promoted_by_users_id_fk` FOREIGN KEY (`promoted_by`) REFERENCES `users`(`id`),
	CONSTRAINT `group_representatives_user_id_group_id_unique` UNIQUE(`user_id`,`group_id`)
);
--> statement-breakpoint
CREATE TABLE `inventory_groups` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`name` text NOT NULL,
	`max_capacity` integer NOT NULL,
	`needs_ticket` integer DEFAULT true NOT NULL,
	`sales_start_date` text,
	`sales_end_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_inventory_groups_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`inventory_group_id` text NOT NULL,
	`name` text NOT NULL,
	`price` real NOT NULL,
	`max_quantity` integer DEFAULT 0 NOT NULL,
	`participant_capacity` integer DEFAULT 1 NOT NULL,
	`features` text NOT NULL,
	`image_key` text,
	`stripe_product_id` text,
	`sold_quantity` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_products_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_products_inventory_group_id_inventory_groups_id_fk` FOREIGN KEY (`inventory_group_id`) REFERENCES `inventory_groups`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `posts` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`editor_state` text,
	`user_id` text NOT NULL,
	`group_id` text,
	`visibility` text DEFAULT 'global' NOT NULL,
	`featured_image` text,
	`show_author` integer DEFAULT false NOT NULL,
	`deleted_at` text,
	`deleted_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_posts_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_posts_group_id_groups_id_fk` FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`),
	CONSTRAINT `fk_posts_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`total_amount` real NOT NULL,
	`transaction_fee` real DEFAULT 0 NOT NULL,
	`stripe_session_id` text NOT NULL UNIQUE,
	`stripe_payment_id` text,
	`payment_date` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_transactions_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`),
	CONSTRAINT `fk_transactions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `transaction_items` (
	`id` text PRIMARY KEY,
	`transaction_id` text NOT NULL,
	`product_id` text NOT NULL,
	`quantity` integer NOT NULL,
	`unit_price` real NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_transaction_items_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_transaction_items_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`)
);
--> statement-breakpoint
CREATE TABLE `tickets` (
	`id` text PRIMARY KEY,
	`qr_code_uuid` text NOT NULL UNIQUE,
	`transaction_id` text NOT NULL,
	`product_id` text NOT NULL,
	`event_id` text NOT NULL,
	`buyer_id` text NOT NULL,
	`scanned_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_tickets_transaction_id_transactions_id_fk` FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`),
	CONSTRAINT `fk_tickets_product_id_products_id_fk` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`),
	CONSTRAINT `fk_tickets_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`),
	CONSTRAINT `fk_tickets_buyer_id_users_id_fk` FOREIGN KEY (`buyer_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `ticket_participants` (
	`id` text PRIMARY KEY,
	`ticket_id` text NOT NULL,
	`participant_order` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`user_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_ticket_participants_ticket_id_tickets_id_fk` FOREIGN KEY (`ticket_id`) REFERENCES `tickets`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_ticket_participants_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `ticket_participants_ticket_id_participant_order_unique` UNIQUE(`ticket_id`,`participant_order`)
);
--> statement-breakpoint
CREATE TABLE `participation_status` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`event_id` text NOT NULL,
	`status` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_participation_status_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_participation_status_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `participation_status_user_id_event_id_unique` UNIQUE(`user_id`,`event_id`)
);
--> statement-breakpoint
CREATE TABLE `event_photos` (
	`id` text PRIMARY KEY,
	`event_id` text NOT NULL,
	`file_path` text NOT NULL,
	`uploaded_by` text NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_event_photos_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_event_photos_uploaded_by_users_id_fk` FOREIGN KEY (`uploaded_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `forms` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`schema_json` text NOT NULL,
	`visibility` text DEFAULT 'private' NOT NULL,
	`scope_type` text DEFAULT 'global' NOT NULL,
	`scope_id` text,
	`is_system_form` integer DEFAULT false NOT NULL,
	`allow_resubmission` integer DEFAULT false NOT NULL,
	`system_key` text,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_forms_scope_id_groups_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `groups`(`id`),
	CONSTRAINT `fk_forms_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_results` (
	`id` text PRIMARY KEY,
	`form_id` text NOT NULL,
	`user_id` text,
	`result_json` text NOT NULL,
	`altcha_payload` text,
	`submitted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_form_results_form_id_forms_id_fk` FOREIGN KEY (`form_id`) REFERENCES `forms`(`id`),
	CONSTRAINT `fk_form_results_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`editor_state` text,
	`location_type` text NOT NULL,
	`city` text,
	`country` text,
	`link` text,
	`poster_relation` text,
	`expires_at` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`suggested_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_jobs_suggested_by_users_id_fk` FOREIGN KEY (`suggested_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `qualification_types` (
	`id` text PRIMARY KEY,
	`slug` text NOT NULL UNIQUE,
	`label` text NOT NULL,
	`description` text,
	`grants_membership_tier` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `qualification_tokens` (
	`id` text PRIMARY KEY,
	`token` text NOT NULL UNIQUE,
	`type_id` text NOT NULL,
	`created_by` text NOT NULL,
	`expires_at` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_qualification_tokens_type_id_qualification_types_id_fk` FOREIGN KEY (`type_id`) REFERENCES `qualification_types`(`id`),
	CONSTRAINT `fk_qualification_tokens_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_qualifications` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`type_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`notes` text,
	`verified_by` text,
	`verified_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_user_qualifications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_user_qualifications_type_id_qualification_types_id_fk` FOREIGN KEY (`type_id`) REFERENCES `qualification_types`(`id`),
	CONSTRAINT `fk_user_qualifications_verified_by_users_id_fk` FOREIGN KEY (`verified_by`) REFERENCES `users`(`id`),
	CONSTRAINT `user_qualifications_user_id_type_id_unique` UNIQUE(`user_id`,`type_id`)
);
--> statement-breakpoint
CREATE TABLE `user_memberships` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL UNIQUE,
	`tier` text NOT NULL,
	`granted_by` text,
	`granted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`expires_at` text,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_user_memberships_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_user_memberships_granted_by_users_id_fk` FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `tag_definitions` (
	`id` text PRIMARY KEY,
	`slug` text NOT NULL UNIQUE,
	`label` text NOT NULL,
	`category` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_tags` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`slug` text NOT NULL,
	`label` text NOT NULL,
	`category` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text,
	`granted_by` text,
	`granted_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_user_tags_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_user_tags_granted_by_users_id_fk` FOREIGN KEY (`granted_by`) REFERENCES `users`(`id`),
	CONSTRAINT `user_tags_user_id_slug_unique` UNIQUE(`user_id`,`slug`)
);
--> statement-breakpoint
CREATE TABLE `election_cycles` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`year` integer NOT NULL,
	`description` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`required_membership_tier` text,
	`voting_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `election_positions` (
	`id` text PRIMARY KEY,
	`cycle_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`max_candidates` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_election_positions_cycle_id_election_cycles_id_fk` FOREIGN KEY (`cycle_id`) REFERENCES `election_cycles`(`id`)
);
--> statement-breakpoint
CREATE TABLE `election_applications` (
	`id` text PRIMARY KEY,
	`position_id` text NOT NULL,
	`cycle_id` text NOT NULL,
	`user_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`motivation_why` text NOT NULL,
	`motivation_experience` text NOT NULL,
	`motivation_goals` text NOT NULL,
	`admin_note` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_election_applications_position_id_election_positions_id_fk` FOREIGN KEY (`position_id`) REFERENCES `election_positions`(`id`),
	CONSTRAINT `fk_election_applications_cycle_id_election_cycles_id_fk` FOREIGN KEY (`cycle_id`) REFERENCES `election_cycles`(`id`),
	CONSTRAINT `fk_election_applications_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `election_applications_position_id_user_id_unique` UNIQUE(`position_id`,`user_id`)
);
--> statement-breakpoint
CREATE TABLE `deals` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`logo` text,
	`valid_until` text,
	`steps` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `inventory_groups_sales_start_idx` ON `inventory_groups` (`sales_start_date`);--> statement-breakpoint
CREATE INDEX `inventory_groups_sales_end_idx` ON `inventory_groups` (`sales_end_date`);--> statement-breakpoint
CREATE INDEX `tickets_scanned_at_idx` ON `tickets` (`scanned_at`);--> statement-breakpoint
CREATE INDEX `tickets_event_scanned_idx` ON `tickets` (`event_id`,`scanned_at`);--> statement-breakpoint
CREATE INDEX `participation_status_event_id_idx` ON `participation_status` (`event_id`);--> statement-breakpoint
CREATE INDEX `event_photos_event_id_idx` ON `event_photos` (`event_id`);--> statement-breakpoint
CREATE INDEX `forms_scope_idx` ON `forms` (`scope_type`,`scope_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `forms_system_key_unique` ON `forms` (`system_key`);--> statement-breakpoint
CREATE INDEX `form_results_form_idx` ON `form_results` (`form_id`,`submitted_at`);--> statement-breakpoint
CREATE INDEX `form_results_user_idx` ON `form_results` (`user_id`,`submitted_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `form_results_form_user_unique` ON `form_results` (`form_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `election_positions_cycle_id_idx` ON `election_positions` (`cycle_id`);--> statement-breakpoint
CREATE INDEX `election_applications_cycle_status_idx` ON `election_applications` (`cycle_id`,`status`);--> statement-breakpoint
CREATE INDEX `election_applications_user_id_idx` ON `election_applications` (`user_id`);