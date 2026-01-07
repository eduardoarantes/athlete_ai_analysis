#!/usr/bin/env python3
"""
Test script for the Compliance Coach API.

Uses realistic compliance data based on the test fixtures to call
the coach endpoint and display the AI-generated feedback.
"""

import asyncio
import json
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from cycling_ai.api.models.coach import (
    ComplianceAnalysis,
    ComplianceCoachRequest,
    ComplianceMetadata,
    OverallCompliance,
    SegmentAnalysis,
    ZoneDistribution,
)
from cycling_ai.api.services.coach_service import ComplianceCoachService


def create_test_compliance_data() -> ComplianceCoachRequest:
    """Create realistic compliance data based on test fixtures."""

    # Example: Threshold Efforts workout with mixed execution
    # Some segments done well, some with issues

    segments = [
        SegmentAnalysis(
            segment_index=0,
            segment_name="Warm up",
            segment_type="warmup",
            match_quality="good",
            planned_duration_sec=600,  # 10 min
            planned_power_low=140,     # 56% of 250 FTP
            planned_power_high=165,    # 66% of 250 FTP
            planned_zone=2,
            actual_start_sec=0,
            actual_end_sec=580,
            actual_duration_sec=580,
            actual_avg_power=155.0,
            actual_max_power=175.0,
            actual_min_power=120.0,
            actual_dominant_zone=2,
            time_in_zone=ZoneDistribution(z1=0.1, z2=0.75, z3=0.12, z4=0.03, z5=0.0),
            power_compliance=92.0,
            zone_compliance=88.0,
            duration_compliance=97.0,
            overall_segment_score=92.0,
            assessment="Good warmup execution, slightly short but power was well-controlled",
        ),
        SegmentAnalysis(
            segment_index=1,
            segment_name="Threshold Interval 1",
            segment_type="interval",
            match_quality="fair",
            planned_duration_sec=360,  # 6 min
            planned_power_low=238,     # 95% of 250 FTP
            planned_power_high=263,    # 105% of 250 FTP
            planned_zone=4,
            actual_start_sec=600,
            actual_end_sec=920,
            actual_duration_sec=320,
            actual_avg_power=235.0,
            actual_max_power=278.0,
            actual_min_power=198.0,
            actual_dominant_zone=4,
            time_in_zone=ZoneDistribution(z1=0.0, z2=0.05, z3=0.15, z4=0.65, z5=0.15),
            power_compliance=78.0,
            zone_compliance=72.0,
            duration_compliance=89.0,
            overall_segment_score=75.0,
            assessment="Interval cut short by 40 sec, average power 3W below target range",
        ),
        SegmentAnalysis(
            segment_index=2,
            segment_name="Recovery 1",
            segment_type="recovery",
            match_quality="poor",
            planned_duration_sec=240,  # 4 min
            planned_power_low=140,     # 56% of 250 FTP
            planned_power_high=165,    # 66% of 250 FTP
            planned_zone=2,
            actual_start_sec=920,
            actual_end_sec=1100,
            actual_duration_sec=180,
            actual_avg_power=185.0,
            actual_max_power=210.0,
            actual_min_power=155.0,
            actual_dominant_zone=3,
            time_in_zone=ZoneDistribution(z1=0.05, z2=0.25, z3=0.55, z4=0.15, z5=0.0),
            power_compliance=55.0,
            zone_compliance=45.0,
            duration_compliance=75.0,
            overall_segment_score=52.0,
            assessment="Recovery too intense at 185W avg (target 140-165W), limiting recovery",
        ),
        SegmentAnalysis(
            segment_index=3,
            segment_name="Threshold Interval 2",
            segment_type="interval",
            match_quality="excellent",
            planned_duration_sec=420,  # 7 min
            planned_power_low=238,     # 95% of 250 FTP
            planned_power_high=263,    # 105% of 250 FTP
            planned_zone=4,
            actual_start_sec=1100,
            actual_end_sec=1520,
            actual_duration_sec=420,
            actual_avg_power=252.0,
            actual_max_power=275.0,
            actual_min_power=235.0,
            actual_dominant_zone=4,
            time_in_zone=ZoneDistribution(z1=0.0, z2=0.0, z3=0.08, z4=0.82, z5=0.10),
            power_compliance=98.0,
            zone_compliance=95.0,
            duration_compliance=100.0,
            overall_segment_score=97.0,
            assessment="Excellent interval execution, power perfectly in target zone",
        ),
        SegmentAnalysis(
            segment_index=4,
            segment_name="Recovery 2",
            segment_type="recovery",
            match_quality="good",
            planned_duration_sec=240,  # 4 min
            planned_power_low=140,
            planned_power_high=165,
            planned_zone=2,
            actual_start_sec=1520,
            actual_end_sec=1760,
            actual_duration_sec=240,
            actual_avg_power=155.0,
            actual_max_power=175.0,
            actual_min_power=130.0,
            actual_dominant_zone=2,
            time_in_zone=ZoneDistribution(z1=0.15, z2=0.72, z3=0.13, z4=0.0, z5=0.0),
            power_compliance=90.0,
            zone_compliance=85.0,
            duration_compliance=100.0,
            overall_segment_score=88.0,
            assessment="Good recovery, power well controlled in Z2",
        ),
        SegmentAnalysis(
            segment_index=5,
            segment_name="Threshold Interval 3",
            segment_type="interval",
            match_quality="good",
            planned_duration_sec=480,  # 8 min
            planned_power_low=238,
            planned_power_high=263,
            planned_zone=4,
            actual_start_sec=1760,
            actual_end_sec=2220,
            actual_duration_sec=460,
            actual_avg_power=245.0,
            actual_max_power=268.0,
            actual_min_power=225.0,
            actual_dominant_zone=4,
            time_in_zone=ZoneDistribution(z1=0.0, z2=0.0, z3=0.12, z4=0.78, z5=0.10),
            power_compliance=88.0,
            zone_compliance=82.0,
            duration_compliance=96.0,
            overall_segment_score=85.0,
            assessment="Good interval, slightly below target but maintained effort",
        ),
        SegmentAnalysis(
            segment_index=6,
            segment_name="Cool Down",
            segment_type="cooldown",
            match_quality="good",
            planned_duration_sec=600,  # 10 min
            planned_power_low=140,
            planned_power_high=165,
            planned_zone=2,
            actual_start_sec=2220,
            actual_end_sec=2800,
            actual_duration_sec=580,
            actual_avg_power=148.0,
            actual_max_power=165.0,
            actual_min_power=110.0,
            actual_dominant_zone=2,
            time_in_zone=ZoneDistribution(z1=0.20, z2=0.70, z3=0.10, z4=0.0, z5=0.0),
            power_compliance=92.0,
            zone_compliance=88.0,
            duration_compliance=97.0,
            overall_segment_score=90.0,
            assessment="Good cooldown, proper power reduction",
        ),
    ]

    # Calculate overall stats
    total_score = sum(s.overall_segment_score for s in segments) / len(segments)
    completed = sum(1 for s in segments if s.match_quality != "skipped")
    skipped = len(segments) - completed

    # Determine grade
    if total_score >= 90:
        grade = "A"
    elif total_score >= 80:
        grade = "B"
    elif total_score >= 70:
        grade = "C"
    elif total_score >= 60:
        grade = "D"
    else:
        grade = "F"

    overall = OverallCompliance(
        score=round(total_score, 1),
        grade=grade,
        summary=f"Workout completed with {completed}/{len(segments)} segments. "
                f"Strong interval 2 execution, but recovery 1 was too intense.",
        segments_completed=completed,
        segments_skipped=skipped,
        segments_total=len(segments),
    )

    metadata = ComplianceMetadata(
        algorithm_version="1.0.0",
        power_data_quality="excellent",
        analysis_duration_ms=125,
    )

    compliance_analysis = ComplianceAnalysis(
        overall=overall,
        segments=segments,
        metadata=metadata,
    )

    return ComplianceCoachRequest(
        workout_name="Threshold Efforts",
        workout_type="threshold",
        workout_date="2025-01-06",
        workout_description="Progressive threshold intervals 6/7/8 min at 95-105% FTP with 4 min recoveries",
        athlete_ftp=250,
        athlete_lthr=170,
        compliance_analysis=compliance_analysis,
    )


