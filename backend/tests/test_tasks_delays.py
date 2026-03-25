#!/usr/bin/env python3
"""
FitoutOS Backend API Tests - Tasks, Delays, and Gantt Features
Tests the task management, delay tracking, and related endpoints.
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://fitout-stability.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "admin@test.com"
TEST_PASSWORD = "admin123"


@pytest.fixture(scope="module")
def api_client():
    """Create a requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def auth_token(api_client):
    """Get authentication token"""
    response = api_client.post(
        f"{BASE_URL}/api/auth/login",
        json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
    )
    if response.status_code == 200:
        data = response.json()
        return data.get("access_token")
    pytest.skip(f"Authentication failed - skipping tests: {response.text}")


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestAuthAndUser:
    """Authentication and user endpoint tests"""

    def test_login_with_test_credentials(self, api_client):
        """Test login with admin@test.com credentials"""
        response = api_client.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data, "No access token in response"
        assert "user" in data, "No user data in response"
        assert data["user"]["email"] == TEST_EMAIL
        print(f"Login successful for user: {data['user']['name']} (role: {data['user']['role']})")

    def test_get_current_user(self, authenticated_client):
        """Test GET /auth/me endpoint"""
        response = authenticated_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Failed to get user: {response.text}"
        data = response.json()
        assert "id" in data
        assert "email" in data
        print(f"Current user: {data['name']}")


class TestJobs:
    """Job management endpoint tests"""

    def test_get_jobs_list(self, authenticated_client):
        """Test GET /jobs endpoint"""
        response = authenticated_client.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200, f"Failed to get jobs: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Jobs response should be a list"
        print(f"Found {len(data)} jobs")
        
        # Verify specific jobs exist as mentioned in context
        job_numbers = [job['job_number'] for job in data]
        if '2024-002' in job_numbers or '2024-003' in job_numbers:
            print("Found expected test jobs 2024-002/2024-003")

    def test_get_job_detail_by_number(self, authenticated_client):
        """Test getting job detail for a specific job"""
        # First get jobs list to find an existing job
        response = authenticated_client.get(f"{BASE_URL}/api/jobs")
        assert response.status_code == 200
        jobs = response.json()
        
        if len(jobs) > 0:
            job_id = jobs[0]['id']
            detail_response = authenticated_client.get(f"{BASE_URL}/api/jobs/{job_id}")
            assert detail_response.status_code == 200, f"Failed to get job detail: {detail_response.text}"
            job = detail_response.json()
            assert "id" in job
            assert "job_number" in job
            assert "job_name" in job
            print(f"Job detail: {job['job_number']} - {job['job_name']}")


