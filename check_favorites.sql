-- Check if favorites exist in the database
SELECT 
    u.id as user_id,
    u.name as user_name,
    e.id as exercise_id,
    e.name as exercise_name,
    uer.rating_type,
    uer.business_id
FROM user_exercise_ratings uer
JOIN "user" u ON u.id = uer.user_id
JOIN exercises e ON e.id = uer.exercise_id
WHERE uer.business_id = 'd33b41e2-f700-4a08-9489-cb6e3daa7f20'
    AND u.id IN (
        '8ba13fc2-e653-49c2-94b7-0363478d8034', 
        'dbccdc5f-976c-45b3-a1d6-6a29c11b167a', 
        '437ad01a-9c91-4bf9-8f40-65d334472926'
    )
ORDER BY u.name, e.name;

-- Also check if the exercise IDs exist
SELECT id, name 
FROM exercises 
WHERE id IN (
    '6712600b-d4a2-4708-962e-fa6b1c3eb9cc',
    'e943357b-3ac8-4e43-948f-b4a15901561a',
    '68b71b3b-3b30-48f0-acd1-73441bff8bea',
    '0ed8d787-caff-4e43-b04b-45dc9b93117d',
    'ade4b3a1-169c-417d-b3bc-631f141d4526',
    'ac8126a5-92ea-42b5-9955-6d0ae38dd70a'
);