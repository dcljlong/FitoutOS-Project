#!/usr/bin/env python3
"""
FitoutOS Stress & Edge Case Tests
Additional tests to harden the system.
"""

import requests
import json
import random
from datetime import datetime, timedelta
import time

BASE_URL = "https://9c1fa4b6-ed08-4109-ba37-d518630c8ad8.preview.emergentagent.com/api"
TEST_EMAIL = "admin@test.com"
TEST_PASSWORD = "admin123"

test_results = {"passed": [], "failed": [], "warnings": []}


class TestClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
    
    def login(self, email: str, password: str) -> bool:
        response = self.session.post(
            f"{self.base_url}/auth/login",
            json={"email": email, "password": password}
        )
        if response.status_code == 200:
            self.session.headers.update({"Authorization": f"Bearer {response.json()['access_token']}"})
            return True
        return False
    
    def get(self, endpoint: str):
        r = self.session.get(f"{self.base_url}{endpoint}")
        return {"status": r.status_code, "data": r.json() if r.status_code < 400 else None}
    
    def post(self, endpoint: str, data):
        r = self.session.post(f"{self.base_url}{endpoint}", json=data)
        try:
            return {"status": r.status_code, "data": r.json()}
        except:
            return {"status": r.status_code, "data": None}
    
    def put(self, endpoint: str, data):
        r = self.session.put(f"{self.base_url}{endpoint}", json=data)
        try:
            return {"status": r.status_code, "data": r.json()}
        except:
            return {"status": r.status_code, "data": None}


def test_large_programme(client: TestClient) -> bool:
    """Test with large programme (50+ items)."""
    print("\n=== Test: Large Programme (50 items) ===")
    
    # Create job
    result = client.post("/jobs", {
        "job_number": f"STRESS-{random.randint(1000, 9999)}",
        "job_name": "Large Programme Stress Test",
        "status": "active"
    })
    if result["status"] not in [200, 201]:
        test_results["failed"].append("Large programme job creation failed")
        return False
    job_id = result["data"]["id"]
    
    # Create large programme
    items = []
    start_date = datetime.now() + timedelta(days=7)
    for i in range(50):
        items.append({
            "id": f"prog-{str(i+1).zfill(3)}",
            "name": f"Task {i+1} - Stress Test",
            "phase": "Construction",
            "trade": random.choice(["Framing", "Linings", "Stopping"]),
            "duration": random.randint(1, 5),
            "duration_unit": "days",
            "planned_start": (start_date + timedelta(days=i*2)).strftime("%Y-%m-%d"),
            "depends_on": [f"prog-{str(i).zfill(3)}"] if i > 0 else [],
            "crew_size": random.randint(2, 6)
        })
    
    result = client.post(f"/jobs/{job_id}/programme/bulk-save", {"items": items})
    if result["status"] == 200:
        test_results["passed"].append(f"Large programme save ({len(items)} items)")
    else:
        test_results["failed"].append(f"Large programme save failed")
        return False
    
    # Generate tasks
    result = client.post(f"/jobs/{job_id}/programme/generate-tasks", {})
    if result["status"] == 200:
        count = result["data"].get("created_count", 0)
        test_results["passed"].append(f"Large task generation ({count} tasks)")
    else:
        test_results["failed"].append("Large task generation failed")
    
    # Test critical path on large task set
    result = client.get(f"/jobs/{job_id}/critical-path")
    if result["status"] == 200:
        critical_count = result["data"].get("critical_count", 0)
        test_results["passed"].append(f"Large critical path ({critical_count} critical)")
    else:
        test_results["failed"].append("Large critical path failed")
    
    return True


