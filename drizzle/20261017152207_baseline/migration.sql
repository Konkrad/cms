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
CREATE TABLE `articles` (
	`id` text PRIMARY KEY,
	`scope_id` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`title` text NOT NULL,
	`featured_image` text,
	`body` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`author_id` text NOT NULL,
	`published_at` text,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_articles_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`),
	CONSTRAINT `fk_articles_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`)
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
CREATE TABLE `notes` (
	`id` text PRIMARY KEY,
	`scope_id` text NOT NULL,
	`subject_type` text,
	`subject_id` text,
	`body` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`author_id` text NOT NULL,
	`published_at` text,
	`updated_at` text NOT NULL,
	CONSTRAINT `fk_notes_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`),
	CONSTRAINT `fk_notes_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`)
);
--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY,
	`scope_id` text NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`content` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_pages_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `form_results` (
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
CREATE TABLE `forms` (
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
CREATE TABLE `notification_preferences` (
	`user_id` text NOT NULL,
	`notification_id` text NOT NULL,
	`channel` text NOT NULL,
	`enabled` integer NOT NULL,
	`updated_at` text NOT NULL,
	CONSTRAINT `notification_preferences_pk` PRIMARY KEY(`user_id`, `notification_id`, `channel`),
	CONSTRAINT `fk_notification_preferences_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
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
CREATE TABLE `deals` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`logo` text,
	`valid_until` text,
	`steps` text DEFAULT '[]' NOT NULL,
	`scope_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_deals_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`) ON DELETE CASCADE
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
CREATE TABLE `election_cycles` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`year` integer NOT NULL,
	`description` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`required_membership_tier` text,
	`voting_url` text,
	`scope_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_election_cycles_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`) ON DELETE CASCADE
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
CREATE TABLE `events` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`slug` text NOT NULL,
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
	`scope_id` text NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`status` text DEFAULT 'published' NOT NULL,
	`announce_on_approval` integer DEFAULT true NOT NULL,
	`announcement_note_id` text,
	`debrief_requested_at` text,
	`debrief_reminded_at` text,
	`image1` text,
	`image2` text,
	`deleted_at` text,
	`deleted_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_events_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_events_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`),
	CONSTRAINT `fk_events_deleted_by_users_id_fk` FOREIGN KEY (`deleted_by`) REFERENCES `users`(`id`)
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
	`sold_quantity` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_products_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_products_inventory_group_id_inventory_groups_id_fk` FOREIGN KEY (`inventory_group_id`) REFERENCES `inventory_groups`(`id`) ON DELETE CASCADE
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
CREATE TABLE `transactions` (
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
	`scope_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_jobs_suggested_by_users_id_fk` FOREIGN KEY (`suggested_by`) REFERENCES `users`(`id`),
	CONSTRAINT `fk_jobs_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`) ON DELETE CASCADE
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
CREATE TABLE `qualification_types` (
	`id` text PRIMARY KEY,
	`slug` text NOT NULL UNIQUE,
	`label` text NOT NULL,
	`description` text,
	`grants_membership_tier` text NOT NULL,
	`scope_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_qualification_types_scope_id_scopes_id_fk` FOREIGN KEY (`scope_id`) REFERENCES `scopes`(`id`) ON DELETE CASCADE
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
CREATE TABLE `user_requirements` (
	`user_id` text NOT NULL,
	`requirement_id` text NOT NULL,
	`version` integer NOT NULL,
	`completed_at` text NOT NULL,
	`value` text,
	CONSTRAINT `user_requirements_pk` PRIMARY KEY(`user_id`, `requirement_id`),
	CONSTRAINT `fk_user_requirements_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
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
CREATE TABLE `redirects` (
	`from_path` text PRIMARY KEY,
	`to_path` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
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
CREATE TABLE `schedule_runs` (
	`key` text PRIMARY KEY,
	`next_run_at` text NOT NULL,
	`locked_until` text,
	`last_run_at` text,
	`last_status` text,
	`last_error` text,
	`failures` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
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
	`description` text,
	`image1` text,
	`image2` text,
	`image3` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_scopes_parent_id_scopes_id_fk` FOREIGN KEY (`parent_id`) REFERENCES `scopes`(`id`),
	CONSTRAINT `scopes_parent_slug_unique` UNIQUE(`parent_id`,`slug`)
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
	`profile_picture` text,
	`profile_picture_small` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `articles_subject_idx` ON `articles` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `articles_published_at_idx` ON `articles` (`published_at`);--> statement-breakpoint
CREATE INDEX `notes_subject_idx` ON `notes` (`subject_type`,`subject_id`);--> statement-breakpoint
CREATE INDEX `notes_published_at_idx` ON `notes` (`published_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `pages_scope_slug_unique` ON `pages` (`scope_id`,`slug`);--> statement-breakpoint
CREATE INDEX `content_tombstones_deleted_at_idx` ON `content_tombstones` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `form_results_form_idx` ON `form_results` (`form_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `form_results_user_idx` ON `form_results` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `form_results_subject_idx` ON `form_results` (`subject_ref`);--> statement-breakpoint
CREATE INDEX `forms_scope_idx` ON `forms` (`scope_id`);--> statement-breakpoint
CREATE INDEX `forms_purpose_idx` ON `forms` (`purpose`);--> statement-breakpoint
CREATE INDEX `notification_outbox_due_idx` ON `notification_outbox` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `payment_events_change_unique` ON `payment_events` (`payment_id`,`change`);--> statement-breakpoint
CREATE INDEX `payments_status_expires_idx` ON `payments` (`status`,`expires_at`);--> statement-breakpoint
CREATE INDEX `payments_module_idx` ON `payments` (`module_id`,`kind`,`ref_id`);--> statement-breakpoint
CREATE INDEX `payments_provider_ref_idx` ON `payments` (`provider_ref`);--> statement-breakpoint
CREATE INDEX `payments_provider_payment_ref_idx` ON `payments` (`provider_payment_ref`);--> statement-breakpoint
CREATE INDEX `election_applications_cycle_status_idx` ON `election_applications` (`cycle_id`,`status`);--> statement-breakpoint
CREATE INDEX `election_applications_user_id_idx` ON `election_applications` (`user_id`);--> statement-breakpoint
CREATE INDEX `election_positions_cycle_id_idx` ON `election_positions` (`cycle_id`);--> statement-breakpoint
CREATE INDEX `event_photos_event_id_idx` ON `event_photos` (`event_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `events_scope_slug_unique` ON `events` (`scope_id`,`slug`);--> statement-breakpoint
CREATE INDEX `inventory_groups_sales_start_idx` ON `inventory_groups` (`sales_start_date`);--> statement-breakpoint
CREATE INDEX `inventory_groups_sales_end_idx` ON `inventory_groups` (`sales_end_date`);--> statement-breakpoint
CREATE INDEX `participation_status_event_id_idx` ON `participation_status` (`event_id`);--> statement-breakpoint
CREATE INDEX `tickets_scanned_at_idx` ON `tickets` (`scanned_at`);--> statement-breakpoint
CREATE INDEX `tickets_event_scanned_idx` ON `tickets` (`event_id`,`scanned_at`);--> statement-breakpoint
CREATE INDEX `reviews_ref_idx` ON `reviews` (`ref`,`created_at`);--> statement-breakpoint
CREATE INDEX `reviews_status_scope_idx` ON `reviews` (`status`,`scope_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `handler_calls_dedupe_unique` ON `handler_calls` (`dedupe_key`);--> statement-breakpoint
CREATE INDEX `handler_calls_due_idx` ON `handler_calls` (`status`,`next_attempt_at`);--> statement-breakpoint
CREATE INDEX `scope_memberships_scope_idx` ON `scope_memberships` (`scope_id`);--> statement-breakpoint
CREATE INDEX `scope_roles_scope_idx` ON `scope_roles` (`scope_id`);--> statement-breakpoint
-- Hand-written: the scope tree's root (spec 4.2). Every content row has a NOT NULL scope_id and
-- site-wide content belongs to the root, so a fresh database starts with it; seeds reuse it.
INSERT INTO `scopes` (`id`, `parent_id`, `kind`, `slug`, `name`, `path`) VALUES (lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' || substr(hex(randomblob(2)), 2) || '-8' || substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6))), NULL, 'root', '', 'Community', '/');
