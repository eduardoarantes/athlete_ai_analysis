#!/bin/bash

echo "🔍 Monitoring database for profile and plan creation..."
echo "================================================"
echo ""

# Monitor in a loop
while true; do
  clear
  echo "🔍 Live Database Monitor - $(date)"
  echo "================================================"
  echo ""

  echo "📋 Athlete Profiles:"
  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
    SELECT
      id,
      user_id,
      first_name,
      ftp,
      created_at
    FROM athlete_profiles
    ORDER BY created_at DESC
    LIMIT 3;
  " 2>/dev/null

  echo ""
  echo "📝 Training Plans:"
  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
    SELECT
      id,
      name,
      created_from,
      status,
      created_at
    FROM training_plans
    ORDER BY created_at DESC
    LIMIT 3;
  " 2>/dev/null

  echo ""
  echo "📅 Plan Instances:"
  psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "
    SELECT
      id,
      name,
      instance_type,
      status,
      created_at
    FROM plan_instances
    ORDER BY created_at DESC
    LIMIT 3;
  " 2>/dev/null

  echo ""
  echo "Press Ctrl+C to stop monitoring"
  sleep 2
done
