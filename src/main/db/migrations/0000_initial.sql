CREATE TABLE `items` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `filePath` text NOT NULL,
  `fileName` text NOT NULL,
  `fileExtension` text NOT NULL,
  `title` text NOT NULL,
  `sourceUrl` text,
  `author` text,
  `memo` text,
  `contentType` text NOT NULL,
  `containerType` text NOT NULL,
  `language` text DEFAULT '' NOT NULL,
  `watched` integer DEFAULT 0 NOT NULL,
  `progress` real DEFAULT 0 NOT NULL,
  `lastPageIndex` integer,
  `lastPositionSeconds` real,
  `thumbnail` blob,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL,
  `fileModifiedAt` integer
);
--> statement-breakpoint

CREATE UNIQUE INDEX `unique_file` ON `items` (`filePath`, `fileName`, `fileExtension`);
--> statement-breakpoint
CREATE INDEX `idx_content_type` ON `items` (`contentType`);
--> statement-breakpoint
CREATE INDEX `idx_language` ON `items` (`language`);
--> statement-breakpoint
CREATE INDEX `idx_watched` ON `items` (`watched`);
--> statement-breakpoint
CREATE INDEX `idx_created_at` ON `items` (`createdAt`);
--> statement-breakpoint
CREATE INDEX `idx_updated_at` ON `items` (`updatedAt`);
--> statement-breakpoint
CREATE INDEX `idx_file_modified_at` ON `items` (`fileModifiedAt`);
--> statement-breakpoint
CREATE INDEX `idx_title` ON `items` (`title`);
--> statement-breakpoint

CREATE TABLE `tags` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_name_unique` ON `tags` (`name`);
--> statement-breakpoint

CREATE TABLE `itemTags` (
  `itemId` integer NOT NULL REFERENCES `items`(`id`) ON DELETE CASCADE,
  `tagId` integer NOT NULL REFERENCES `tags`(`id`) ON DELETE CASCADE,
  PRIMARY KEY(`itemId`, `tagId`)
);
--> statement-breakpoint

CREATE TABLE `reviews` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `itemId` integer NOT NULL REFERENCES `items`(`id`) ON DELETE CASCADE,
  `rating` integer NOT NULL,
  `comment` text,
  `createdAt` integer NOT NULL,
  `updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reviews_itemId_unique` ON `reviews` (`itemId`);
--> statement-breakpoint

CREATE TABLE `settings` (
  `key` text PRIMARY KEY NOT NULL,
  `value` text NOT NULL
);
