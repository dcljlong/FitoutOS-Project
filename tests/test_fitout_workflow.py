#!/usr/bin/env python3
"""
FitoutOS Automated Test Suite
Tests the full programme-driven workflow with simulated data.
"""

import requests
import json
import random
import string
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import time

# Configuration
BASE_URL = "https://9c1fa4b6-ed08-4109-ba37-d518630c8ad8.preview.emergentagent.com/api"
TEST_EMAIL = "admin@test.com"
TEST_PASSWORD = "admin123"

# Test results tracking
test_results = {
    "passed": [],
    "failed": [],
    "warnings": [],
    "errors_fixed": []
}


class FitoutOSTestClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.token = None
        self.session = requests.Session()
    
    def login(self, email: str, password: str) -> bool:
        """Authenticate and get token."""
        try:
            response = self.session.post(
                f"{self.base_url}/auth/login",
                json={"email": email, "password": password}
            )
            if response.status_code == 200:
                data = response.json()
                self.token = data.get("access_token")
                self.session.headers.update({"Authorization": f"Bearer {self.token}"})
                return True
            return False
        except Exception as e:
            print(f"Login failed: {e}")
            return False
    
    def get(self, endpoint: str) -> Dict:
        """GET request."""
        response = self.session.get(f"{self.base_url}{endpoint}")
        return {"status": response.status_code, "data": response.json() if response.status_code < 400 else None, "error": response.text if response.status_code >= 400 else None}
    
    def post(self, endpoint: str, data: Dict) -> Dict:
        """POST request."""
        response = self.session.post(f"{self.base_url}{endpoint}", json=data)
        try:
            json_data = response.json()
        except:
            json_data = None
        return {"status": response.status_code, "data": json_data, "error": response.text if response.status_code >= 400 else None}
    
    def put(self, endpoint: str, data: Dict) -> Dict:
        """PUT request."""
        response = self.session.put(f"{self.base_url}{endpoint}", json=data)
        try:
            json_data = response.json()
        except:
            json_data = None
        return {"status": response.status_code, "data": json_data, "error": response.text if response.status_code >= 400 else None}
    
    def delete(self, endpoint: str) -> Dict:
        """DELETE request."""
        response = self.session.delete(f"{self.base_url}{endpoint}")
        return {"status": response.status_code, "data": response.json() if response.status_code < 400 else None}


# ============== TEST DATA GENERATORS ==============

TRADES = ["Framing", "Linings", "Stopping", "Ceilings", "Insulation", "Aluminium", "General"]
PHASES = ["Preliminaries", "Construction", "Finishing", "Handover"]
PREREQUISITE_OWNERS = ["YOU", "Main contractor", "Painter", "Electrician", "Plumber", "HVAC", "Joiner"]

TASK_NAME_TEMPLATES = [
    "Steel stud framing - Level {level}",
    "Wall linings GIB - {area}",
    "Stopping and skim coat - {area}",
    "Ceiling install - {area}",
    "Insulation batts - {area}",
    "Aluminium partitions - {area}",
    "Site setup and logistics",
    "Material delivery",
    "Final inspection - {area}",
    "Touch up and defects - {area}",
    "Handover clean - {area}",
    "Flush ceiling grid - {area}",
    "Fire stopping - Level {level}",
    "Acoustic treatment - {area}",
]

AREAS = ["North Wing", "South Wing", "Reception", "Open Plan", "Meeting Rooms", "Toilets", "Kitchen", "Corridor"]
LEVELS = ["1", "2", "3", "Ground", "Mezzanine"]


def generate_task_name() -> str:
    """Generate realistic task name."""
    template = random.choice(TASK_NAME_TEMPLATES)
    return template.format(
        level=random.choice(LEVELS),
        area=random.choice(AREAS)
    )


def generate_date(start_date: datetime, offset_days: int) -> str:
    """Generate date string with various formats."""
    date = start_date + timedelta(days=offset_days)
    formats = [
        "%Y-%m-%d",           # 2026-04-01
        "%Y-%m-%d",           # Standard
        "%Y-%m-%d",           # Standard (most common)
    ]
    return date.strftime(random.choice(formats))


