#!/usr/bin/env python3
"""
Test zone enrichment functionality with real data.

Tests the complete workflow:
1. Data validation
2. Cache creation with zone enrichment
3. Verification of enriched data
"""
from pathlib import Path

from cycling_ai.tools.wrappers.cache_preparation_tool import CachePreparationTool
from cycling_ai.tools.wrappers.data_validation_tool import DataValidationTool

# Test data paths
csv_path = "/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/activities.csv"
profile_path = "/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json"

# Use organized_activities for better FIT file matching
fit_dir = "/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/organized_activities"

print("=" * 80)
print("ZONE ENRICHMENT TEST")
print("=" * 80)

# Test 1: Validation
print("\n[TEST 1] Data Validation")
print("-" * 80)
validation_tool = DataValidationTool()
result = validation_tool.execute(
    csv_file_path=csv_path,
    athlete_profile_path=profile_path,
    fit_dir_path=fit_dir
)

print(f"Success: {result.success}")
if result.data:
    print(f"Activity Count: {result.data.get('activity_count')}")
    print(f"FIT Files: {result.data.get('fit_files_count')}")
    print(f"Message: {result.data.get('message')}")

if not result.success:
    print("❌ Validation failed!")
    exit(1)

# Test 2: Cache with Zone Enrichment
print("\n[TEST 2] Cache Preparation with Zone Enrichment")
print("-" * 80)
print("⏳ This may take a few minutes to process all FIT files...")

cache_tool = CachePreparationTool()
result = cache_tool.execute(
    csv_file_path=csv_path,
    athlete_profile_path=profile_path,
    fit_dir_path=fit_dir  # Enable zone enrichment
)

print(f"\nSuccess: {result.success}")
if result.data:
    print(f"\nCache Results:")
    print(f"  Cache Path: {result.data.get('cache_path')}")
    print(f"  Activity Count: {result.data.get('activity_count')}")
    print(f"  Date Range: {result.data.get('date_range')}")
    print(f"  Compression: {result.data.get('compression_percent')}%")
    print(f"  Zone Enriched: {result.data.get('zone_enriched')}")
    if result.data.get('enrichment_summary'):
        print(f"  Enrichment: {result.data.get('enrichment_summary')}")
    print(f"\n  {result.data.get('message')}")

if not result.success:
    print("❌ Cache creation failed!")
    if result.errors:
        print(f"Errors: {result.errors}")
    exit(1)

# Test 3: Verify enriched data
print("\n[TEST 3] Verify Zone Data in Cache")
print("-" * 80)

import pandas as pd

cache_path = result.data.get('cache_path')
df = pd.read_parquet(cache_path)

# Check for zone columns
zone_cols = [col for col in df.columns if col.startswith('z') and 'sec' in col]
print(f"Zone columns found: {zone_cols}")

# Find activities with power data
df_with_power = df[df['total_power_sec'].notna() & (df['total_power_sec'] > 0)]
print(f"\nActivities with power data: {len(df_with_power)}")

if len(df_with_power) > 0:
    # Show sample
    sample = df_with_power.head(3)
    print("\nSample enriched activities:")
    for idx, row in sample.iterrows():
        print(f"\n  Activity: {row.get('Activity Name', 'Unknown')}")
        print(f"    Date: {row.get('Activity Date')}")
        print(f"    Total Power Time: {row['total_power_sec']}s ({row['total_power_sec']/60:.1f}min)")
        print(f"    Z1 (Active Recovery): {row.get('z1_active_recovery_sec', 0)}s")
        print(f"    Z2 (Endurance): {row.get('z2_endurance_sec', 0)}s")
        print(f"    Z3 (Tempo): {row.get('z3_tempo_sec', 0)}s")
        print(f"    Z4 (Threshold): {row.get('z4_threshold_sec', 0)}s")
        print(f"    Z5 (VO2max): {row.get('z5_vo2max_sec', 0)}s")
        print(f"    Z6 (Anaerobic): {row.get('z6_anaerobic_sec', 0)}s")
        print(f"    Normalized Power: {row.get('normalized_power', 0):.0f}W")

print("\n" + "=" * 80)
print("✅ ALL TESTS PASSED!")
print("=" * 80)