class TestTasks:
    """Task endpoint tests - Critical for Gantt and List views"""

    def test_get_all_tasks(self, authenticated_client):
        """Test GET /tasks endpoint - needed for Tasks Page List and Gantt views"""
        response = authenticated_client.get(f"{BASE_URL}/api/tasks")
        assert response.status_code == 200, f"Failed to get tasks: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Tasks response should be a list"
        print(f"Found {len(data)} tasks total")
        
        # Verify task data structure
        if len(data) > 0:
            task = data[0]
            required_fields = ['id', 'job_id', 'task_name', 'status', 'linked_task_codes']
            for field in required_fields:
                assert field in task, f"Missing required field: {field}"
            
            # Log task statuses for Gantt/List view verification
            statuses = {}
            for t in data:
                status = t.get('status', 'unknown')
                statuses[status] = statuses.get(status, 0) + 1
            print(f"Task status distribution: {statuses}")

    def test_get_tasks_by_job(self, authenticated_client):
        """Test GET /tasks?job_id= endpoint - needed for Job Detail page"""
        # First get a job
        jobs_response = authenticated_client.get(f"{BASE_URL}/api/jobs")
        assert jobs_response.status_code == 200
        jobs = jobs_response.json()
        
        if len(jobs) > 0:
            job_id = jobs[0]['id']
            response = authenticated_client.get(f"{BASE_URL}/api/tasks?job_id={job_id}")
            assert response.status_code == 200, f"Failed to get tasks by job: {response.text}"
            data = response.json()
            assert isinstance(data, list)
            # Verify all returned tasks belong to the requested job
            for task in data:
                assert task['job_id'] == job_id
            print(f"Found {len(data)} tasks for job {jobs[0]['job_number']}")

    def test_create_task(self, authenticated_client):
        """Test POST /tasks endpoint - Task creation dialog"""
        # Get a job to associate the task with
        jobs_response = authenticated_client.get(f"{BASE_URL}/api/jobs")
        assert jobs_response.status_code == 200
        jobs = jobs_response.json()
        
        if len(jobs) == 0:
            pytest.skip("No jobs available for task creation test")
        
        job_id = jobs[0]['id']
        
        task_data = {
            "job_id": job_id,
            "task_name": f"TEST_Task_{datetime.now().strftime('%H%M%S')}",
            "task_type": "Installation",
            "linked_task_codes": [],
            "planned_start": (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"),
            "planned_finish": (datetime.now() + timedelta(days=5)).strftime("%Y-%m-%d"),
            "duration_days": 5,
            "status": "planned",
            "is_internal": True,
            "quoted_hours": 40
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/tasks", json=task_data)
        assert response.status_code in [200, 201], f"Failed to create task: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["task_name"] == task_data["task_name"]
        assert data["status"] == "planned"
        assert data["planned_start"] == task_data["planned_start"]
        print(f"Created task: {data['task_name']} with ID {data['id']}")
        
        # Return task ID for cleanup or further tests
        return data["id"]

    def test_update_task_status(self, authenticated_client):
        """Test PUT /tasks/{task_id} endpoint - status updates"""
        # Get existing tasks
        response = authenticated_client.get(f"{BASE_URL}/api/tasks")
        assert response.status_code == 200
        tasks = response.json()
        
        # Find a task that's not complete to update
        test_task = None
        for task in tasks:
            if task['status'] != 'complete' and task['task_name'].startswith('TEST_'):
                test_task = task
                break
        
        if not test_task:
            pytest.skip("No suitable test task found for status update")
        
        # Update the task
        update_data = {
            "job_id": test_task["job_id"],
            "task_name": test_task["task_name"],
            "status": "active",
            "is_internal": test_task.get("is_internal", True),
            "linked_task_codes": test_task.get("linked_task_codes", [])
        }
        
        response = authenticated_client.put(f"{BASE_URL}/api/tasks/{test_task['id']}", json=update_data)
        assert response.status_code == 200, f"Failed to update task: {response.text}"
        
        data = response.json()
        assert data["status"] == "active"
        print(f"Updated task status to: {data['status']}")


class TestDelays:
    """Delay tracking endpoint tests - Critical for delay recording feature"""

    def test_get_delays_list(self, authenticated_client):
        """Test GET /delays endpoint"""
        response = authenticated_client.get(f"{BASE_URL}/api/delays")
        assert response.status_code == 200, f"Failed to get delays: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Delays response should be a list"
        print(f"Found {len(data)} delays")
        
        if len(data) > 0:
            delay = data[0]
            required_fields = ['id', 'task_id', 'task_name', 'delay_type', 'delay_days']
            for field in required_fields:
                assert field in delay, f"Missing required field: {field}"
            print(f"Sample delay: {delay['task_name']} - {delay['delay_days']} days ({delay['delay_type']})")

    def test_get_delays_by_job(self, authenticated_client):
        """Test GET /delays?job_id= endpoint - for Job Detail page Delays tab"""
        jobs_response = authenticated_client.get(f"{BASE_URL}/api/jobs")
        assert jobs_response.status_code == 200
        jobs = jobs_response.json()
        
        if len(jobs) > 0:
            job_id = jobs[0]['id']
            response = authenticated_client.get(f"{BASE_URL}/api/delays?job_id={job_id}")
            assert response.status_code == 200, f"Failed to get delays by job: {response.text}"
            data = response.json()
            assert isinstance(data, list)
            print(f"Found {len(data)} delays for job {jobs[0]['job_number']}")

    def test_create_delay(self, authenticated_client):
        """Test POST /delays endpoint - Delay recording"""
        # Get a task to record delay against
        tasks_response = authenticated_client.get(f"{BASE_URL}/api/tasks")
        assert tasks_response.status_code == 200
        tasks = tasks_response.json()
        
        # Find a task that's not already blocked
        test_task = None
        for task in tasks:
            if task['status'] not in ['blocked', 'complete']:
                test_task = task
                break
        
        if not test_task:
            pytest.skip("No suitable task found for delay recording")
        
        delay_data = {
            "task_id": test_task["id"],
            "delay_type": "main_contractor",
            "delay_days": 3,
            "description": "TEST_Delay - API Test delay recording",
            "caused_by": "Testing system"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/delays", json=delay_data)
        assert response.status_code in [200, 201], f"Failed to create delay: {response.text}"
        
        data = response.json()
        assert "id" in data
        assert data["delay_days"] == 3
        assert data["delay_type"] == "main_contractor"
        print(f"Created delay: {data['delay_days']} days for task '{data['task_name']}'")
        
        # Verify the delay has affected_tasks field
        assert "affected_tasks" in data
        print(f"Affected downstream tasks: {len(data.get('affected_tasks', []))}")
        
        return data["id"]

    def test_delay_marks_task_blocked(self, authenticated_client):
        """Verify that recording a delay updates the task status"""
        # Get a task that's planned
        tasks_response = authenticated_client.get(f"{BASE_URL}/api/tasks")
        tasks = tasks_response.json()
        
        # Find a planned task
        test_task = None
        for task in tasks:
            if task['status'] == 'planned':
                test_task = task
                break
        
        if not test_task:
            pytest.skip("No planned task available for delay test")
        
        original_status = test_task['status']
        
        # Record a delay
        delay_data = {
            "task_id": test_task["id"],
            "delay_type": "materials",
            "delay_days": 2,
            "description": "TEST_Material delay test"
        }
        
        delay_response = authenticated_client.post(f"{BASE_URL}/api/delays", json=delay_data)
        assert delay_response.status_code in [200, 201], f"Failed to create delay: {delay_response.text}"
        
        # Verify task status was updated
        task_response = authenticated_client.get(f"{BASE_URL}/api/tasks/{test_task['id']}")
        assert task_response.status_code == 200
        
        updated_task = task_response.json()
        # Task should now be 'blocked' (for materials delay type)
        assert updated_task['status'] in ['blocked', 'delayed'], f"Task status should be blocked or delayed, got: {updated_task['status']}"
        print(f"Task status changed from '{original_status}' to '{updated_task['status']}'")

    def test_resolve_delay(self, authenticated_client):
        """Test POST /delays/{delay_id}/resolve endpoint"""
        # Get delays list
        delays_response = authenticated_client.get(f"{BASE_URL}/api/delays")
        assert delays_response.status_code == 200
        delays = delays_response.json()
        
        # Find an unresolved delay
        unresolved = [d for d in delays if not d.get('resolved', True)]
        
        if len(unresolved) == 0:
            pytest.skip("No unresolved delays to test resolution")
        
        delay_id = unresolved[0]['id']
        
        response = authenticated_client.post(f"{BASE_URL}/api/delays/{delay_id}/resolve")
        assert response.status_code == 200, f"Failed to resolve delay: {response.text}"
        
        data = response.json()
        assert "message" in data
        print(f"Delay resolved: {data['message']}")

    def test_delay_impact_analysis(self, authenticated_client):
        """Test GET /delays/impact-analysis/{task_id} endpoint"""
        # Get a task with planned dates
        tasks_response = authenticated_client.get(f"{BASE_URL}/api/tasks")
        tasks = tasks_response.json()
        
        # Find a task with planned_finish
        test_task = None
        for task in tasks:
            if task.get('planned_finish'):
                test_task = task
                break
        
        if not test_task:
            pytest.skip("No task with planned_finish found for impact analysis")
        
        response = authenticated_client.get(
            f"{BASE_URL}/api/delays/impact-analysis/{test_task['id']}?delay_days=5"
        )
        assert response.status_code == 200, f"Failed to get impact analysis: {response.text}"
        
        data = response.json()
        assert "delayed_task" in data
        assert "delay_days" in data
        assert "affected_tasks" in data
        assert "total_affected" in data
        
        print(f"Impact analysis: {data['total_affected']} tasks would be affected by 5 day delay")


class TestTaskCodes:
    """Task code endpoint tests - for Job Detail Task Codes tab"""

    def test_get_job_task_codes(self, authenticated_client):
        """Test GET /jobs/{job_id}/task-codes endpoint"""
        jobs_response = authenticated_client.get(f"{BASE_URL}/api/jobs")
        assert jobs_response.status_code == 200
        jobs = jobs_response.json()
        
        if len(jobs) > 0:
            job_id = jobs[0]['id']
            response = authenticated_client.get(f"{BASE_URL}/api/jobs/{job_id}/task-codes")
            assert response.status_code == 200, f"Failed to get task codes: {response.text}"
            data = response.json()
            assert isinstance(data, list)
            
            if len(data) > 0:
                code = data[0]
                assert "code" in code
                assert "name" in code
                assert "is_active" in code
            
            print(f"Found {len(data)} task codes for job {jobs[0]['job_number']}")


class TestDashboard:
    """Dashboard endpoint tests"""

    def test_dashboard_summary(self, authenticated_client):
        """Test GET /dashboard/summary endpoint"""
        response = authenticated_client.get(f"{BASE_URL}/api/dashboard/summary")
        assert response.status_code == 200, f"Failed to get dashboard: {response.text}"
        
        data = response.json()
        expected_fields = ['active_jobs', 'tasks_starting_soon', 'blocked_tasks', 'pending_approvals']
        for field in expected_fields:
            assert field in data, f"Missing dashboard field: {field}"
        
        print(f"Dashboard: {data['active_jobs']} active jobs, {data['blocked_tasks']} blocked tasks")


# Cleanup fixture to remove test data
@pytest.fixture(scope="module", autouse=True)
def cleanup_test_data(authenticated_client):
    """Cleanup TEST_ prefixed data after tests complete"""
    yield
    # Note: In a real scenario, you might want to delete test-created data
    # For now, we leave it as test data can be useful for debugging
    print("\nTest suite completed - TEST_ prefixed data may remain in database")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
