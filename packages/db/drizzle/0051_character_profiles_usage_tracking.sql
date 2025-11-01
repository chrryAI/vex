-- Migration: Add separate usage tracking for users and guests in characterProfiles
-- Created: 2025-09-14

-- Add new usage tracking columns
ALTER TABLE "characterProfiles" 
ADD COLUMN "userUsageCount" integer NOT NULL DEFAULT 0,
ADD COLUMN "guestUsageCount" integer NOT NULL DEFAULT 0,
ADD COLUMN "lastUsedByUser" timestamp with time zone,
ADD COLUMN "lastUsedByGuest" timestamp with time zone;

-- Migrate existing usageCount data to userUsageCount (assuming existing usage was primarily by users)
UPDATE "characterProfiles" 
SET "userUsageCount" = COALESCE("usageCount", 0);

-- Migrate existing lastUsedAt data to lastUsedByUser
UPDATE "characterProfiles" 
SET "lastUsedByUser" = "lastUsedAt"
WHERE "lastUsedAt" IS NOT NULL;

-- Drop old columns
ALTER TABLE "characterProfiles" 
DROP COLUMN "usageCount",
DROP COLUMN "lastUsedAt";