def generate_programme_items(count: int = 10, include_edge_cases: bool = True) -> List[Dict]:
    """Generate programme items with various scenarios."""
    items = []
    start_date = datetime.now() + timedelta(days=7)
    current_date = start_date
    
    for i in range(count):
        duration = random.randint(1, 10)
        
        item = {
            "id": f"prog-{str(i + 1).zfill(3)}",
            "name": generate_task_name(),
            "phase": random.choice(PHASES),
            "trade": random.choice(TRADES),
            "duration": duration,
            "duration_unit": "days",
            "planned_start": current_date.strftime("%Y-%m-%d"),
            "planned_finish": (current_date + timedelta(days=duration - 1)).strftime("%Y-%m-%d"),
            "depends_on": [f"prog-{str(i).zfill(3)}"] if i > 0 and random.random() > 0.3 else [],
            "task_code_id": None,
            "crew_size": random.choice([2, 3, 4, 5, 6]),
            "hours_per_day": 8,
            "confidence": "manual"
        }
        
        # Add edge cases
        if include_edge_cases:
            if i == 2:  # Missing duration
                item["duration"] = None
            if i == 4:  # Zero crew
                item["crew_size"] = 0
            if i == 6:  # Very long duration
                item["duration"] = 30
        
        items.append(item)
        current_date = current_date + timedelta(days=max(1, duration or 1))
    
    return items


