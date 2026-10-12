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
-- Data migration (spec 4.6): what users completed under the old model (users.consent JSON,
-- users.food_preference, users.photo_consent_given) becomes user_requirements rows at version 1.
-- A consent timestamp becomes completed_at; anything else (old seeds stored "yes") falls back to
-- the user's updated_at.
INSERT OR IGNORE INTO `user_requirements` (`user_id`, `requirement_id`, `version`, `completed_at`, `value`)
SELECT `id`, 'core.profile', 1,
	CASE WHEN json_extract(`consent`, '$.lastProfileUpdate') GLOB '[0-9][0-9][0-9][0-9]-*'
		THEN json_extract(`consent`, '$.lastProfileUpdate') ELSE `updated_at` END,
	NULL
FROM `users`
WHERE json_valid(`consent`) AND COALESCE(json_extract(`consent`, '$.lastProfileUpdate'), '') != '';
--> statement-breakpoint
INSERT OR IGNORE INTO `user_requirements` (`user_id`, `requirement_id`, `version`, `completed_at`, `value`)
SELECT `id`, 'core.location', 1,
	CASE WHEN json_extract(`consent`, '$.locationVerification') GLOB '[0-9][0-9][0-9][0-9]-*'
		THEN json_extract(`consent`, '$.locationVerification') ELSE `updated_at` END,
	NULL
FROM `users`
WHERE json_valid(`consent`) AND COALESCE(json_extract(`consent`, '$.locationVerification'), '') != '';
--> statement-breakpoint
INSERT OR IGNORE INTO `user_requirements` (`user_id`, `requirement_id`, `version`, `completed_at`, `value`)
SELECT `id`, 'core.onboarding', 1,
	CASE WHEN json_extract(`consent`, '$.survey') GLOB '[0-9][0-9][0-9][0-9]-*'
		THEN json_extract(`consent`, '$.survey') ELSE `updated_at` END,
	NULL
FROM `users`
WHERE json_valid(`consent`) AND COALESCE(json_extract(`consent`, '$.survey'), '') != '';
--> statement-breakpoint
-- Food preference: the old "No preference" option stored NULL with a consent timestamp; it becomes "none".
INSERT OR IGNORE INTO `user_requirements` (`user_id`, `requirement_id`, `version`, `completed_at`, `value`)
SELECT `id`, 'events.foodPreference', 1,
	CASE WHEN json_valid(`consent`) AND json_extract(`consent`, '$.foodPreference') GLOB '[0-9][0-9][0-9][0-9]-*'
		THEN json_extract(`consent`, '$.foodPreference') ELSE `updated_at` END,
	json_object('foodPreference', COALESCE(NULLIF(`food_preference`, ''), 'none'))
FROM `users`
WHERE `food_preference` IS NOT NULL
	OR (json_valid(`consent`) AND COALESCE(json_extract(`consent`, '$.foodPreference'), '') != '');
--> statement-breakpoint
INSERT OR IGNORE INTO `user_requirements` (`user_id`, `requirement_id`, `version`, `completed_at`, `value`)
SELECT `id`, 'events.photoConsent', 1,
	CASE WHEN json_valid(`consent`) AND json_extract(`consent`, '$.photoConsent') GLOB '[0-9][0-9][0-9][0-9]-*'
		THEN json_extract(`consent`, '$.photoConsent') ELSE `updated_at` END,
	json_object('photoConsentGiven', json(CASE WHEN `photo_consent_given` THEN 'true' ELSE 'false' END))
FROM `users`
WHERE `photo_consent_given` IS NOT NULL;
