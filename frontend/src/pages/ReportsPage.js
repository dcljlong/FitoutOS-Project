import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Briefcase,
  CheckCircle2,
  Clock3,
  Loader2,
  PlayCircle,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

const numberValue = (value) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getItemId = (item) => item?.id || item?._id || item?.job_id || item?.task_id || '';

const formatHours = (value) => `${numberValue(value).toFixed(1)}h`;

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-NZ', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const getContractorName = (job) =>
  job?.main_contractor ||
  job?.contractor ||
  job?.builder ||
  job?.client ||
  'Not set';

const hasStartedTask = (task) =>
  Boolean(task?.actual_start) ||
  numberValue(task?.actual_hours) > 0 ||
  numberValue(task?.percent_complete) > 0 ||
  task?.status === 'active';

const isCompleteTask = (task) =>
  task?.status === 'complete' || numberValue(task?.percent_complete) >= 100;

const isBlockedTask = (task) =>
  task?.status === 'blocked' || task?.is_blocked === true;

function MetricCard({ title, value, subtext, icon: Icon, tone = 'default' }) {
  const toneClass =
    tone === 'danger'
      ? 'border-red-200 bg-red-50'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50'
        : tone === 'success'
          ? 'border-green-200 bg-green-50'
          : 'border-border';

  const iconClass =
    tone === 'danger'
      ? 'text-red-600'
      : tone === 'warning'
        ? 'text-amber-600'
        : tone === 'success'
          ? 'text-green-600'
          : 'text-muted-foreground';

  return (
    <Card className={toneClass}>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="font-data text-2xl font-bold mt-1">{value}</p>
            {subtext ? <p className="text-xs text-muted-foreground mt-2">{subtext}</p> : null}
          </div>
          <Icon className={`h-8 w-8 shrink-0 ${iconClass}`} />
        </div>
      </CardContent>
    </Card>
  );
}

