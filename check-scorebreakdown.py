#!/usr/bin/env python3
import json
import sys

def check_scorebreakdown(filepath):
    with open(filepath, 'r') as f:
        data = json.load(f)
    
    # Check if any individualCandidates have scoreBreakdown
    found = False
    for block in data.get('blueprint', {}).get('blocks', []):
        for client_id, candidate_data in block.get('individualCandidates', {}).items():
            for exercise in candidate_data.get('exercises', []):
                if 'scoreBreakdown' in exercise:
                    found = True
                    print(f"✅ Found scoreBreakdown in block {block['blockId']} for client {client_id}")
                    print(f"   Exercise: {exercise['name']}")
                    print(f"   Score breakdown: {json.dumps(exercise['scoreBreakdown'], indent=2)}")
                    return True
    
    if not found:
        print("❌ No scoreBreakdown found in individualCandidates")
    
    return found

if __name__ == "__main__":
    filepath = sys.argv[1] if len(sys.argv) > 1 else "/Users/tonyli/Desktop/fitness_app/apps/nextjs/session-test-data/group-workouts/latest-group-workout.json"
    check_scorebreakdown(filepath)