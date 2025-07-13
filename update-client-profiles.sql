-- Update user profiles for Tony Lee and Curtis Yu
-- This assumes the user_profile table exists with the schema from packages/db/src/schema.ts

-- First, let's check if profiles already exist for these users
-- If they don't exist, we'll need to create them

-- For Tony Lee (moderate strength and skill)
INSERT INTO user_profile (user_id, business_id, strength_level, skill_level, notes)
SELECT 
    'pcjdhiuxhbgmd0pfa9i' as user_id,
    u.business_id,
    'moderate' as strength_level,
    'moderate' as skill_level,
    'Initial profile setup' as notes
FROM "user" u
WHERE u.id = 'pcjdhiuxhbgmd0pfa9i'
ON CONFLICT (user_id) 
DO UPDATE SET 
    strength_level = 'moderate',
    skill_level = 'moderate',
    updated_at = NOW();

-- For Curtis Yu (low strength and skill)
INSERT INTO user_profile (user_id, business_id, strength_level, skill_level, notes)
SELECT 
    'JJKbFFANwTCRRUt0ZK3mtDyfHk4XmZmU' as user_id,
    u.business_id,
    'low' as strength_level,
    'low' as skill_level,
    'Initial profile setup' as notes
FROM "user" u
WHERE u.id = 'JJKbFFANwTCRRUt0ZK3mtDyfHk4XmZmU'
ON CONFLICT (user_id) 
DO UPDATE SET 
    strength_level = 'low',
    skill_level = 'low',
    updated_at = NOW();

-- Verify the updates
SELECT 
    u.id,
    u.name,
    u.email,
    up.strength_level,
    up.skill_level,
    up.notes,
    up.updated_at
FROM "user" u
LEFT JOIN user_profile up ON u.id = up.user_id
WHERE u.id IN ('pcjdhiuxhbgmd0pfa9i', 'JJKbFFANwTCRRUt0ZK3mtDyfHk4XmZmU');