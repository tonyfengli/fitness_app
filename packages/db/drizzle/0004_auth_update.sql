-- Add new columns first (with temporary defaults)
ALTER TABLE "user" 
  ADD COLUMN IF NOT EXISTS "username" text,
  ADD COLUMN IF NOT EXISTS "password" text,
  ADD COLUMN IF NOT EXISTS "phone" text,
  ADD COLUMN IF NOT EXISTS "role" text DEFAULT 'client';

-- For existing users, generate username from email
UPDATE "user" 
SET username = COALESCE(username, SPLIT_PART(email, '@', 1) || '_' || SUBSTRING(id, 1, 4))
WHERE username IS NULL;

-- Set a default business_id if any are NULL (use first business)
UPDATE "user" 
SET business_id = (SELECT id FROM business LIMIT 1)
WHERE business_id IS NULL;

-- Now make columns required and add constraints
ALTER TABLE "user"
  ALTER COLUMN "username" SET NOT NULL,
  ALTER COLUMN "role" SET NOT NULL,
  ALTER COLUMN "business_id" SET NOT NULL,
  ADD CONSTRAINT "user_username_unique" UNIQUE ("username");

-- Finally drop old columns
ALTER TABLE "user" 
  DROP COLUMN IF EXISTS "email",
  DROP COLUMN IF EXISTS "email_verified", 
  DROP COLUMN IF EXISTS "image";

-- Create client_profile table
CREATE TABLE IF NOT EXISTS "client_profile" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "business_id" uuid NOT NULL REFERENCES "business"("id") ON DELETE CASCADE,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone
);

-- Add unique constraint for user_id + business_id
ALTER TABLE "client_profile" ADD CONSTRAINT "client_profile_user_business_unique" UNIQUE("user_id", "business_id");

-- Add update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_client_profile_updated_at BEFORE UPDATE ON "client_profile"
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();