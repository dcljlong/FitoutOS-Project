#!/usr/bin/env python3
"""
FitoutOS Backend API Testing Suite
Tests all critical API endpoints for the commercial interior fitout management system.
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

class FitoutOSAPITester:
    def __init__(self, base_url="https://project-gantt-5.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_job_id = None
        self.master_code_ids = []
        
        # Test data
        self.test_user = {
            "email": "test@test.com",
            "password": "test123"
        }

    def log_result(self, test_name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} - {test_name}")
        if details:
            print(f"    {details}")
        if success:
            self.tests_passed += 1
        print()

    def make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, 
                    files: Optional[Dict] = None) -> tuple[bool, Dict]:
        """Make HTTP request with error handling"""
        url = f"{self.base_url}/{endpoint.lstrip('/')}"
        headers = {'Content-Type': 'application/json'}
        
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'
        
        if files:
            headers.pop('Content-Type', None)  # Let requests set it for multipart

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=30)
            elif method == 'POST':
                if files:
                    response = requests.post(url, files=files, headers=headers, timeout=30)
                else:
                    response = requests.post(url, json=data, headers=headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=30)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")

            return response.status_code == 200 or response.status_code == 201, response.json() if response.content else {}
        except Exception as e:
            print(f"Request error: {str(e)}")
            return False, {"error": str(e)}

    def test_login(self):
        """Test user login with existing test user"""
        success, response = self.make_request('POST', '/auth/login', self.test_user)
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_id = response['user']['id']
            self.log_result("User Login", True, f"Logged in as {response['user']['name']} ({response['user']['role']})")
            return True
        else:
            self.log_result("User Login", False, f"Login failed: {response.get('detail', 'Unknown error')}")
            return False

    def test_auth_me(self):
        """Test get current user info"""
        success, response = self.make_request('GET', '/auth/me')
        
        if success and 'id' in response:
            self.log_result("Get Current User", True, f"Retrieved user: {response['name']}")
            return True
        else:
            self.log_result("Get Current User", False, "Failed to get user info")
            return False

    def test_dashboard_summary(self):
        """Test dashboard summary endpoint"""
        success, response = self.make_request('GET', '/dashboard/summary')
        
        expected_fields = ['active_jobs', 'tasks_starting_soon', 'blocked_tasks', 'pending_approvals', 'materials_attention', 'total_hours_week']
        
        if success and all(field in response for field in expected_fields):
            self.log_result("Dashboard Summary", True, f"Stats: {response['active_jobs']} active jobs, {response['total_hours_week']} hours this week")
            return True
        else:
            self.log_result("Dashboard Summary", False, f"Missing required fields or request failed")
            return False

    def test_seed_task_codes(self):
        """Test seeding master task codes"""
        success, response = self.make_request('POST', '/seed/task-codes')
        
        if success:
            self.log_result("Seed Task Codes", True, response.get('message', 'Seeded successfully'))
            return True
        else:
            self.log_result("Seed Task Codes", False, "Failed to seed task codes")
            return False

    def test_get_master_task_codes(self):
        """Test retrieving master task codes"""
        success, response = self.make_request('GET', '/task-codes/master')
        
        if success and isinstance(response, list):
            self.master_code_ids = [code['id'] for code in response[:5]]  # Store first 5 for testing
            self.log_result("Get Master Task Codes", True, f"Retrieved {len(response)} master codes")
            return True
        else:
            self.log_result("Get Master Task Codes", False, "Failed to retrieve master task codes")
            return False

    def test_create_job(self):
        """Test creating a new job"""
        job_data = {
            "job_number": f"TEST-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
            "job_name": "API Test Fitout Project",
            "main_contractor": "Test Construction Ltd",
            "site_address": "123 Test Street, Auckland",
            "planned_start": (datetime.now() + timedelta(days=7)).date().isoformat(),
            "planned_finish": (datetime.now() + timedelta(days=30)).date().isoformat(),
            "status": "active"
        }
        
        success, response = self.make_request('POST', '/jobs', job_data)
        
        if success and 'id' in response:
            self.test_job_id = response['id']
            self.log_result("Create Job", True, f"Created job: {response['job_number']} - {response['job_name']}")
            return True
        else:
            self.log_result("Create Job", False, f"Failed to create job: {response.get('detail', 'Unknown error')}")
            return False

    def test_get_jobs(self):
        """Test retrieving jobs list"""
        success, response = self.make_request('GET', '/jobs')
        
        if success and isinstance(response, list):
            self.log_result("Get Jobs", True, f"Retrieved {len(response)} jobs")
            return True
        else:
            self.log_result("Get Jobs", False, "Failed to retrieve jobs")
            return False

    def test_get_job_detail(self):
        """Test retrieving specific job details"""
        if not self.test_job_id:
            self.log_result("Get Job Detail", False, "No test job ID available")
            return False
        
        success, response = self.make_request('GET', f'/jobs/{self.test_job_id}')
        
        if success and 'id' in response:
            self.log_result("Get Job Detail", True, f"Retrieved job: {response['job_number']}")
            return True
        else:
            self.log_result("Get Job Detail", False, "Failed to retrieve job details")
            return False

    def test_add_job_task_codes(self):
        """Test adding task codes to a job"""
        if not self.test_job_id or not self.master_code_ids:
            self.log_result("Add Job Task Codes", False, "Missing test job or master codes")
            return False
        
        success_count = 0
        for master_code_id in self.master_code_ids[:3]:  # Add first 3 codes
            code_data = {
                "master_code_id": master_code_id,
                "is_active": True
            }
            
            success, response = self.make_request('POST', f'/jobs/{self.test_job_id}/task-codes', code_data)
            if success:
                success_count += 1
        
        if success_count > 0:
            self.log_result("Add Job Task Codes", True, f"Added {success_count} task codes to job")
            return True
        else:
            self.log_result("Add Job Task Codes", False, "Failed to add any task codes")
            return False

    def test_get_job_task_codes(self):
        """Test retrieving job-specific task codes"""
        if not self.test_job_id:
            self.log_result("Get Job Task Codes", False, "No test job ID available")
            return False
        
        success, response = self.make_request('GET', f'/jobs/{self.test_job_id}/task-codes')
        
        if success and isinstance(response, list):
            self.log_result("Get Job Task Codes", True, f"Retrieved {len(response)} job task codes")
            return True
        else:
            self.log_result("Get Job Task Codes", False, "Failed to retrieve job task codes")
            return False

    def test_create_timesheet_entries(self):
        """Test creating timesheet entries"""
        if not self.test_job_id or not self.master_code_ids:
            self.log_result("Create Timesheet Entries", False, "Missing test job or master codes")
            return False
        
        timesheet_data = {
            "rows": [
                {
                    "date": datetime.now().date().isoformat(),
                    "job_id": self.test_job_id,
                    "task_code_id": self.master_code_ids[0],
                    "description": "API test work entry",
                    "hours": 8.0
                }
            ]
        }
        
        success, response = self.make_request('POST', '/timesheets', timesheet_data)
        
        if success:
            self.log_result("Create Timesheet Entries", True, response.get('message', 'Created successfully'))
            return True
        else:
            self.log_result("Create Timesheet Entries", False, f"Failed: {response.get('detail', 'Unknown error')}")
            return False

    def test_get_timesheets(self):
        """Test retrieving timesheet entries"""
        success, response = self.make_request('GET', '/timesheets')
        
        if success and isinstance(response, list):
            self.log_result("Get Timesheets", True, f"Retrieved {len(response)} timesheet entries")
            return True
        else:
            self.log_result("Get Timesheets", False, "Failed to retrieve timesheets")
            return False

    def test_fallback_task_codes(self):
        """Test getting fallback task codes"""
        success, response = self.make_request('GET', '/task-codes/fallback')
        
        if success and isinstance(response, list):
            self.log_result("Get Fallback Task Codes", True, f"Retrieved {len(response)} fallback codes")
            return True
        else:
            self.log_result("Get Fallback Task Codes", False, "Failed to retrieve fallback codes")
            return False

    def test_reports_hours_by_job(self):
        """Test hours by job report"""
        success, response = self.make_request('GET', '/reports/hours-by-job')
        
        if success and isinstance(response, list):
            self.log_result("Hours by Job Report", True, f"Retrieved report with {len(response)} entries")
            return True
        else:
            self.log_result("Hours by Job Report", False, "Failed to retrieve report")
            return False

    def test_reports_hours_by_code(self):
        """Test hours by task code report"""
        success, response = self.make_request('GET', '/reports/hours-by-code')
        
        if success and isinstance(response, list):
            self.log_result("Hours by Code Report", True, f"Retrieved report with {len(response)} entries")
            return True
        else:
            self.log_result("Hours by Code Report", False, "Failed to retrieve report")
            return False

    def test_ai_settings(self):
        """Test AI settings endpoints"""
        # Get AI settings
        success, response = self.make_request('GET', '/settings/ai')
        
        if success and 'use_default_key' in response:
            self.log_result("Get AI Settings", True, f"Default key: {response['use_default_key']}, Has custom: {response.get('has_custom_key', False)}")
            return True
        else:
            self.log_result("Get AI Settings", False, "Failed to retrieve AI settings")
            return False

    def run_comprehensive_test(self):
        """Run all API tests in sequence"""
        print("=" * 60)
        print("🔧 FitoutOS Backend API Test Suite")
        print("=" * 60)
        print()

        # Critical authentication flow
        print("🔐 AUTHENTICATION TESTS")
        print("-" * 30)
        if not self.test_login():
            print("❌ Login failed - stopping tests")
            return False
        
        self.test_auth_me()
        print()

        # Dashboard and core data
        print("📊 DASHBOARD & CORE DATA TESTS")
        print("-" * 30)
        self.test_dashboard_summary()
        self.test_seed_task_codes()
        self.test_get_master_task_codes()
        self.test_fallback_task_codes()
        print()

        # Job management
        print("🏗️ JOB MANAGEMENT TESTS")
        print("-" * 30)
        self.test_create_job()
        self.test_get_jobs()
        self.test_get_job_detail()
        self.test_add_job_task_codes()
        self.test_get_job_task_codes()
        print()

        # Timesheet functionality
        print("⏰ TIMESHEET TESTS")
        print("-" * 30)
        self.test_create_timesheet_entries()
        self.test_get_timesheets()
        print()

        # Reporting
        print("📈 REPORTING TESTS")
        print("-" * 30)
        self.test_reports_hours_by_job()
        self.test_reports_hours_by_code()
        print()

        # AI Configuration
        print("🤖 AI INTEGRATION TESTS")
        print("-" * 30)
        self.test_ai_settings()
        print()

        # Final summary
        print("=" * 60)
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"📋 TEST SUMMARY: {self.tests_passed}/{self.tests_run} tests passed ({success_rate:.1f}%)")
        
        if success_rate >= 80:
            print("✅ Backend API is mostly functional - ready for frontend testing")
        elif success_rate >= 50:
            print("⚠️ Backend has some issues but basic functionality works")
        else:
            print("❌ Backend has significant issues - needs fixes before frontend testing")
        
        print("=" * 60)
        return success_rate >= 50

def main():
    """Main test execution"""
    tester = FitoutOSAPITester()
    success = tester.run_comprehensive_test()
    return 0 if success else 1

if __name__ == "__main__":
    sys.exit(main())