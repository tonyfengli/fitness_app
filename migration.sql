-- Migration: Switch from username to email and rename client_profile to user_profile

-- Step 1: Add email column if it doesn't exist
ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "email" text;

-- Step 2: Copy username to email if email is empty
UPDATE "user" SET email = username WHERE email IS NULL;

-- Step 3: Make email required and unique
ALTER TABLE "user" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_email_unique";
ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" UNIQUE ("email");

-- Step 4: Drop username column
ALTER TABLE "user" DROP CONSTRAINT IF EXISTS "user_username_unique";
ALTER TABLE "user" DROP COLUMN IF EXISTS "username";

-- Step 5: Rename client_profile to user_profile if it exists
ALTER TABLE IF EXISTS "client_profile" RENAME TO "user_profile";

-- Step 6: Update constraint names if table was renamed
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_profile_userId_user_id_fk') THEN
        ALTER TABLE "user_profile" RENAME CONSTRAINT "client_profile_userId_user_id_fk" TO "user_profile_userId_user_id_fk";
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'client_profile_businessId_Business_id_fk') THEN
        ALTER TABLE "user_profile" RENAME CONSTRAINT "client_profile_businessId_Business_id_fk" TO "user_profile_businessId_Business_id_fk";
    END IF;
END $$;