function TaskRow({
  name,
  rightTop,
  rightBottom,
  leftBottom,
  tone = 'default',
}) {
  const borderClass =
    tone === 'danger'
      ? 'border-l-4 border-l-red-500'
      : tone === 'warning'
        ? 'border-l-4 border-l-amber-500'
        : tone === 'success'
          ? 'border-l-4 border-l-green-500'
          : 'border-l-4 border-l-blue-500';

  return (
    <div className={`rounded-lg border bg-card p-3 ${borderClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium leading-tight">{name || 'Unnamed task'}</p>
          {leftBottom ? <p className="text-xs text-muted-foreground mt-1">{leftBottom}</p> : null}
        </div>
        <div className="text-right shrink-0">
          {rightTop ? <p className="text-sm font-semibold">{rightTop}</p> : null}
          {rightBottom ? <p className="text-xs text-muted-foreground mt-1">{rightBottom}</p> : null}
        </div>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState('');
  const [job, setJob] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [analysis, setAnalysis] = useState(null);
  const [loadingJobs, setLoadingJobs] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const response = await api.get('/jobs');
      const nextJobs = response.data || [];
      setJobs(nextJobs);

      if (!selectedJob && nextJobs.length > 0) {
        setSelectedJob(getItemId(nextJobs[0]));
      }
    } catch (error) {
      console.error('Failed to load jobs:', error);
      toast.error('Failed to load jobs');
    } finally {
      setLoadingJobs(false);
    }
  }, [selectedJob]);

  const fetchJobDetail = useCallback(async () => {
    if (!selectedJob) {
      setJob(null);
      setTasks([]);
      setAnalysis(null);
      setLoadingDetail(false);
      return;
    }

    setLoadingDetail(true);

    try {
      const [jobRes, tasksRes, analysisRes] = await Promise.allSettled([
        api.get(`/jobs/${selectedJob}`),
        api.get(`/tasks?job_id=${selectedJob}`),
        api.get(`/jobs/${selectedJob}/resource-analysis`),
      ]);

      if (jobRes.status === 'fulfilled') {
        setJob(jobRes.value.data || null);
      } else {
        setJob(null);
      }

      if (tasksRes.status === 'fulfilled') {
        setTasks(tasksRes.value.data || []);
      } else {
        setTasks([]);
      }

      if (analysisRes.status === 'fulfilled') {
        setAnalysis(analysisRes.value.data || null);
      } else {
        setAnalysis(null);
      }

      if (jobRes.status !== 'fulfilled' || tasksRes.status !== 'fulfilled') {
        toast.error('Prestart review loaded with some missing data');
      }
    } catch (error) {
      console.error('Failed to load prestart review:', error);
      toast.error('Failed to load prestart review');
      setJob(null);
      setTasks([]);
      setAnalysis(null);
    } finally {
      setLoadingDetail(false);
    }
  }, [selectedJob]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    if (selectedJob) {
      fetchJobDetail();
    }
  }, [selectedJob, fetchJobDetail]);

  const totalTasks = tasks.length;
  const startedTasks = tasks.filter(hasStartedTask);
  const completedTasks = tasks.filter(isCompleteTask);
  const blockedTasks = tasks.filter(isBlockedTask);
  const notStartedTasks = tasks.filter((task) => !hasStartedTask(task) && !isCompleteTask(task));

  const totalQuoted = tasks.reduce((sum, task) => sum + numberValue(task.quoted_hours), 0);
  const totalActual = tasks.reduce((sum, task) => sum + numberValue(task.actual_hours), 0);
  const totalVariance = totalActual - totalQuoted;

  const overallocatedCount =
    analysis?.summary?.tasks_overallocated ??
    (analysis?.tasks || []).filter(
      (row) => numberValue(row.extra_crew_needed_standard) > 0 || row.programme_feasible === false
    ).length;

  const maxRecoveryCrew =
    analysis?.summary?.max_required_crew_standard ??
    Math.max(
      0,
      ...(analysis?.tasks || []).map((row) =>
        numberValue(row.recommended_recovery_crew || row.required_crew_standard)
      )
    );

  const tasksById = Object.fromEntries(tasks.map((task) => [getItemId(task), task]));

  const keyPressureTasks = ((analysis?.tasks || []).length > 0
    ? (analysis?.tasks || [])
        .map((row) => {
          const linkedTask = tasksById[getItemId(row)] || tasksById[row.task_id] || {};
          return {
            id: row.task_id || row.id || getItemId(linkedTask),
            name: row.task_name || linkedTask.name || 'Unnamed task',
            planned_start: linkedTask.planned_start || row.planned_start,
            planned_finish: linkedTask.planned_finish || row.planned_finish,
            status: linkedTask.status || row.status || 'planned',
            percent_complete: numberValue(linkedTask.percent_complete || row.percent_complete),
            extra_crew_needed_standard: numberValue(row.extra_crew_needed_standard),
            duration_gap_days_at_standard_crew: numberValue(row.duration_gap_days_at_standard_crew),
            recommended_recovery_crew: numberValue(row.recommended_recovery_crew || row.required_crew_standard),
            programme_feasible: row.programme_feasible,
            requires_saturday: row.requires_saturday,
            is_blocked: linkedTask.is_blocked || row.is_blocked,
          };
        })
        .filter((task) => !isCompleteTask(task))
        .sort((a, b) => {
          const scoreA =
            (a.programme_feasible === false ? 1000 : 0) +
            (a.is_blocked ? 300 : 0) +
            (a.extra_crew_needed_standard * 100) +
            (a.duration_gap_days_at_standard_crew * 10) +
            (a.requires_saturday ? 20 : 0);

          const scoreB =
            (b.programme_feasible === false ? 1000 : 0) +
            (b.is_blocked ? 300 : 0) +
            (b.extra_crew_needed_standard * 100) +
            (b.duration_gap_days_at_standard_crew * 10) +
            (b.requires_saturday ? 20 : 0);

          return scoreB - scoreA;
        })
        .slice(0, 6)
    : tasks
        .filter((task) => !isCompleteTask(task))
        .sort((a, b) => numberValue(b.quoted_hours) - numberValue(a.quoted_hours))
        .slice(0, 6)
        .map((task) => ({
          id: getItemId(task),
          name: task.name,
          planned_start: task.planned_start,
          planned_finish: task.planned_finish,
          status: task.status,
          percent_complete: numberValue(task.percent_complete),
          extra_crew_needed_standard: 0,
          duration_gap_days_at_standard_crew: 0,
          recommended_recovery_crew: 0,
          programme_feasible: true,
          requires_saturday: false,
          is_blocked: isBlockedTask(task),
        })));

  const livePositionTasks = startedTasks
    .slice()
    .sort((a, b) => {
      const progressDiff = numberValue(b.percent_complete) - numberValue(a.percent_complete);
      if (progressDiff !== 0) return progressDiff;
      return numberValue(b.actual_hours) - numberValue(a.actual_hours);
    })
    .slice(0, 8);

  const nextToStartTasks = notStartedTasks
    .slice()
    .sort((a, b) => {
      const dateA = a.planned_start ? new Date(a.planned_start).getTime() : Number.MAX_SAFE_INTEGER;
      const dateB = b.planned_start ? new Date(b.planned_start).getTime() : Number.MAX_SAFE_INTEGER;
      return dateA - dateB;
    })
    .slice(0, 6);

  const loading = loadingJobs || loadingDetail;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="reports-page">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Prestart Review</h1>
          <p className="text-muted-foreground mt-1">
            Meeting-ready job position, pressure points, and quick links
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Select value={selectedJob} onValueChange={setSelectedJob}>
            <SelectTrigger className="w-full sm:w-[320px]" data-testid="job-filter">
              <SelectValue placeholder="Select job" />
            </SelectTrigger>
            <SelectContent>
              {jobs.map((jobItem) => {
                const value = getItemId(jobItem);
                return (
                  <SelectItem key={value} value={value}>
                    {jobItem.job_number} - {jobItem.job_name}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>

          {selectedJob ? (
            <>
              <Link to={`/jobs/${selectedJob}`}>
                <Button variant="outline" className="w-full sm:w-auto">
                  Job Detail
                </Button>
              </Link>
              <Link to={`/jobs/${selectedJob}/gantt`}>
                <Button variant="outline" className="w-full sm:w-auto">
                  Gantt
                </Button>
              </Link>
              <Link to={`/resource-analysis/${selectedJob}`}>
                <Button className="w-full sm:w-auto">
                  Resource Analysis
                </Button>
              </Link>
            </>
          ) : null}
        </div>
      </div>

      {!selectedJob ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Select a job to open the prestart review.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-xl">
                {(job?.job_number || 'Job')} {job?.job_name ? `— ${job.job_name}` : ''}
              </CardTitle>
              <CardDescription>
                Contractor: {getContractorName(job)}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Planned Start</p>
                  <p className="font-medium mt-1">{formatDate(job?.planned_start)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Planned Finish</p>
                  <p className="font-medium mt-1">{formatDate(job?.planned_finish)}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Live Tasks</p>
                  <p className="font-medium mt-1">{startedTasks.length}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Completed Tasks</p>
                  <p className="font-medium mt-1">{completedTasks.length}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Blocked Tasks</p>
                  <p className="font-medium mt-1">{blockedTasks.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
            <MetricCard
              title="Started Tasks"
              value={startedTasks.length}
              subtext="Tasks with actual start, hours, or progress"
              icon={PlayCircle}
              tone="success"
            />
            <MetricCard
              title="Completed Tasks"
              value={completedTasks.length}
              subtext={`${totalTasks} total tasks`}
              icon={CheckCircle2}
              tone="success"
            />
            <MetricCard
              title="Blocked Tasks"
              value={blockedTasks.length}
              subtext="Items needing follow-up"
              icon={AlertTriangle}
              tone={blockedTasks.length > 0 ? 'danger' : 'default'}
            />
            <MetricCard
              title="Not Started"
              value={notStartedTasks.length}
              subtext="Still to open"
              icon={Clock3}
              tone="warning"
            />
            <MetricCard
              title="Overallocated"
              value={overallocatedCount}
              subtext="From current resource analysis"
              icon={ShieldAlert}
              tone={overallocatedCount > 0 ? 'danger' : 'default'}
            />
            <MetricCard
              title="Max Recovery Crew"
              value={maxRecoveryCrew}
              subtext="Peak crew ask on current plan"
              icon={Briefcase}
              tone="warning"
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Actual vs Quoted</CardTitle>
                <CardDescription>Current effort against quoted task hours</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Quoted Total</p>
                    <p className="text-2xl font-bold font-data mt-1">{formatHours(totalQuoted)}</p>
                  </div>
                  <Clock3 className="h-8 w-8 text-muted-foreground/60" />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Actual Total</p>
                    <p className="text-2xl font-bold font-data mt-1">{formatHours(totalActual)}</p>
                  </div>
                  <BarChart3 className="h-8 w-8 text-muted-foreground/60" />
                </div>

                <div className={`rounded-lg border p-3 ${totalVariance > 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
                  <p className="text-sm text-muted-foreground">Variance</p>
                  <p className={`text-2xl font-bold font-data mt-1 ${totalVariance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {totalVariance > 0 ? '+' : ''}{formatHours(totalVariance)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {totalVariance > 0 ? 'Running above quoted hours' : 'Within or under quoted hours'}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="xl:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Key Pressure Tasks</CardTitle>
                <CardDescription>Best talking points for recovery, access, and sequencing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {keyPressureTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No pressure tasks found yet.</p>
                ) : (
                  keyPressureTasks.map((task) => (
                    <TaskRow
                      key={task.id || task.name}
                      name={task.name}
                      tone={
                        task.programme_feasible === false || task.is_blocked
                          ? 'danger'
                          : task.extra_crew_needed_standard > 0
                            ? 'warning'
                            : 'default'
                      }
                      rightTop={
                        task.extra_crew_needed_standard > 0
                          ? `+${task.extra_crew_needed_standard.toFixed(1)} crew`
                          : task.programme_feasible === false
                            ? 'Not feasible'
                            : `${task.percent_complete.toFixed(0)}%`
                      }
                      rightBottom={
                        task.recommended_recovery_crew > 0
                          ? `Rec ${task.recommended_recovery_crew.toFixed(1)} crew`
                          : task.requires_saturday
                            ? 'Saturday needed'
                            : task.status || 'planned'
                      }
                      leftBottom={`Plan ${formatDate(task.planned_start)} → ${formatDate(task.planned_finish)}`}
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Current Site Position</CardTitle>
                <CardDescription>Tasks already carrying live reality data</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {livePositionTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No actuals entered yet.</p>
                ) : (
                  livePositionTasks.map((task) => (
                    <TaskRow
                      key={getItemId(task) || task.name}
                      name={task.name}
                      tone={isCompleteTask(task) ? 'success' : 'default'}
                      rightTop={`${numberValue(task.percent_complete).toFixed(0)}%`}
                      rightBottom={formatHours(task.actual_hours)}
                      leftBottom={`Actual start ${formatDate(task.actual_start)} • Quoted ${formatHours(task.quoted_hours)}`}
                    />
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Next / Blocked Review</CardTitle>
                <CardDescription>What to open next and what needs clearing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {blockedTasks.slice(0, 3).map((task) => (
                  <TaskRow
                    key={`blocked-${getItemId(task) || task.name}`}
                    name={task.name}
                    tone="danger"
                    rightTop="Blocked"
                    rightBottom={task.status || 'blocked'}
                    leftBottom={`Plan ${formatDate(task.planned_start)} → ${formatDate(task.planned_finish)}`}
                  />
                ))}

                {nextToStartTasks.slice(0, 3).map((task) => (
                  <TaskRow
                    key={`next-${getItemId(task) || task.name}`}
                    name={task.name}
                    tone="warning"
                    rightTop="Not started"
                    rightBottom={formatHours(task.quoted_hours)}
                    leftBottom={`Planned start ${formatDate(task.planned_start)}`}
                  />
                ))}

                {blockedTasks.length === 0 && nextToStartTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No blocked or next-up tasks found yet.</p>
                ) : null}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Meeting Flow</CardTitle>
              <CardDescription>Clean order for the Wednesday prestart review</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">1</p>
                  <p className="font-semibold mt-1">Open here</p>
                  <p className="text-sm text-muted-foreground mt-2">Use this page for the quick current-position summary.</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">2</p>
                  <p className="font-semibold mt-1">Go to Gantt</p>
                  <p className="text-sm text-muted-foreground mt-2">Show the programme picture and talk sequencing.</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">3</p>
                  <p className="font-semibold mt-1">Go to Resource Analysis</p>
                  <p className="text-sm text-muted-foreground mt-2">Use it as evidence where the plan is overloaded.</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">4</p>
                  <p className="font-semibold mt-1">Back to Job Detail</p>
                  <p className="text-sm text-muted-foreground mt-2">Update live task actuals after the meeting decisions.</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link to={`/jobs/${selectedJob}`}>
                  <Button variant="outline">
                    Job Detail
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to={`/jobs/${selectedJob}/gantt`}>
                  <Button variant="outline">
                    Gantt
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to={`/resource-analysis/${selectedJob}`}>
                  <Button>
                    Resource Analysis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