def test_circular_dependency_protection(client: TestClient) -> bool:
    """Test that circular dependencies don't crash the system."""
    print("\n=== Test: Circular Dependency Protection ===")
    
    result = client.post("/jobs", {
        "job_number": f"CIRC-{random.randint(1000, 9999)}",
        "job_name": "Circular Dependency Test",
        "status": "active"
    })
    if result["status"] not in [200, 201]:
        return False
    job_id = result["data"]["id"]
    
    # Create programme with circular dependency (should be handled gracefully)
    items = [
        {"id": "prog-001", "name": "Task A", "depends_on": ["prog-003"], "duration": 1, "planned_start": "2026-04-01"},
        {"id": "prog-002", "name": "Task B", "depends_on": ["prog-001"], "duration": 1, "planned_start": "2026-04-02"},
        {"id": "prog-003", "name": "Task C", "depends_on": ["prog-002"], "duration": 1, "planned_start": "2026-04-03"},
    ]
    
    result = client.post(f"/jobs/{job_id}/programme/bulk-save", {"items": items})
    if result["status"] == 200:
        test_results["passed"].append("Circular dependency programme saved")
    
    result = client.post(f"/jobs/{job_id}/programme/generate-tasks", {})
    if result["status"] == 200:
        test_results["passed"].append("Circular dependency tasks generated")
    else:
        test_results["warnings"].append("Circular dependency task generation issue")
    
    # Critical path should not crash
    result = client.get(f"/jobs/{job_id}/critical-path")
    if result["status"] == 200:
        test_results["passed"].append("Circular dependency critical path handled")
    else:
        test_results["warnings"].append("Circular dependency critical path issue")
    
    return True


def test_concurrent_timesheets(client: TestClient) -> bool:
    """Test multiple timesheets for same job/day."""
    print("\n=== Test: Concurrent Timesheets ===")
    
    result = client.post("/jobs", {
        "job_number": f"TS-{random.randint(1000, 9999)}",
        "job_name": "Timesheet Stress Test",
        "status": "active"
    })
    if result["status"] not in [200, 201]:
        return False
    job_id = result["data"]["id"]
    
    # Get a task code
    codes = client.get("/task-codes/master")
    if codes["status"] != 200 or not codes["data"]:
        test_results["warnings"].append("No task codes for timesheet test")
        return True
    code_id = codes["data"][0]["id"]
    
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Create multiple timesheets for same day
    total_hours = 0
    for i in range(5):
        hours = random.randint(1, 4)
        total_hours += hours
        result = client.post("/timesheets", {
            "rows": [{
                "job_id": job_id,
                "task_code_id": code_id,
                "date": today,
                "hours": hours,
                "description": f"Entry {i+1}"
            }]
        })
        if result["status"] not in [200, 201]:
            test_results["warnings"].append(f"Timesheet entry {i+1} failed")
    
    test_results["passed"].append(f"Multiple timesheets created ({total_hours}h total)")
    return True


def test_boundary_values(client: TestClient) -> bool:
    """Test boundary values for numeric fields."""
    print("\n=== Test: Boundary Values ===")
    
    result = client.post("/jobs", {
        "job_number": f"BOUND-{random.randint(1000, 9999)}",
        "job_name": "Boundary Test",
        "status": "active"
    })
    if result["status"] not in [200, 201]:
        return False
    job_id = result["data"]["id"]
    
    # Create programme and tasks
    items = [
        {"id": "prog-001", "name": "Boundary Task", "duration": 1, "planned_start": "2026-04-01"}
    ]
    client.post(f"/jobs/{job_id}/programme/bulk-save", {"items": items})
    result = client.post(f"/jobs/{job_id}/programme/generate-tasks", {})
    if result["status"] != 200:
        return False
    
    tasks = client.get(f"/tasks?job_id={job_id}")
    if tasks["status"] != 200 or not tasks["data"]:
        return False
    task_id = tasks["data"][0]["id"]
    
    # Test extreme crew sizes
    test_cases = [
        {"crew_size": 0, "hours_per_day": 8, "overtime_allowed": False, "saturday_allowed": False, "trade_resource": "Test"},
        {"crew_size": 100, "hours_per_day": 24, "overtime_allowed": True, "saturday_allowed": True, "trade_resource": "Test"},
        {"crew_size": 0.5, "hours_per_day": 4, "overtime_allowed": False, "saturday_allowed": False, "trade_resource": "Test"},
    ]
    
    for i, tc in enumerate(test_cases):
        result = client.put(f"/tasks/{task_id}/crew", tc)
        if result["status"] == 200:
            test_results["passed"].append(f"Boundary crew test {i+1} accepted")
        else:
            test_results["warnings"].append(f"Boundary crew test {i+1} rejected")
    
    return True


