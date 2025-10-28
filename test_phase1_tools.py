#!/usr/bin/env python3
"""
Quick test of Phase 1 data preparation tools.
"""
from pathlib import Path

# Import tools
from cycling_ai.tools.wrappers.data_validation_tool import DataValidationTool
from cycling_ai.tools.wrappers.cache_preparation_tool import CachePreparationTool

# Test data paths
csv_path = "/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/activities.csv"
profile_path = "/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/athlete_profile.json"
fit_dir = "/Users/eduardo/Documents/projects/athlete_performance_analysis/data/Athlete_Name/activities"

print("=" * 80)
print("PHASE 1 TOOLS TEST")
print("=" * 80)

# Test 1: Data Validation
print("\n[TEST 1] Data Validation Tool")
print("-" * 80)
validation_tool = DataValidationTool()
result = validation_tool.execute(
    csv_file_path=csv_path,
    athlete_profile_path=profile_path,
    fit_dir_path=fit_dir
)

print(f"Success: {result.success}")
print(f"Format: {result.format}")
if result.data:
    print(f"\nValidation Results:")
    print(f"  CSV Valid: {result.data.get('csv_valid')}")
    print(f"  Activity Count: {result.data.get('activity_count')}")
    print(f"  Profile Valid: {result.data.get('profile_valid')}")
    print(f"  FIT Files: {result.data.get('fit_files_count')}")
    print(f"  Message: {result.data.get('message')}")

    if result.data.get('issues'):
        print(f"\n  Issues: {result.data.get('issues')}")
    if result.data.get('warnings'):
        print(f"  Warnings: {result.data.get('warnings')}")

if not result.success:
    print("❌ Validation failed!")
    if result.errors:
        print(f"Errors: {result.errors}")
    exit(1)

# Test 2: Cache Preparation
print("\n[TEST 2] Cache Preparation Tool")
print("-" * 80)
cache_tool = CachePreparationTool()
result = cache_tool.execute(
    csv_file_path=csv_path,
    athlete_profile_path=profile_path
)

print(f"Success: {result.success}")
print(f"Format: {result.format}")
if result.data:
    print(f"\nCache Results:")
    print(f"  Cache Path: {result.data.get('cache_path')}")
    print(f"  Activity Count: {result.data.get('activity_count')}")
    print(f"  Date Range: {result.data.get('date_range')}")
    print(f"  Original Size: {result.data.get('original_size_kb')} KB")
    print(f"  Cache Size: {result.data.get('cache_size_kb')} KB")
    print(f"  Compression: {result.data.get('compression_percent')}%")
    print(f"  Zone Enriched: {result.data.get('zone_enriched')}")
    print(f"  Message: {result.data.get('message')}")

if not result.success:
    print("❌ Cache creation failed!")
    if result.errors:
        print(f"Errors: {result.errors}")
    exit(1)

print("\n" + "=" * 80)
print("✅ ALL TESTS PASSED!")
print("=" * 80)
