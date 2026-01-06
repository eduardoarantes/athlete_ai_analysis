#!/usr/bin/env python3
"""
Migrate workout IDs from text-based to NanoID format.

This script:
1. Generates a NanoID for each workout in the library
2. Creates a mapping file (old_id -> new_id)
3. Updates the workout_library.json with new IDs
"""

import json
import secrets
import string
from pathlib import Path

# NanoID alphabet (URL-safe)
NANOID_ALPHABET = string.ascii_letters + string.digits + "_-"
NANOID_LENGTH = 10


def generate_nanoid(length: int = NANOID_LENGTH) -> str:
    """Generate a NanoID-style random string."""
    return "".join(secrets.choice(NANOID_ALPHABET) for _ in range(length))


def main() -> None:
    """Main migration function."""
    data_dir = Path(__file__).parent.parent / "data"
    library_path = data_dir / "workout_library.json"
    mapping_path = data_dir / "workout_id_mapping.json"
    backup_path = data_dir / "archive" / "workout_library_pre_nanoid.json"

    # Load current library
    print(f"Loading workout library from {library_path}")
    with open(library_path) as f:
        library = json.load(f)

    workouts = library["workouts"]
    print(f"Found {len(workouts)} workouts")

    # Generate mapping
    mapping: dict[str, str] = {}
    used_ids: set[str] = set()

    for workout in workouts:
        old_id = workout["id"]

        # Generate unique NanoID
        while True:
            new_id = generate_nanoid()
            if new_id not in used_ids:
                used_ids.add(new_id)
                break

        mapping[old_id] = new_id

    # Save mapping file
    print(f"Saving ID mapping to {mapping_path}")
    with open(mapping_path, "w") as f:
        json.dump(mapping, f, indent=2)

    # Create backup of original library
    print(f"Creating backup at {backup_path}")
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    with open(backup_path, "w") as f:
        json.dump(library, f, indent=2)

    # Update workout IDs
    for workout in workouts:
        old_id = workout["id"]
        workout["id"] = mapping[old_id]

    # Save updated library
    print(f"Saving updated library to {library_path}")
    with open(library_path, "w") as f:
        json.dump(library, f, indent=2)

    # Print summary
    print("\n=== Migration Summary ===")
    print(f"Total workouts migrated: {len(workouts)}")
    print(f"Mapping file: {mapping_path}")
    print(f"Backup file: {backup_path}")
    print("\nSample mappings:")
    for i, (old_id, new_id) in enumerate(list(mapping.items())[:5]):
        print(f"  {old_id} -> {new_id}")
    print("  ...")


if __name__ == "__main__":
    main()
