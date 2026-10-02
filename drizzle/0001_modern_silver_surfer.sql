CREATE TABLE `investigation_events` (
	`investigation_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`data` text NOT NULL,
	PRIMARY KEY(`investigation_id`, `sequence`),
	FOREIGN KEY (`investigation_id`) REFERENCES `investigations`(`id`) ON UPDATE no action ON DELETE no action
);
