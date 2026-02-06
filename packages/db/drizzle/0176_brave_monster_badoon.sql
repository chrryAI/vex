ALTER TABLE "messages" ADD COLUMN "tribeId" uuid;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "tribeSlug" text;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "tribeId" uuid;--> statement-breakpoint
ALTER TABLE "threads" ADD COLUMN "tribeSlug" text;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tribeId_tribes_id_fk" FOREIGN KEY ("tribeId") REFERENCES "public"."tribes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "threads" ADD CONSTRAINT "threads_tribeId_tribes_id_fk" FOREIGN KEY ("tribeId") REFERENCES "public"."tribes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tribeMemberships" ADD CONSTRAINT "tribeMemberships_identity_xor" CHECK ((("userId" IS NULL)::int + ("guestId" IS NULL)::int) = 1);