def generate_job_data(prefix: str = "AUTO") -> Dict:
    """Generate job data."""
    job_num = f"{prefix}-{random.randint(1000, 9999)}"
    return {
        "job_number": job_num,
        "job_name": f"Automated Test Project {job_num}",
        "main_contractor": random.choice(["Test Contractor Ltd", "ABC Construction", "XYZ Builders"]),
        "site_address": f"{random.randint(1, 500)} Test Street, Auckland",
        "planned_start": (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d"),
        "planned_finish": (datetime.now() + timedelta(days=60)).strftime("%Y-%m-%d"),
        "max_crew": random.randint(6, 12),
        "standard_crew": random.randint(4, 6),
        "allow_saturday": random.choice([True, False]),
        "allow_overtime": random.choice([True, False]),
    }


# ============== TEST FUNCTIONS ==============

def test_programme_upload_and_save(client: FitoutOSTestClient, job_id: str) -> bool:
    """Test programme upload with various data formats."""
    print("\n=== Testing Programme Upload & Save ===")
    
    # Test 1: Normal programme
    print("  Testing normal programme save...")
    items = generate_programme_items(8, include_edge_cases=False)
    result = client.post(f"/jobs/{job_id}/programme/bulk-save", {"items": items})
    
    if result["status"] != 200:
        test_results["failed"].append(f"Normal programme save failed: {result['error']}")
        return False
    test_results["passed"].append("Normal programme save")
    
    # Test 2: Programme with edge cases
    print("  Testing programme with edge cases...")
    items_edge = generate_programme_items(10, include_edge_cases=True)
    result = client.post(f"/jobs/{job_id}/programme/bulk-save", {"items": items_edge})
    
    if result["status"] != 200:
        test_results["warnings"].append(f"Edge case programme save issue: {result['error']}")
    else:
        test_results["passed"].append("Edge case programme save")
    
    # Test 3: Empty programme
    print("  Testing empty programme...")
    result = client.post(f"/jobs/{job_id}/programme/bulk-save", {"items": []})
    if result["status"] != 200:
        test_results["warnings"].append(f"Empty programme save issue: {result['error']}")
    else:
        test_results["passed"].append("Empty programme save")
    
    # Test 4: Programme with duplicates
    print("  Testing programme with duplicate names...")
    items_dup = generate_programme_items(5, include_edge_cases=False)
    items_dup[2]["name"] = items_dup[1]["name"]  # Duplicate name
    result = client.post(f"/jobs/{job_id}/programme/bulk-save", {"items": items_dup})
    if result["status"] != 200:
        test_results["warnings"].append(f"Duplicate programme save issue: {result['error']}")
    else:
        test_results["passed"].append("Duplicate name programme save")
    
    # Verify programme was saved
    print("  Verifying saved programme...")
    result = client.get(f"/jobs/{job_id}/programme")
    if result["status"] == 200 and result["data"]:
        test_results["passed"].append(f"Programme retrieval ({len(result['data'])} items)")
        return True
    else:
        test_results["failed"].append("Programme retrieval failed")
        return False


def test_task_generation(client: FitoutOSTestClient, job_id: str) -> List[Dict]:
    """Test task generation from programme."""
    print("\n=== Testing Task Generation ===")
    
    # First save a clean programme
    items = generate_programme_items(6, include_edge_cases=False)
    client.post(f"/jobs/{job_id}/programme/bulk-save", {"items": items})
    
    # Generate tasks
    print("  Generating tasks from programme...")
    result = client.post(f"/jobs/{job_id}/programme/generate-tasks", {})
    
    if result["status"] != 200:
        test_results["failed"].append(f"Task generation failed: {result['error']}")
        return []
    
    created_count = result["data"].get("created_count", 0)
    print(f"  Created {created_count} tasks")
    test_results["passed"].append(f"Task generation ({created_count} tasks)")
    
    # Verify tasks
    result = client.get(f"/tasks?job_id={job_id}")
    if result["status"] == 200:
        tasks = result["data"]
        
        # Check for null values
        null_fields = []
        for task in tasks:
            if task.get("task_name") is None:
                null_fields.append("task_name")
            if task.get("job_id") is None:
                null_fields.append("job_id")
        
        if null_fields:
            test_results["warnings"].append(f"Tasks with null fields: {set(null_fields)}")
        else:
            test_results["passed"].append("Task fields validation")
        
        return tasks
    
    return []


def test_crew_resource_changes(client: FitoutOSTestClient, job_id: str, tasks: List[Dict]) -> bool:
    """Test crew and resource assignment changes."""
    print("\n=== Testing Crew/Resource Changes ===")
    
    if not tasks:
        test_results["warnings"].append("No tasks to test crew changes")
        return False
    
    test_task = tasks[0]
    task_id = test_task["id"]
    
    # Test 1: Update crew size
    print("  Testing crew size update...")
    result = client.put(f"/tasks/{task_id}/crew", {
        "crew_size": 5,
        "hours_per_day": 8,
        "overtime_allowed": True,
        "saturday_allowed": True,
        "trade_resource": "Framing"
    })
    
    if result["status"] != 200:
        test_results["failed"].append(f"Crew update failed: {result['error']}")
        return False
    test_results["passed"].append("Crew size update")
    
    # Test 2: Change to zero crew (edge case)
    print("  Testing zero crew size...")
    result = client.put(f"/tasks/{task_id}/crew", {
        "crew_size": 0,
        "hours_per_day": 8,
        "overtime_allowed": False,
        "saturday_allowed": False,
        "trade_resource": "General"
    })
    if result["status"] == 200:
        test_results["passed"].append("Zero crew size accepted")
    else:
        test_results["warnings"].append("Zero crew size rejected (may be intentional)")
    
    # Test 3: Check resource analysis updates
    print("  Checking resource analysis updates...")
    result = client.get(f"/jobs/{job_id}/resource-analysis")
    if result["status"] == 200:
        analysis = result["data"]
        # Resource analysis returns "tasks" not "analysis_rows"
        if "tasks" in analysis or "summary" in analysis:
            test_results["passed"].append("Resource analysis retrieval")
        else:
            test_results["warnings"].append("Resource analysis missing expected fields")
    else:
        test_results["failed"].append(f"Resource analysis failed: {result['error']}")
    
    return True


def test_prerequisite_checklist_risk(client: FitoutOSTestClient, job_id: str, tasks: List[Dict]) -> bool:
    """Test prerequisite tracking, checklist, and risk logic."""
    print("\n=== Testing Prerequisite/Checklist/Risk Logic ===")
    
    if len(tasks) < 2:
        test_results["warnings"].append("Need at least 2 tasks for dependency testing")
        return False
    
    task1 = tasks[0]
    task2 = tasks[1] if len(tasks) > 1 else tasks[0]
    
    # Test 1: Set prerequisite owner
    print("  Testing prerequisite owner assignment...")
    result = client.put(f"/tasks/{task1['id']}/prerequisite", {
        "prerequisite_owner": "Main contractor",
        "prerequisite_status": "waiting",
        "prerequisite_note": "Waiting for site access",
        "risk_flag": True
    })
    
    if result["status"] != 200:
        test_results["failed"].append(f"Prerequisite update failed: {result['error']}")
        return False
    test_results["passed"].append("Prerequisite owner assignment")
    
    # Test 2: Set blocked status
    print("  Testing blocked status...")
    result = client.put(f"/tasks/{task2['id']}/prerequisite", {
        "prerequisite_owner": "Electrician",
        "prerequisite_status": "blocked",
        "prerequisite_note": "Power not ready",
        "risk_flag": True
    })
    
    if result["status"] == 200:
        test_results["passed"].append("Blocked status set")
    
    # Test 3: Check checklist
    print("  Testing pre-start checklist...")
    result = client.get(f"/tasks/{task1['id']}/checklist")
    
    if result["status"] == 200:
        checklist = result["data"]
        if checklist.get("checklist") and len(checklist["checklist"]) > 0:
            test_results["passed"].append(f"Checklist retrieval ({len(checklist['checklist'])} items)")
        else:
            test_results["warnings"].append("Checklist empty or missing")
    else:
        test_results["failed"].append(f"Checklist retrieval failed: {result['error']}")
    
    # Test 4: Update checklist
    print("  Testing checklist update...")
    result = client.put(f"/tasks/{task1['id']}/checklist", {
        "checklist": [
            {"key": "area_handed_over", "label": "Area handed over", "checked": True},
            {"key": "previous_trade_complete", "label": "Previous trade complete", "checked": False},
            {"key": "services_complete", "label": "Services complete", "checked": True},
            {"key": "inspection_passed", "label": "Inspection passed", "checked": False},
        ]
    })
    
    if result["status"] == 200:
        test_results["passed"].append("Checklist update")
    else:
        test_results["failed"].append(f"Checklist update failed: {result['error']}")
    
    # Test 5: Risk analysis
    print("  Testing risk analysis...")
    result = client.get(f"/jobs/{job_id}/risk-analysis")
    
    if result["status"] == 200:
        risk = result["data"]
        summary = risk.get("summary", {})
        
        blocked = summary.get("blocked_count", 0)
        at_risk = summary.get("at_risk_count", 0)
        checklist_incomplete = summary.get("checklist_incomplete_count", 0)
        
        print(f"    Blocked: {blocked}, At-risk: {at_risk}, Checklist incomplete: {checklist_incomplete}")
        
        if blocked > 0 or at_risk > 0 or checklist_incomplete > 0:
            test_results["passed"].append(f"Risk analysis detecting issues (B:{blocked} R:{at_risk} C:{checklist_incomplete})")
        else:
            test_results["warnings"].append("Risk analysis not detecting expected issues")
    else:
        test_results["failed"].append(f"Risk analysis failed: {result['error']}")
    
    return True


def test_timesheet_workflow(client: FitoutOSTestClient, job_id: str, tasks: List[Dict]) -> bool:
    """Test timesheet entry and approval workflow."""
    print("\n=== Testing Timesheet Workflow ===")
    
    if not tasks:
        test_results["warnings"].append("No tasks for timesheet testing")
        return False
    
    task = tasks[0]
    today = datetime.now().strftime("%Y-%m-%d")
    
    # First get a task code to use
    task_codes_result = client.get(f"/jobs/{job_id}/task-codes")
    if task_codes_result["status"] != 200 or not task_codes_result["data"]:
        # Try master codes
        task_codes_result = client.get("/task-codes/master")
    
    task_code_id = None
    if task_codes_result["status"] == 200 and task_codes_result["data"]:
        task_code_id = task_codes_result["data"][0].get("id")
    
    if not task_code_id:
        test_results["warnings"].append("No task codes available for timesheet test")
        return False
    
    # Test 1: Create timesheet entry with correct format (rows array)
    print("  Creating timesheet entry...")
    result = client.post("/timesheets", {
        "rows": [{
            "job_id": job_id,
            "task_code_id": task_code_id,
            "date": today,
            "hours": 8.0,
            "description": "Automated test timesheet entry"
        }]
    })
    
    if result["status"] in [200, 201]:
        entries = result["data"].get("entries", [])
        if entries:
            timesheet_id = entries[0].get("id")
            test_results["passed"].append("Timesheet creation")
            
            # Test 2: Submit for approval
            print("  Submitting for approval...")
            result = client.post("/timesheets/submit", [timesheet_id])
            
            if result["status"] == 200:
                test_results["passed"].append("Timesheet submission")
            else:
                test_results["warnings"].append(f"Timesheet submission issue: {result['error']}")
            
            # Test 3: Approve timesheet
            print("  Approving timesheet...")
            result = client.post("/timesheets/approve", [timesheet_id])
            
            if result["status"] == 200:
                test_results["passed"].append("Timesheet approval")
            else:
                test_results["warnings"].append(f"Timesheet approval issue: {result['error']}")
            
            return True
        else:
            test_results["warnings"].append("Timesheet created but no entries returned")
            return True
    else:
        test_results["failed"].append(f"Timesheet creation failed: {result['error']}")
        return False


def test_gantt_operations(client: FitoutOSTestClient, job_id: str, tasks: List[Dict]) -> bool:
    """Test Gantt chart operations (move task, change duration)."""
    print("\n=== Testing Gantt Operations ===")
    
    if not tasks:
        test_results["warnings"].append("No tasks for Gantt testing")
        return False
    
    task = tasks[0]
    task_id = task["id"]
    
    # Test 1: Move task (change dates)
    print("  Testing task date change...")
    new_start = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
    new_finish = (datetime.now() + timedelta(days=18)).strftime("%Y-%m-%d")
    
    # Get full task data first
    result = client.get(f"/tasks/{task_id}")
    if result["status"] != 200:
        test_results["failed"].append("Failed to get task for update")
        return False
    
    task_data = result["data"]
    task_data["planned_start"] = new_start
    task_data["planned_finish"] = new_finish
    
    result = client.put(f"/tasks/{task_id}", task_data)
    
    if result["status"] == 200:
        test_results["passed"].append("Task date update (Gantt move)")
    else:
        test_results["failed"].append(f"Task date update failed: {result['error']}")
        return False
    
    # Test 2: Change duration
    print("  Testing duration change...")
    task_data["duration_days"] = 7
    result = client.put(f"/tasks/{task_id}", task_data)
    
    if result["status"] == 200:
        test_results["passed"].append("Task duration update")
    else:
        test_results["warnings"].append(f"Duration update issue: {result['error']}")
    
    # Test 3: Change predecessor
    if len(tasks) > 1:
        print("  Testing predecessor change...")
        task_data["predecessor_ids"] = [tasks[1]["id"]]
        result = client.put(f"/tasks/{task_id}", task_data)
        
        if result["status"] == 200:
            test_results["passed"].append("Predecessor update")
        else:
            test_results["warnings"].append(f"Predecessor update issue: {result['error']}")
    
    return True


def test_reports_validation(client: FitoutOSTestClient, job_id: str) -> bool:
    """Validate report endpoints and totals."""
    print("\n=== Testing Reports Validation ===")
    
    # Test 1: Resource analysis
    print("  Testing resource analysis report...")
    result = client.get(f"/jobs/{job_id}/resource-analysis")
    
    if result["status"] == 200:
        data = result["data"]
        
        # Validate totals
        total_quoted = data.get("total_quoted_hours", 0)
        total_actual = data.get("total_actual_hours", 0)
        
        print(f"    Quoted: {total_quoted}h, Actual: {total_actual}h")
        
        if total_quoted >= 0 and total_actual >= 0:
            test_results["passed"].append(f"Resource analysis totals valid (Q:{total_quoted} A:{total_actual})")
        else:
            test_results["warnings"].append("Negative hour values in resource analysis")
    else:
        test_results["failed"].append(f"Resource analysis report failed: {result['error']}")
    
    # Test 2: Risk analysis
    print("  Testing risk analysis report...")
    result = client.get(f"/jobs/{job_id}/risk-analysis")
    
    if result["status"] == 200:
        data = result["data"]
        summary = data.get("summary", {})
        
        total_tasks = summary.get("total_tasks", 0)
        blocked = summary.get("blocked_count", 0)
        at_risk = summary.get("at_risk_count", 0)
        
        # Validate blocked + at_risk <= total_tasks
        if blocked + at_risk <= total_tasks:
            test_results["passed"].append("Risk analysis counts valid")
        else:
            test_results["warnings"].append(f"Risk counts exceed total tasks: {blocked}+{at_risk} > {total_tasks}")
    else:
        test_results["failed"].append(f"Risk analysis report failed: {result['error']}")
    
    # Test 3: Critical path analysis
    print("  Testing critical path analysis...")
    result = client.get(f"/jobs/{job_id}/critical-path")
    
    if result["status"] == 200:
        data = result["data"]
        critical_count = data.get("critical_count", 0)
        total_tasks = data.get("total_tasks", 0)
        project_duration = data.get("project_duration", 0)
        
        print(f"    Critical tasks: {critical_count}/{total_tasks}, Project duration: {project_duration} days")
        test_results["passed"].append(f"Critical path analysis (critical: {critical_count})")
    else:
        test_results["warnings"].append(f"Critical path not available: {result.get('error', 'N/A')}")
    
    return True


def test_critical_path_calculation(client: FitoutOSTestClient, job_id: str, tasks: List[Dict]) -> bool:
    """Test critical path calculation with various dependency configurations."""
    print("\n=== Testing Critical Path Calculation ===")
    
    if len(tasks) < 2:
        test_results["warnings"].append("Need at least 2 tasks for critical path testing")
        return False
    
    # Test 1: Verify critical path endpoint
    result = client.get(f"/jobs/{job_id}/critical-path")
    
    if result["status"] != 200:
        test_results["failed"].append(f"Critical path endpoint failed: {result['error']}")
        return False
    
    data = result["data"]
    critical_tasks = data.get("critical_tasks", [])
    
    # Test 2: Verify critical tasks have zero float
    all_zero_float = all(t.get("total_float", 1) == 0 for t in critical_tasks)
    if all_zero_float or not critical_tasks:
        test_results["passed"].append("Critical tasks have zero float")
    else:
        test_results["warnings"].append("Some critical tasks have non-zero float")
    
    # Test 3: Verify task list includes is_critical flag
    result = client.get(f"/tasks?job_id={job_id}")
    if result["status"] == 200:
        tasks_with_critical = result["data"]
        has_critical_field = all("is_critical" in t for t in tasks_with_critical)
        if has_critical_field:
            test_results["passed"].append("Tasks include is_critical field")
        else:
            test_results["warnings"].append("Tasks missing is_critical field")
    
    return True


def run_full_job_workflow(client: FitoutOSTestClient, job_number: int) -> Dict:
    """Run complete workflow for a single job."""
    print(f"\n{'='*60}")
    print(f"JOB WORKFLOW TEST #{job_number}")
    print(f"{'='*60}")
    
    job_data = generate_job_data(f"AUTO{job_number:02d}")
    
    # Create job
    print(f"\nCreating job: {job_data['job_number']}")
    result = client.post("/jobs", job_data)
    
    if result["status"] not in [200, 201]:
        test_results["failed"].append(f"Job creation failed: {result['error']}")
        return {"success": False, "job_id": None}
    
    job = result["data"]
    job_id = job["id"]
    print(f"  Created job ID: {job_id}")
    test_results["passed"].append(f"Job creation ({job_data['job_number']})")
    
    # Run all tests for this job
    test_programme_upload_and_save(client, job_id)
    tasks = test_task_generation(client, job_id)
    test_crew_resource_changes(client, job_id, tasks)
    test_prerequisite_checklist_risk(client, job_id, tasks)
    test_timesheet_workflow(client, job_id, tasks)
    test_gantt_operations(client, job_id, tasks)
    test_reports_validation(client, job_id)
    test_critical_path_calculation(client, job_id, tasks)
    
    return {"success": True, "job_id": job_id, "tasks": tasks}


def print_test_summary():
    """Print final test summary."""
    print("\n" + "="*60)
    print("TEST SUMMARY")
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
    
    if test_results['errors_fixed']:
        print(f"\n🔧 ERRORS FIXED: {len(test_results['errors_fixed'])}")
        for item in test_results['errors_fixed']:
            print(f"   - {item}")
    
    total = len(test_results['passed']) + len(test_results['failed'])
    if total > 0:
        success_rate = len(test_results['passed']) / total * 100
        print(f"\n📊 Success Rate: {success_rate:.1f}%")
    
    return len(test_results['failed']) == 0


def main():
    """Main test runner."""
    print("="*60)
    print("FitoutOS Automated Test Suite")
    print("="*60)
    print(f"Base URL: {BASE_URL}")
    print(f"Test User: {TEST_EMAIL}")
    
    # Initialize client
    client = FitoutOSTestClient(BASE_URL)
    
    # Login
    print("\nAuthenticating...")
    if not client.login(TEST_EMAIL, TEST_PASSWORD):
        print("❌ Login failed! Aborting tests.")
        return False
    print("✅ Authenticated successfully")
    
    # Run workflow tests for multiple jobs
    num_jobs = 3
    print(f"\nRunning {num_jobs} full job workflow tests...")
    
    for i in range(1, num_jobs + 1):
        run_full_job_workflow(client, i)
    
    # Print summary
    success = print_test_summary()
    
    return success


if __name__ == "__main__":
    import sys
    success = main()
    sys.exit(0 if success else 1)
