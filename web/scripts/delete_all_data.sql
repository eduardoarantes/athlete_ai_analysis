-- MANUAL SCRIPT: Delete all user data from production database
--
-- WARNING: This is irreversible! All user data will be permanently deleted.
-- The database schema will be preserved.
--
-- To run this script manually:
-- 1. Backup your data if needed
-- 2. Connect to your database
-- 3. Execute this script
--
-- Or use Supabase CLI:
-- cat scripts/delete_all_data.sql | npx supabase db execute --stdin

-- Disable triggers temporarily to speed up deletion
SET session_replication_role = replica;

-- Delete all data from tables (in correct order to respect FK constraints)
-- Using DO block to check if tables exist before truncating

DO $$
DECLARE
    table_name text;
    tables_to_truncate text[] := ARRAY[
        -- Child tables first (tables with foreign keys)
        'workout_compliance_analyses',
        'workout_activity_matches',
        'plan_instance_notes',
        'strava_activities',
        'sync_jobs',
        'llm_interactions',
        -- Plan instances
        'plan_instances',
        -- Templates and library
        'plan_templates',
        'workout_library',
        -- Athlete data
        'athlete_profiles',
        -- Strava integration
        'strava_tokens',
        -- TrainingPeaks integration
        'trainingpeaks_tokens',
        'trainingpeaks_workouts',
        -- Subscription data
        'subscriptions',
        'subscription_plans',
        -- Auth-related
        'profiles'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_truncate
    LOOP
        IF EXISTS (
            SELECT FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename = table_name
        ) THEN
            EXECUTE format('TRUNCATE TABLE %I CASCADE', table_name);
            RAISE NOTICE 'Truncated table: %', table_name;
        ELSE
            RAISE NOTICE 'Skipped non-existent table: %', table_name;
        END IF;
    END LOOP;
END $$;

-- Re-enable triggers
SET session_replication_role = DEFAULT;

-- Reset sequences (ensures IDs start from 1 again)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER SEQUENCE IF EXISTS %I.%I_id_seq RESTART WITH 1',
                      r.schemaname, r.tablename);
    END LOOP;
END $$;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE '✓ All user data has been deleted. Database schema preserved.';
    RAISE NOTICE '✓ Sequences have been reset.';
    RAISE NOTICE '✓ Database is ready for fresh start.';
END $$;
