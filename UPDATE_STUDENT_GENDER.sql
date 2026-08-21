-- Update student gender data
-- Run this in your MySQL/database client or via Laravel tinker

-- Option 1: Set all students to male by default, then update specific ones
UPDATE students SET gender = 'male';

-- Option 2: Update specific students to female (replace IDs with actual female student IDs)
-- UPDATE students SET gender = 'female' WHERE id IN (2,4,6,8,10,12,14,16,18,20,22,24,26,28);

-- Option 3: Randomly assign gender for testing (50/50 split)
-- UPDATE students SET gender = CASE WHEN MOD(id, 2) = 0 THEN 'female' ELSE 'male' END;

-- Check the results
-- SELECT id, name, gender FROM students ORDER BY gender, name;