async def main() -> None:
    """Run the coach API test."""
    print("=" * 70)
    print("Compliance Coach API Test")
    print("=" * 70)

    # Create test data
    request = create_test_compliance_data()

    print("\n📊 Input Data:")
    print(f"   Workout: {request.workout_name}")
    print(f"   Type: {request.workout_type}")
    print(f"   Date: {request.workout_date}")
    print(f"   Athlete FTP: {request.athlete_ftp}W")
    print(f"   Athlete LTHR: {request.athlete_lthr} bpm")
    print(f"\n   Overall Score: {request.compliance_analysis.overall.score}%")
    print(f"   Grade: {request.compliance_analysis.overall.grade}")
    print(f"   Segments: {request.compliance_analysis.overall.segments_completed}/{request.compliance_analysis.overall.segments_total} completed")

    print("\n   Segment Breakdown:")
    for seg in request.compliance_analysis.segments:
        emoji = {
            "excellent": "🌟",
            "good": "✅",
            "fair": "⚠️",
            "poor": "❌",
            "skipped": "⏭️",
        }.get(seg.match_quality, "❓")
        print(f"     {emoji} {seg.segment_name}: {seg.overall_segment_score:.0f}% ({seg.match_quality})")

    print("\n" + "=" * 70)
    print("🤖 Generating AI Coach Feedback...")
    print("=" * 70)

    # Call the coach service
    service = ComplianceCoachService()

    try:
        response = await service.generate_feedback(request)

        print(f"\n✅ Response received from model: {response.model}")
        print(f"   Generated at: {response.generated_at}")

        feedback = response.feedback

        print("\n" + "-" * 70)
        print("📝 SUMMARY")
        print("-" * 70)
        print(f"{feedback.summary}")

        print("\n" + "-" * 70)
        print("💪 STRENGTHS")
        print("-" * 70)
        for i, strength in enumerate(feedback.strengths, 1):
            print(f"  {i}. {strength}")

        print("\n" + "-" * 70)
        print("📈 IMPROVEMENTS")
        print("-" * 70)
        for i, improvement in enumerate(feedback.improvements, 1):
            print(f"  {i}. {improvement}")

        print("\n" + "-" * 70)
        print("🎯 ACTION ITEMS")
        print("-" * 70)
        for i, action in enumerate(feedback.action_items, 1):
            print(f"  {i}. {action}")

        if feedback.segment_notes:
            print("\n" + "-" * 70)
            print("📋 SEGMENT NOTES")
            print("-" * 70)
            for note in feedback.segment_notes:
                seg_name = request.compliance_analysis.segments[note.segment_index].segment_name
                print(f"  [{seg_name}] {note.note}")

        print("\n" + "=" * 70)
        print("✅ Test completed successfully!")
        print("=" * 70)

    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        return


if __name__ == "__main__":
    asyncio.run(main())
