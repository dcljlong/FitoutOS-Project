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
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [summaryRes, jobsRes, tasksRes] = await Promise.all([
        api.get('/dashboard/summary'),
        api.get('/jobs'),
        api.get('/tasks'),
      ]);
      setSummary(summaryRes.data);
      setRecentJobs(jobsRes.data || []);
      setAllTasks(tasksRes.data || []);
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
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">
            Welcome back, {user?.name?.split(' ')[0]}
          </h1>
          <p className="text-muted-foreground mt-1">
            Open a job and get to work
          </p>
        </div>

        {canManage() && (
          <div className="flex flex-wrap gap-2">
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
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
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
                          onClick={() => navigate(`/jobs/${job.id}`)}
                        >
                          <FolderOpen className="mr-2 h-4 w-4" />
                          Open Job
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/jobs/${job.id}/programmes`)}
                        >
                          📊 Programmes
                        </Button>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/resource-analysis/${job.id}`)}
                        >
                          <BarChart3 className="mr-2 h-4 w-4" />
                          Analysis
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
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


