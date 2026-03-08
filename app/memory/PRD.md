# FitoutOS - Commercial Interior Fitout Management System

## Original Problem Statement
Build a production-ready web app for a New Zealand commercial interior fitout project manager with multi-job planning, programme, resource allocation, delay-impact, task-code, and timesheet management system.

## Architecture
- **Frontend**: React with Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI (Python)
- **Database**: MongoDB
- **AI Integration**: OpenAI GPT-5.2 via Emergent LLM Key (with configurable custom key option)
- **Authentication**: JWT-based with role-based access control

## User Personas
1. **Admin**: Full system access, AI settings, master task codes, all approvals
2. **Project Manager (PM)**: Job management, task codes, timesheets approval, reports
3. **Worker**: Timesheet entry only, limited job visibility

## Core Requirements (Static)
1. Job setup with AI document parsing (Excel/PDF)
2. Job-specific task code management
3. Task planner/timeline views
4. Timesheet entry with job-number-first workflow
5. Timesheet approval workflow
6. Resource/subcontractor management
7. Hours reporting (quoted vs actual)
8. Dashboard with alerts and metrics

## What's Been Implemented (MVP - March 2026)

### Authentication & Authorization
- [x] JWT-based authentication
- [x] User registration with role selection
- [x] Role-based route protection
- [x] Session management with auto-logout

### Jobs Module
- [x] Job CRUD operations
- [x] Quick create dialog
- [x] Auto-assign standard task codes to new jobs
- [x] Setup wizard with file upload
- [x] AI analysis endpoint (Gemini via Emergent)
- [x] Review and confirm workflow
- [x] Job detail view with progress

### Task Codes Module
- [x] Master task code management
- [x] Job-specific task code assignment
- [x] Automatic assignment of 10 standard codes per new job
- [x] Fallback codes for non-job entries (P&G, Tools, Safety, etc.)
- [x] Active/inactive toggle per job
- [x] Seeding endpoint with 19 default codes

### Timesheets Module
- [x] Job-number-first workflow
- [x] Dynamic task code dropdown based on job selection
- [x] Fallback reason selection for non-job entries
- [x] Hours validation and totaling
- [x] Draft/Submit workflow
- [x] PM/Admin approval interface
- [x] Bulk approve/reject functionality

### Tasks Module
- [x] Task list view with filters
- [x] Status tracking (planned, active, blocked, etc.)
- [x] Job filtering
- [x] Status overview cards
- [x] Task creation dialog from job detail page
- [x] Task detail side panel with all info
- [x] Link multiple task codes to a task
- [x] Subcontractor assignment option

### Materials/Procurement Module
- [x] Material tracking per task
- [x] Procurement status tracking (Required → Ordered → Delivered → On Site)
- [x] Long lead item flagging
- [x] Order lead time and delivery buffer configuration
- [x] Supplier tracking
- [x] Status update from task detail panel

### Gantt Chart & Delay Tracking (COMPLETED - March 8, 2026)
- [x] **Gantt Chart visualization on Tasks page**
  - Timeline view with task bars
  - Tasks grouped by job number
  - Week selector (2/4/6/8 weeks)
  - Navigation (prev/next week, Today button)
  - Status color coding (planned, active, blocked, delayed)
  - Tooltips with task details
- [x] **Drag-and-drop task rescheduling** (NEW)
  - Drag task bars to reschedule dates visually
  - Real-time drag indicator showing new date and days delta
  - Confirmation dialog with original vs new dates
  - Impact analysis showing affected downstream tasks
  - Success toast notification after reschedule
  - Task bar updates position immediately after confirmation
- [x] **Delay tracking engine**
  - Record delays with type, days, caused by, description
  - Auto-mark affected task as blocked
  - Downstream impact detection
  - Resolve delay functionality
  - Impact analysis endpoint

### Subcontractors Module
- [x] CRUD operations
- [x] Preferred/nominated flags
- [x] Contact information management
- [x] Trade type categorization

### Reports Module
- [x] Hours by job chart (bar chart)
- [x] Hours by task code chart (pie chart)
- [x] Quoted vs actual comparison
- [x] Variance calculation
- [x] Summary statistics

### Settings Module
- [x] AI key configuration (Emergent default vs custom)
- [x] System information display

### Dashboard
- [x] Active jobs count
- [x] Tasks starting soon
- [x] Blocked tasks count
- [x] Total hours this week
- [x] Recent jobs list
- [x] Quick actions
- [x] Pending approvals alert

## Prioritized Backlog

### P0 - Critical (COMPLETED)
- [x] Gantt chart visualization for tasks
- [x] Delay tracking and impact calculation

### P1 - High Priority
- [ ] Resource allocation calendar view
- [ ] Email notifications for approvals
- [ ] Subcontractor confirmation workflow
- [ ] Mobile-optimized worker timesheet view

### P2 - Medium Priority
- [ ] Advanced AI suggestions for job setup
- [ ] Auto-generated subcontractor enquiry messages
- [ ] Export timesheets to CSV/Excel
- [ ] Task dependencies visualization in Gantt

### P3 - Low Priority (Phase 2)
- [ ] Push notifications
- [ ] Payroll export variants
- [ ] Advanced forecasting
- [ ] Weather delay integration

## Test Credentials
- **Email**: admin@test.com
- **Password**: password

## API Endpoints Summary
- Auth: `/api/auth/register`, `/api/auth/login`, `/api/auth/me`
- Jobs: `/api/jobs` (CRUD), `/api/jobs/{id}/task-codes`, `/api/jobs/{id}/upload`, `/api/jobs/{id}/analyze`
- Tasks: `/api/tasks` (CRUD)
- Delays: `/api/delays` (CRUD), `/api/delays/{id}/resolve`, `/api/delays/impact-analysis/{task_id}`
- Materials: `/api/materials` (CRUD)
- Timesheets: `/api/timesheets` (CRUD), `/api/timesheets/submit`, `/api/timesheets/approve`
- Subcontractors: `/api/subcontractors` (CRUD)
- Reports: `/api/reports/hours-by-job`, `/api/reports/hours-by-code`
- Dashboard: `/api/dashboard/summary`
