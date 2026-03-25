"""
Test the programme parser against all generated test files.
"""
import os
import sys
import json

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from programme_parser import parse_programme_file, ParseResult

TEST_DIR = os.path.join(os.path.dirname(__file__), "test_programmes")


def run_tests():
    """Run parser tests against all test files."""
    results = {}
    
    test_files = sorted([
        f for f in os.listdir(TEST_DIR) 
        if f.endswith(('.xlsx', '.xls', '.csv'))
    ])
    
    print(f"\n{'='*60}")
    print(f"Testing Programme Parser with {len(test_files)} files")
    print(f"{'='*60}\n")
    
    for filename in test_files:
        filepath = os.path.join(TEST_DIR, filename)
        print(f"\n{'─'*60}")
        print(f"Testing: {filename}")
        print(f"{'─'*60}")
        
        try:
            result = parse_programme_file(filepath)
            
            print(f"  ✓ Items parsed: {len(result.items)}")
            print(f"  ⚠ Warnings: {len(result.warnings)}")
            print(f"  ✗ Errors: {len(result.errors)}")
            print(f"  📊 Metadata:")
            print(f"      - Total rows read: {result.metadata['total_rows_read']}")
            print(f"      - Blank rows skipped: {result.metadata['blank_rows_skipped']}")
            print(f"      - Duplicates found: {result.metadata['duplicate_rows_found']}")
            print(f"      - Header at row: {result.metadata['header_row_found']}")
            
            if result.warnings:
                print(f"  Warnings:")
                for w in result.warnings[:5]:  # Show first 5 warnings
                    print(f"      Row {w['row']}: {w['message']}")
                if len(result.warnings) > 5:
                    print(f"      ... and {len(result.warnings) - 5} more")
            
            if result.errors:
                print(f"  Errors:")
                for e in result.errors:
                    print(f"      Row {e['row']}: {e['message']}")
            
            # Show sample of parsed items
            if result.items:
                print(f"  Sample items:")
                for item in result.items[:3]:
                    print(f"      - [{item['id']}] {item['name'][:40]}... | Start: {item['planned_start']} | Dur: {item['duration']}d | Deps: {item['depends_on']}")
            
            results[filename] = {
                "success": len(result.items) > 0,
                "items": len(result.items),
                "warnings": len(result.warnings),
                "errors": len(result.errors)
            }
            
        except Exception as e:
            print(f"  ✗ FAILED: {str(e)}")
            results[filename] = {
                "success": False,
                "error": str(e)
            }
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    
    passed = sum(1 for r in results.values() if r.get("success"))
    total = len(results)
    
    print(f"\nPassed: {passed}/{total}")
    
    for filename, result in results.items():
        status = "✓ PASS" if result.get("success") else "✗ FAIL"
        items = result.get("items", 0)
        warnings = result.get("warnings", 0)
        print(f"  {status}: {filename} ({items} items, {warnings} warnings)")
    
    return results


if __name__ == "__main__":
    run_tests()
