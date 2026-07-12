import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Briefcase,
  ListTodo,
  Clock,
  AlertTriangle,
  Package,
  CheckCircle,
  ArrowRight,
  Plus,
  FolderOpen,
  BarChart3,
} from 'lucide-react';
import { toast } from 'sonner';

export default function DashboardPage() {
  const { user, canManage } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [recentJobs, setRecentJobs] = useState([]);
  const [labourByJob, setLabourByJob] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [summaryRes, jobsRes, tasksRes, labourRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/jobs'),
        api.get('/tasks'),
        api.get('/reports/hours-by-job'),
      ]);
      const normaliseList = (payload) => {
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload?.items)) return payload.items;
        if (Array.isArray(payload?.jobs)) return payload.jobs;
        if (Array.isArray(payload?.tasks)) return payload.tasks;
        if (Array.isArray(payload?.data)) return payload.data;
        if (Array.isArray(payload?.results)) return payload.results;
        return [];
      };

      setSummary(summaryRes.data);
      setRecentJobs(normaliseList(jobsRes.data));
      setLabourByJob(normaliseList(labourRes.data));
      setAllTasks(normaliseList(tasksRes.data));
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const seedTaskCodes = async () => {
    try {
      await api.post('/seed/task-codes');
      toast.success('Task codes seeded successfully');
    } catch (error) {
      toast.error('Failed to seed task codes');
    }
  };

  const completedCount = allTasks.filter(t => t.status === 'complete').length;
  const blockedCount = allTasks.filter(t => t.is_blocked || t.status === 'blocked').length;
  const atRiskCount = allTasks.filter(t => t.delay_risk || t.at_risk || t.status === 'at_risk' || t.status === 'delayed').length;

  const labourRows = Array.isArray(labourByJob) ? labourByJob : [];
  const labourTotalHours = labourRows.reduce((sum, row) => {
    const value = Number(row?.total_hours ?? row?.actual_hours ?? 0);
    return sum + (Number.isFinite(value) ? value : 0);
  }, 0);
  const labourJobCount = labourRows.filter((row) => {
    const value = Number(row?.total_hours ?? row?.actual_hours ?? 0);
    return Number.isFinite(value) && value > 0;
  }).length;
  const labourTopRows = labourRows
    .filter((row) => {
      const value = Number(row?.total_hours ?? row?.actual_hours ?? 0);
      return Number.isFinite(value) && value > 0;
    })
    .sort((a, b) => Number(b?.total_hours ?? b?.actual_hours ?? 0) - Number(a?.total_hours ?? a?.actual_hours ?? 0))
    .slice(0, 3);

  const formatLabourHours = (value) => {
    const number = Number(value || 0);
    return Number.isFinite(number) ? number.toFixed(1) : '0.0';
  };

  // FITOUTOS / DASHBOARD LABOUR ALLOCATION LABEL CLARITY V3
  const formatTaskCodes = (codes) => {
    if (!Array.isArray(codes) || codes.length === 0) return 'No labour allocation split yet';
    return codes
      .slice(0, 3)
      .map((code) => `${code.task_code}: ${formatLabourHours(code.hours)}h`)
      .join(' • ');
  };

  // FITOUTOS / DASHBOARD UNMATCHED LABOUR DEEP LINK V1
  const hasUnmatchedLabour = (codes) => (
    Array.isArray(codes) &&
    codes.some((code) => (
      code?.task_code === 'No source task code (unmatched)' &&
      Number(code?.hours || 0) > 0
    ))
  );

  if (loading) {
    return (
      <div className="space-y-4" data-testid="dashboard-page">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-12 bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="h-40 bg-muted rounded" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4" data-testid="dashboard-page">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl md:text-3xl font-bold font-['Manrope'] leading-tight">
            Dashboard
          </h1>
          <p className="text-muted-foreground text-sm">
            <span className="font-semibold text-foreground">Welcome back, {user?.name?.split(' ')[0]}</span>
            <span className="mx-2 text-muted-foreground/60">-</span>
            <span>Open a job and get to work</span>
          </p>
        </div>

        {canManage() && (
          <div className="flex flex-wrap gap-2 md:pt-1">
            <Link to="/jobs/new">
              <Button data-testid="new-job-btn">
                <Plus className="mr-2 h-4 w-4" />
                New Job
              </Button>
            </Link>

            <Button onClick={seedTaskCodes} variant="outline" data-testid="seed-codes-btn">
              <Package className="mr-2 h-4 w-4" />
              Seed Task Codes
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Active Jobs</div>
            <div className="mt-1 text-2xl font-bold">{summary?.active_jobs || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total Tasks</div>
            <div className="mt-1 text-2xl font-bold">{allTasks.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Blocked</div>
            <div className="mt-1 text-2xl font-bold text-red-600">{blockedCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">At Risk</div>
            <div className="mt-1 text-2xl font-bold text-amber-600">{atRiskCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">This Week Hours</div>
            <div className="mt-1 text-2xl font-bold">{summary?.total_hours_week?.toFixed(1) || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Complete</div>
            <div className="mt-1 text-2xl font-bold text-green-600">{completedCount}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <Card className="xl:col-span-3" data-testid="timesheet-labour-dashboard-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">Timesheet Labour</CardTitle>
              <CardDescription>Approved labour imported from Timesheet Manager and grouped by source task code or matched FitoutOS task</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
                <div className="rounded-lg border bg-muted/30 p-3" data-testid="timesheet-labour-total-hours">
                  <div className="text-xs text-muted-foreground">Imported actual hours</div>
                  <div className="mt-1 text-2xl font-bold">{formatLabourHours(labourTotalHours)}h</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3" data-testid="timesheet-labour-job-count">
                  <div className="text-xs text-muted-foreground">Jobs with labour</div>
                  <div className="mt-1 text-2xl font-bold">{labourJobCount}</div>
                </div>
                <div className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">Source</div>
                  <div className="mt-1 text-sm font-semibold">Timesheet Manager export</div>
                  <div className="text-xs text-muted-foreground">Approved rows only</div>
                </div>
              </div>

              {labourTopRows.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground" data-testid="timesheet-labour-empty">
                  No imported Timesheet Manager labour is currently visible. Import approved rows to populate this dashboard.
                </div>
              ) : (
                <div className="space-y-2" data-testid="timesheet-labour-top-jobs">
                  {labourTopRows.map((row) => {
                    const rowHasUnmatchedLabour = hasUnmatchedLabour(row.task_codes);
                    const jobRouteId = String(row.job_id || '').trim();

                    return (
                      <div
                        key={`${row.job_id || row.job_number}-${row.job_name || 'job'}`}
                        className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">{row.job_number || 'No job #'}</span>
                            <span className="font-semibold">{row.job_name || 'Unnamed job'}</span>
                          </div>
                          <p className="text-xs text-muted-foreground">{formatTaskCodes(row.task_codes)}</p>
                        </div>

                        <div className="flex items-center justify-between gap-3 md:justify-end">
                          {jobRouteId && (
                            <Link to={`/jobs/${jobRouteId}${rowHasUnmatchedLabour ? '#unmatched-labour' : ''}`}>
                              <Button
                                variant={rowHasUnmatchedLabour ? 'outline' : 'ghost'}
                                size="sm"
                                className="shrink-0"
                                data-testid={rowHasUnmatchedLabour
                                  ? 'timesheet-labour-review-unmatched'
                                  : 'timesheet-labour-open-job'}
                              >
                                {rowHasUnmatchedLabour ? (
                                  <AlertTriangle className="mr-2 h-4 w-4 text-amber-600" />
                                ) : (
                                  <FolderOpen className="mr-2 h-4 w-4" />
                                )}
                                {rowHasUnmatchedLabour ? 'Review unmatched' : 'Open job'}
                              </Button>
                            </Link>
                          )}

                          <div className="text-right">
                            <div className="text-lg font-bold">{formatLabourHours(row.total_hours ?? row.actual_hours)}h</div>
                            <div className="text-xs text-muted-foreground">actual labour</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to="/reports">
                  <Button variant="outline" size="sm" data-testid="timesheet-labour-view-reports">
                    View Reports
                  </Button>
                </Link>
                <Link to="/jobs">
                  <Button variant="ghost" size="sm">
                    Open Jobs
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card className="xl:col-span-3" data-testid="recent-jobs">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-xl">Jobs</CardTitle>
                <CardDescription>Select a job to open its working area</CardDescription>
              </div>
              <Link to="/jobs">
                <Button variant="outline" size="sm">
                  View all <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>

          <CardContent>
            {recentJobs.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No jobs yet</p>
                {canManage() && (
                  <Link to="/jobs/new" className="mt-3 inline-block">
                    <Button variant="outline" size="sm">
                      Create your first job
                    </Button>
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => {
                  const jobRouteId = job.id || job.job_id || job._id;

                  return (
                    <div
                      key={jobRouteId || job.job_number}
                      className="rounded-lg border p-4 hover:bg-accent/40 transition-colors"
                      data-testid={`job-${job.job_number}`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-sm text-muted-foreground">{job.job_number}</span>
                            <Badge variant={job.status === 'active' ? 'default' : 'secondary'}>
                              {job.status}
                            </Badge>
                          </div>

                          <h3 className="font-semibold mt-1 truncate">{job.job_name}</h3>

                          <div className="mt-1 text-sm text-muted-foreground space-y-1">
                            {job.main_contractor && <div className="truncate">{job.main_contractor}</div>}
                            {job.site_address && <div className="truncate">{job.site_address}</div>}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/jobs/${jobRouteId}`)}
                            disabled={!jobRouteId}
                          >
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Open Job
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/jobs/${jobRouteId}/programmes`)}
                            disabled={!jobRouteId}
                          >
                            Programmes
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => navigate(`/resource-analysis/${jobRouteId}`)}
                            disabled={!jobRouteId}
                          >
                            <BarChart3 className="mr-2 h-4 w-4" />
                            Analysis
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card data-testid="quick-actions">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/timesheets" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Clock className="mr-2 h-4 w-4" />
                  Enter Timesheet
                </Button>
              </Link>

              <Link to="/tasks" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <ListTodo className="mr-2 h-4 w-4" />
                  View Tasks
                </Button>
              </Link>

              <Link to="/jobs" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Briefcase className="mr-2 h-4 w-4" />
                  View Jobs
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Live Snapshot</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Blocked Tasks</span>
                <span className="font-semibold text-red-600">{blockedCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">At Risk Tasks</span>
                <span className="font-semibold text-amber-600">{atRiskCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Completed Tasks</span>
                <span className="font-semibold text-green-600">{completedCount}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Hours This Week</span>
                <span className="font-semibold">{summary?.total_hours_week?.toFixed(1) || 0}</span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Active Jobs</span>
                <span className="font-semibold">{summary?.active_jobs || 0}</span>
              </div>
            </CardContent>
          </Card>

          {canManage() && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Manager Shortcuts</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Link to="/timesheets/approval" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Timesheet Approvals
                  </Button>
                </Link>

                <Link to="/task-codes" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <Package className="mr-2 h-4 w-4" />
                    Task Codes
                  </Button>
                </Link>

                <Link to="/reports" className="block">
                  <Button variant="outline" className="w-full justify-start">
                    <AlertTriangle className="mr-2 h-4 w-4" />
                    Reports
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

