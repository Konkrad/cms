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