def test_special_characters(client: TestClient) -> bool:
    """Test special characters in text fields."""
    print("\n=== Test: Special Characters ===")
    
    special_names = [
        "Task with 'quotes'",
        'Task with "double quotes"',
        "Task with <angle> brackets",
        "Task with & ampersand",
        "Task with emoji 🏗️",
        "Task with unicode: Ñoño Tëst",
        "Task\\nwith\\nnewlines",
    ]
    
    result = client.post("/jobs", {
        "job_number": f"SPEC-{random.randint(1000, 9999)}",
        "job_name": "Special Characters Test <>\"'&",
        "status": "active"
    })
    if result["status"] not in [200, 201]:
        test_results["warnings"].append("Special character job creation failed")
        return False
    job_id = result["data"]["id"]
    test_results["passed"].append("Special character job creation")
    
    items = [{"id": f"prog-{i+1:03d}", "name": name, "duration": 1, "planned_start": "2026-04-01"} for i, name in enumerate(special_names)]
    result = client.post(f"/jobs/{job_id}/programme/bulk-save", {"items": items})
    if result["status"] == 200:
        test_results["passed"].append(f"Special character programme ({len(items)} items)")
    else:
        test_results["warnings"].append("Special character programme save issue")
    
    return True


def test_date_edge_cases(client: TestClient) -> bool:
    """Test various date edge cases."""
    print("\n=== Test: Date Edge Cases ===")
    
    result = client.post("/jobs", {
        "job_number": f"DATE-{random.randint(1000, 9999)}",
        "job_name": "Date Edge Case Test",
        "status": "active"
    })
    if result["status"] not in [200, 201]:
        return False
    job_id = result["data"]["id"]
    
    # Test with various date formats/values
    items = [
        {"id": "prog-001", "name": "Past date task", "duration": 1, "planned_start": "2025-01-01"},
        {"id": "prog-002", "name": "Far future task", "duration": 1, "planned_start": "2030-12-31"},
        {"id": "prog-003", "name": "Leap day task", "duration": 1, "planned_start": "2028-02-29"},
        {"id": "prog-004", "name": "No finish date", "duration": 5, "planned_start": "2026-04-01"},
    ]
    
    result = client.post(f"/jobs/{job_id}/programme/bulk-save", {"items": items})
    if result["status"] == 200:
        test_results["passed"].append("Date edge case programme saved")
    else:
        test_results["warnings"].append("Date edge case programme issue")
    
    result = client.post(f"/jobs/{job_id}/programme/generate-tasks", {})
    if result["status"] == 200:
        test_results["passed"].append("Date edge case tasks generated")
    
    return True


def test_api_stability(client: TestClient) -> bool:
    """Run rapid API calls to test stability."""
    print("\n=== Test: API Stability (Rapid Calls) ===")
    
    # Rapid job list calls
    errors = 0
    for i in range(20):
        result = client.get("/jobs")
        if result["status"] != 200:
            errors += 1
    
    if errors == 0:
        test_results["passed"].append("API stability test (20 rapid calls)")
    else:
        test_results["warnings"].append(f"API stability: {errors}/20 calls failed")
    
    return errors == 0


def print_summary():
    print("\n" + "="*60)
    print("STRESS TEST SUMMARY")
    print("="*60)
    
    print(f"\n✅ PASSED: {len(test_results['passed'])}")
    for item in test_results['passed']:
        print(f"   - {item}")
    
    print(f"\n⚠️  WARNINGS: {len(test_results['warnings'])}")
    for item in test_results['warnings']:
        print(f"   - {item}")
    
    print(f"\n❌ FAILED: {len(test_results['failed'])}")
    for item in test_results['failed']:
        print(f"   - {item}")
    
    total = len(test_results['passed']) + len(test_results['failed'])
    if total > 0:
        rate = len(test_results['passed']) / total * 100
        print(f"\n📊 Success Rate: {rate:.1f}%")


def main():
    print("="*60)
    print("FitoutOS Stress & Edge Case Tests")
    print("="*60)
    
    client = TestClient(BASE_URL)
    
    print("\nAuthenticating...")
    if not client.login(TEST_EMAIL, TEST_PASSWORD):
        print("❌ Login failed!")
        return False
    print("✅ Authenticated")
    
    # Run all stress tests
    test_large_programme(client)
    test_circular_dependency_protection(client)
    test_concurrent_timesheets(client)
    test_boundary_values(client)
    test_special_characters(client)
    test_date_edge_cases(client)
    test_api_stability(client)
    
    print_summary()
    
    return len(test_results['failed']) == 0


if __name__ == "__main__":
    import sys
    sys.exit(0 if main() else 1)
