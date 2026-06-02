CREATE TABLE "feature_flags" (
	"key" varchar(80) PRIMARY KEY NOT NULL,
	"description" varchar(300) DEFAULT '' NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"rolloutPercentage" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"type" varchar(40) NOT NULL,
	"title" varchar(200) NOT NULL,
	"body" text NOT NULL,
	"link" varchar(300),
	"read" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_reports" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"score" integer NOT NULL,
	"findings" json NOT NULL,
	"filename" varchar(256),
	"endpoints" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX "notifications_userId_index" ON "notifications" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "notifications_createdAt_index" ON "notifications" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "scan_reports_created_at_index" ON "scan_reports" USING btree ("created_at");