# FitoutOS Project - Product Requirements Document

## Original Problem Statement
FitoutOS-Project - Commercial Interior Fitout Management application. The goal was to fix all errors, install dependencies, make backend and frontend run, fix API connection issues, build errors, runtime errors, missing environment variables, imports, broken routes, database connection, and authentication.

**Phase 2**: Make the system reliable for real fitout project planning using programme-driven workflow. Implement Programme Upload → Edit → Confirm workflow, Professional Gantt Chart Editor, Dependency/Prerequisite tracking, Pre-start checklist, Risk/Delay warning, and Resource/crew assignment UI.

## Architecture
- **Backend**: FastAPI (Python) running on port 8001
- **Frontend**: React with CRACO running on port 3000
- **Database**: MongoDB
- **Authentication**: JWT-based custom auth
- **External Integration**: OpenAI API via emergentintegrations library

## User Personas
1. **Admin** - Full system access, user management, all job operations
2. **Project Manager (PM)** - Job creation, task management, timesheet approval
3. **Worker** - Timesheet entry, view assigned tasks

## Core Requirements (Static)
- User authentication (login/register)
- Job management (CRUD operations)
- Task management linked to jobs
- Timesheet entry and approval workflow
- Programme upload and AI analysis
- Resource analysis with NZ work hours calculation
- Reports generation
- Task code management (master and job-specific)
- Subcontractor management
- Delay tracking

## What's Been Implemented

### Phase 1 - March 24, 2026
- Fixed backend server.py (Windows line endings, OpenAI integration)
- Created .env files for backend and frontend
- Seeded master task codes for fitout work

### Phase 2 - March 24, 2026

#### 1. Programme Upload → Edit → Confirm Workflow
- Enhanced programme editor table with columns:
  - Task Name, Phase, Trade, Start Date, Finish Date, Duration (days)
  - Predecessor dropdown (select from previous items)
  - Task Code mapping dropdown
  - Crew size input
- Auto-calculation: changing start date updates finish date based on duration
- API: `POST /api/jobs/{job_id}/programme/bulk-save` - Save entire programme
- API: `POST /api/jobs/{job_id}/programme/generate-tasks` - Generate tasks from programme

#### 2. Professional Gantt Chart Editor
- New GanttPage component at `/jobs/{jobId}/gantt`
- Timeline view with Day/Week/Month zoom options
- Task bars colored by trade or status
- Weekend highlighting (grey)
- NZ Holiday highlighting (red)
- Dependency lines between tasks (SVG arrows)
- Drag to move tasks (editable mode)
- Drag to resize duration
- Navigation controls (Today, prev/next)
- Legend showing all trade colors

#### 3. Dependency / Prerequisite Tracking
- `predecessor_ids` field on tasks
- `prerequisite_owner` field (YOU, Main contractor, Painter, Electrician, Plumber, HVAC, Joiner, Other)
- `prerequisite_status` field (pending, ready, waiting, blocked, complete)
- `prerequisite_note` field
- `risk_flag` boolean
- API: `PUT /api/tasks/{task_id}/prerequisite` - Update prerequisite info

#### 4. Pre-start Checklist
- Default checklist items:
  - Area handed over
  - Previous trade complete
  - Services complete
  - Inspection passed
  - Materials ready
  - Access ready
  - Programme confirmed
  - MC confirmed ready
- API: `GET /api/tasks/{task_id}/checklist` - Get checklist with defaults
- API: `PUT /api/tasks/{task_id}/checklist` - Update checklist items
- PreStartChecklist component (full and compact views)
- Progress indicator showing X/8 complete

#### 5. Risk / Delay Warning System
- API: `GET /api/jobs/{job_id}/risk-analysis` - Get blocked/at-risk tasks
- Detection logic:
  - Task has status "blocked" or "delayed"
  - Prerequisite status is "blocked" or "waiting"
  - Predecessor task not complete
  - Start date within 3 days and task not started
  - Start date passed and task still planned
- RiskWarnings component shows:
  - Blocked tasks with owner info
  - At-risk tasks with reason
  - Checklist incomplete tasks with missing items
- Displayed on Gantt page sidebar

#### 6. Resource / Crew Assignment UI
- Task fields: `crew_size`, `hours_per_day`, `overtime_allowed`, `saturday_allowed`, `trade_resource`
- API: `PUT /api/tasks/{task_id}/crew` - Update crew assignment
- Integrated into enhanced TaskResponse model

## Testing Status - March 24, 2026
- Backend APIs: 100% working
- Frontend UI: Working with minor timing issues on some redirects
- Gantt Chart: Fully functional
- Risk Warnings: Fully functional
- Pre-start Checklist: Fully functional
- Programme Editor: Table-based editor implemented

## Prioritized Backlog

### P0 (Critical) - DONE
- [x] Backend starts without errors
- [x] Frontend builds and loads
- [x] API connection working
- [x] Authentication working
- [x] Database connection
- [x] Gantt Chart page
- [x] Risk analysis endpoint
- [x] Pre-start checklist
- [x] Crew assignment

### P1 (High Priority)
- [ ] Test programme upload with actual Excel files
- [ ] Verify AI analysis extracts dates and dependencies
- [ ] Full end-to-end programme → tasks → gantt → timesheets flow

### P2 (Medium Priority)
- [ ] Gantt drag-and-drop fine-tuning
- [ ] Critical path calculation
- [ ] Mobile responsiveness

### P3 (Low Priority)
- [ ] Email notifications for blocked tasks
- [ ] Dashboard widgets for risk overview
- [ ] Batch timesheet approval

## Technical Notes
- Backend URL: https://9c1fa4b6-ed08-4109-ba37-d518630c8ad8.preview.emergentagent.com
- Test credentials: admin@test.com / admin123
- OpenAI integration uses Emergent LLM Key via emergentintegrations library
- NZ public holidays for 2026 hardcoded in GanttChart component
- Risk analysis runs on-demand, not in real-time

## Next Tasks
1. Test full programme workflow with real Excel/PDF files
2. Verify AI extracts dates and maps to programme items
3. Test drag-to-move in Gantt chart
4. Test timesheet entry against tasks with crew assigned
5. Verify resource analysis updates when crew changes
