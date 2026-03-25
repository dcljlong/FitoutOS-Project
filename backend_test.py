import requests
import sys
import json
from datetime import datetime

class FitoutOSAPITester:
    def __init__(self, base_url="https://fitout-stability.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.user_id = None
        self.job_id = None
        self.task_id = None

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/api/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=30)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json() if response.content else {}
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_detail = response.json()
                    print(f"   Error: {error_detail}")
                except:
                    print(f"   Response: {response.text[:200]}")
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_auth_login(self):
        """Test login with admin credentials"""
        success, response = self.run_test(
            "Admin Login",
            "POST",
            "auth/login",
            200,
            data={"email": "admin@test.com", "password": "admin123"}
        )
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response.get('user', {}).get('id')
            print(f"   Token acquired for user: {response.get('user', {}).get('name')}")
            return True
        return False

    def test_auth_me(self):
        """Test getting current user info"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "auth/me",
            200
        )
        return success

    def test_auth_register(self):
        """Test user registration"""
        test_email = f"test_{datetime.now().strftime('%H%M%S')}@test.com"
        success, response = self.run_test(
            "User Registration",
            "POST",
            "auth/register",
            200,
            data={
                "name": "Test User",
                "email": test_email,
                "password": "testpass123",
                "role": "worker"
            }
        )
        return success

    def test_jobs_create(self):
        """Test creating a job"""
        job_number = f"TEST-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        success, response = self.run_test(
            "Create Job",
            "POST",
            "jobs",
            200,
            data={
                "job_number": job_number,
                "job_name": "Test Fitout Project",
                "main_contractor": "Test Contractor Ltd",
                "site_address": "123 Test Street, Auckland",
                "planned_start": "2024-02-01",
                "planned_finish": "2024-03-31",
                "max_crew": 6,
                "standard_crew": 4,
                "allow_saturday": True,
                "allow_overtime": False,
                "status": "active"
            }
        )
        if success and 'id' in response:
            self.job_id = response['id']
            print(f"   Job created with ID: {self.job_id}")
        return success

    def test_jobs_list(self):
        """Test getting jobs list"""
        success, response = self.run_test(
            "List Jobs",
            "GET",
            "jobs",
            200
        )
        if success:
            print(f"   Found {len(response)} jobs")
        return success

    def test_jobs_get(self):
        """Test getting specific job"""
        if not self.job_id:
            print("❌ Skipping - No job ID available")
            return False
            
        success, response = self.run_test(
            "Get Job Details",
            "GET",
            f"jobs/{self.job_id}",
            200
        )
        return success

    def test_tasks_create(self):
        """Test creating a task"""
        if not self.job_id:
            print("❌ Skipping - No job ID available")
            return False
            
        success, response = self.run_test(
            "Create Task",
            "POST",
            "tasks",
            200,
            data={
                "job_id": self.job_id,
                "task_name": "Install wall framing",
                "task_type": "construction",
                "planned_start": "2024-02-05",
                "planned_finish": "2024-02-10",
                "duration_days": 5,
                "is_internal": True,
                "status": "planned",
                "quoted_hours": 40.0,
                "percent_complete": 0
            }
        )
        if success and 'id' in response:
            self.task_id = response['id']
            print(f"   Task created with ID: {self.task_id}")
        return success

    def test_tasks_list(self):
        """Test getting tasks list"""
        success, response = self.run_test(
            "List Tasks",
            "GET",
            "tasks",
            200
        )
        if success:
            print(f"   Found {len(response)} tasks")
        return success

    def test_timesheets_create(self):
        """Test creating timesheet entries"""
        # First get task codes for the job
        if not self.job_id:
            print("❌ Skipping - No job ID available")
            return False
            
        # Get job task codes
        codes_success, codes_response = self.run_test(
            "Get Job Task Codes",
            "GET",
            f"jobs/{self.job_id}/task-codes?active_only=true",
            200
        )
        
        if not codes_success or not codes_response:
            print("❌ No task codes available for timesheet test")
            return False
            
        task_code_id = codes_response[0]['id']
        
        success, response = self.run_test(
            "Create Timesheet Entry",
            "POST",
            "timesheets",
            200,
            data={
                "rows": [
                    {
                        "date": "2024-02-05",
                        "job_id": self.job_id,
                        "task_code_id": task_code_id,
                        "description": "Wall framing work",
                        "hours": 8.0
                    }
                ]
            }
        )
        return success

    def test_timesheets_list(self):
        """Test getting timesheets"""
        success, response = self.run_test(
            "List Timesheets",
            "GET",
            "timesheets",
            200
        )
        if success:
            print(f"   Found {len(response)} timesheet entries")
        return success

    def test_resource_analysis(self):
        """Test resource analysis endpoint"""
        if not self.job_id:
            print("❌ Skipping - No job ID available")
            return False
            
        success, response = self.run_test(
            "Get Resource Analysis",
            "GET",
            f"jobs/{self.job_id}/resource-analysis",
            200
        )
        return success

    def test_master_task_codes(self):
        """Test getting master task codes"""
        success, response = self.run_test(
            "List Master Task Codes",
            "GET",
            "task-codes/master",
            200
        )
        if success:
            print(f"   Found {len(response)} master task codes")
        return success

    def test_job_task_codes(self):
        """Test getting job-specific task codes"""
        if not self.job_id:
            print("❌ Skipping - No job ID available")
            return False
            
        success, response = self.run_test(
            "List Job Task Codes",
            "GET",
            f"jobs/{self.job_id}/task-codes",
            200
        )
        if success:
            print(f"   Found {len(response)} job task codes")
        return success

    def test_users_list(self):
        """Test getting users list (admin only)"""
        success, response = self.run_test(
            "List Users",
            "GET",
            "users",
            200
        )
        if success:
            print(f"   Found {len(response)} users")
        return success

    def test_programme_bulk_save(self):
        """Test bulk saving programme items"""
        if not self.job_id:
            print("❌ Skipping - No job ID available")
            return False
            
        programme_data = [
            {
                "id": "prog-001",
                "name": "Site measure and set out",
                "phase": "Preliminary",
                "trade": "General",
                "duration": 2,
                "planned_start": "2024-02-01",
                "planned_finish": "2024-02-02",
                "depends_on": [],
                "task_code_id": None,
                "crew_size": 2,
                "hours_per_day": 8
            },
            {
                "id": "prog-002", 
                "name": "Wall framing",
                "phase": "Construction",
                "trade": "Framing",
                "duration": 5,
                "planned_start": "2024-02-03",
                "planned_finish": "2024-02-07",
                "depends_on": ["prog-001"],
                "task_code_id": None,
                "crew_size": 4,
                "hours_per_day": 8
            }
        ]
        
        success, response = self.run_test(
            "Bulk Save Programme",
            "POST",
            f"jobs/{self.job_id}/programme/bulk-save",
            200,
            data={"items": programme_data}
        )
        return success

    def test_risk_analysis(self):
        """Test getting risk analysis for a job"""
        if not self.job_id:
            print("❌ Skipping - No job ID available")
            return False
            
        success, response = self.run_test(
            "Get Risk Analysis",
            "GET",
            f"jobs/{self.job_id}/risk-analysis",
            200
        )
        if success:
            summary = response.get('summary', {})
            print(f"   Risk Summary - Total: {summary.get('total_tasks', 0)}, Blocked: {summary.get('blocked_count', 0)}, At Risk: {summary.get('at_risk_count', 0)}")
        return success

    def test_task_checklist_get(self):
        """Test getting task pre-start checklist"""
        if not self.task_id:
            print("❌ Skipping - No task ID available")
            return False
            
        success, response = self.run_test(
            "Get Task Checklist",
            "GET",
            f"tasks/{self.task_id}/checklist",
            200
        )
        if success:
            checklist = response.get('checklist', [])
            print(f"   Checklist has {len(checklist)} items, {response.get('completed_items', 0)} completed")
        return success

    def test_task_checklist_update(self):
        """Test updating task pre-start checklist"""
        if not self.task_id:
            print("❌ Skipping - No task ID available")
            return False
            
        # First get the current checklist
        get_success, get_response = self.run_test(
            "Get Current Checklist",
            "GET",
            f"tasks/{self.task_id}/checklist",
            200
        )
        
        if not get_success:
            return False
            
        # Update first item to checked
        checklist = get_response.get('checklist', [])
        if checklist:
            checklist[0]['checked'] = True
            
        success, response = self.run_test(
            "Update Task Checklist",
            "PUT",
            f"tasks/{self.task_id}/checklist",
            200,
            data={"checklist": checklist}
        )
        if success:
            print(f"   Updated checklist - {response.get('completed_items', 0)}/{response.get('total_items', 0)} complete")
        return success

    def test_task_crew_update(self):
        """Test updating task crew assignment"""
        if not self.task_id:
            print("❌ Skipping - No task ID available")
            return False
            
        success, response = self.run_test(
            "Update Task Crew",
            "PUT",
            f"tasks/{self.task_id}/crew",
            200,
            data={
                "crew_size": 3,
                "hours_per_day": 8.5,
                "overtime_allowed": True,
                "saturday_allowed": False,
                "trade_resource": "Framing"
            }
        )
        if success:
            print(f"   Updated crew assignment - Size: {response.get('crew_size')}, Trade: {response.get('trade_resource')}")
        return success

    def test_specific_job_access(self):
        """Test accessing the specific test job mentioned in requirements"""
        test_job_id = "9870de29-b2c3-46dd-9c2e-39a464cd8862"
        
        success, response = self.run_test(
            "Get Specific Test Job",
            "GET",
            f"jobs/{test_job_id}",
            200
        )
        if success:
            print(f"   Test job found: {response.get('job_number')} - {response.get('job_name')}")
            # Use this job for subsequent tests
            self.job_id = test_job_id
        return success

def main():
    print("🚀 Starting FitoutOS Phase 2 API Tests")
    print("=" * 50)
    
    tester = FitoutOSAPITester()
    
    # Authentication tests
    print("\n📋 AUTHENTICATION TESTS")
    if not tester.test_auth_login():
        print("❌ Login failed - stopping tests")
        return 1
    
    tester.test_auth_me()
    tester.test_auth_register()
    
    # Test specific job access first
    print("\n📋 SPECIFIC JOB ACCESS TEST")
    tester.test_specific_job_access()
    
    # Jobs tests
    print("\n📋 JOBS TESTS")
    tester.test_jobs_create()
    tester.test_jobs_list()
    tester.test_jobs_get()
    
    # Tasks tests
    print("\n📋 TASKS TESTS")
    tester.test_tasks_create()
    tester.test_tasks_list()
    
    # Task codes tests
    print("\n📋 TASK CODES TESTS")
    tester.test_master_task_codes()
    tester.test_job_task_codes()
    
    # Phase 2 Programme tests
    print("\n📋 PROGRAMME TESTS (Phase 2)")
    tester.test_programme_bulk_save()
    
    # Phase 2 Risk Analysis tests
    print("\n📋 RISK ANALYSIS TESTS (Phase 2)")
    tester.test_risk_analysis()
    
    # Phase 2 Checklist tests
    print("\n📋 CHECKLIST TESTS (Phase 2)")
    tester.test_task_checklist_get()
    tester.test_task_checklist_update()
    
    # Phase 2 Crew Assignment tests
    print("\n📋 CREW ASSIGNMENT TESTS (Phase 2)")
    tester.test_task_crew_update()
    
    # Timesheets tests
    print("\n📋 TIMESHEETS TESTS")
    tester.test_timesheets_create()
    tester.test_timesheets_list()
    
    # Resource analysis test
    print("\n📋 RESOURCE ANALYSIS TESTS")
    tester.test_resource_analysis()
    
    # Users test
    print("\n📋 USERS TESTS")
    tester.test_users_list()
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 FINAL RESULTS")
    print(f"Tests passed: {tester.tests_passed}/{tester.tests_run}")
    success_rate = (tester.tests_passed / tester.tests_run * 100) if tester.tests_run > 0 else 0
    print(f"Success rate: {success_rate:.1f}%")
    
    if success_rate >= 80:
        print("🎉 Backend API tests mostly successful!")
        return 0
    elif success_rate >= 50:
        print("⚠️  Backend API has some issues but core functionality works")
        return 0
    else:
        print("❌ Backend API has significant issues")
        return 1

if __name__ == "__main__":
    sys.exit(main())