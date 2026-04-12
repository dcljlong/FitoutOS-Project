import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ArrowLeft } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import { toast } from "sonner";

const formatHours = (value) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return `${num.toFixed(2)}h`;
};

const formatNumber = (value, digits = 1) => {
  if (value === null || value === undefined || value === "") return "-";
  const num = Number(value);
  if (Number.isNaN(num)) return "-";
  return num.toFixed(digits);
};

const formatShortDate = (value) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-NZ", { day: "2-digit", month: "short" });
};

const formatDateRange = (start, finish) => {
  if (!start && !finish) return "-";
  if (start && finish && start === finish) return formatShortDate(start);
  return `${formatShortDate(start)} → ${formatShortDate(finish)}`;
};

const formatRecoveryStrategy = (value) => {
  switch ((value || "").toUpperCase()) {
    case "KEEP_CURRENT_DATES":
      return "Keep current dates";
    case "USE_SATURDAY":
      return "Use Saturday";
    case "ADD_CREW_OR_EXTEND_DATES":
      return "Add crew or extend dates";
    default:
      return value || "-";
  }
};

const statusClass = (status) => {
  switch ((status || "").toUpperCase()) {
    case "ON_TRACK":
      return "bg-green-100 text-green-800 border border-green-200";
    case "SATURDAY_REQUIRED":
    case "OVERTIME_REQUIRED":
      return "bg-blue-100 text-blue-800 border border-blue-200";
    case "OVERCREW":
      return "bg-amber-100 text-amber-800 border border-amber-200";
    case "OVERALLOCATED":
      return "bg-red-100 text-red-800 border border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border border-slate-200";
  }
};

export default function ResourceAnalysisPage() {
  const { jobId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timelinePayload, setTimelinePayload] = useState(null);
  const [analysisPayload, setAnalysisPayload] = useState(null);
  const [errorState, setErrorState] = useState(null);

  useEffect(() => {
    const loadAnalysis = async () => {
      if (!jobId) {
        setErrorState("missing-job-id");
        setTimelinePayload(null);
        setAnalysisPayload(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorState(null);

      try {
        const [timelineRes, analysisRes] = await Promise.all([
          api.get(`/jobs/${jobId}/resource-load-timeline`),
          api.get(`/jobs/${jobId}/resource-analysis`),
        ]);

        setTimelinePayload(timelineRes.data || null);
        setAnalysisPayload(analysisRes.data || null);
      } catch (error) {
        console.error(error);

        if (error.response?.status === 404) {
          setErrorState("not-found");
        } else if (error.response?.status === 400) {
          setErrorState("invalid-job");
        } else {
          setErrorState("load-failed");
          toast.error("Failed to load resource analysis");
        }

        setTimelinePayload(null);
        setAnalysisPayload(null);
      } finally {
        setLoading(false);
      }
    };

    loadAnalysis();
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (errorState === "missing-job-id" || errorState === "invalid-job") {
    return (
      <div className="space-y-6" data-testid="resource-analysis-page">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold font-['Manrope']">Resource Analysis</h1>
            <p className="text-muted-foreground mt-1">A valid job is required.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/jobs")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Invalid Job</CardTitle>
            <CardDescription>The job link is missing or invalid.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (errorState === "not-found") {
    return (
      <div className="space-y-6" data-testid="resource-analysis-page">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold font-['Manrope']">Resource Analysis</h1>
            <p className="text-muted-foreground mt-1">Job not found.</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/jobs")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Jobs
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Job Not Found</CardTitle>
            <CardDescription>The selected job does not exist or has been removed.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (errorState === "load-failed" || !timelinePayload || !analysisPayload) {
    return (
      <div className="space-y-6" data-testid="resource-analysis-page">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold font-['Manrope']">Resource Analysis</h1>
            <p className="text-muted-foreground mt-1">Daily labour load timeline</p>
          </div>
          <div className="flex gap-2">
            <Link to="/jobs">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Jobs
              </Button>
            </Link>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No Data</CardTitle>
            <CardDescription>No resource analysis data available for this job.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const summary = timelinePayload.summary || {};
  const timeline = timelinePayload.timeline || [];
  const analysisSummary = analysisPayload.summary || {};
  const hasNoTimeline = timeline.length === 0;

  const chartData = timeline.map((row) => ({
    ...row,
    shortDate: formatShortDate(row.date),
  }));

  const taskRows = [...(analysisPayload.tasks || [])].sort((a, b) => {
    const aGap = Number(a.duration_gap_days_at_standard_crew ?? -1);
    const bGap = Number(b.duration_gap_days_at_standard_crew ?? -1);

    if (bGap !== aGap) {
      return bGap - aGap;
    }

    const aCrew = Number(a.required_crew_standard || 0);
    const bCrew = Number(b.required_crew_standard || 0);
    return bCrew - aCrew;
  });

  if (hasNoTimeline) {
    return (
      <div className="space-y-6" data-testid="resource-analysis-page">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-3xl font-bold font-['Manrope']">Resource Analysis</h1>
            <p className="text-muted-foreground mt-1">
              {timelinePayload.job_number} - {timelinePayload.job_name}
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/jobs">
              <Button variant="outline">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Jobs
              </Button>
            </Link>
            <Link to={`/jobs/${jobId}`}>
              <Button variant="outline">Open Job</Button>
            </Link>
            <Link to={`/jobs/${jobId}/setup`}>
              <Button>Upload & Analyze</Button>
            </Link>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">No daily timeline yet</CardTitle>
            <CardDescription>
              This job has no dated task window with quoted hours, so the daily load graph cannot be calculated.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const peakCrewRequired = timeline.reduce((max, row) => {
    const value = Number(row.crew_required || 0);
    return value > max ? value : max;
  }, 0);

  const peakCrewCapacity = timeline.reduce((max, row) => {
    const value = Number(row.crew_capacity || 0);
    return value > max ? value : max;
  }, 0);

  const totalCrewOver = timeline.reduce((sum, row) => {
    return sum + Number(row.crew_over || 0);
  }, 0);

  const overallStatus = analysisSummary.overall_status || (
    totalCrewOver > 0
      ? "OVERCREW"
      : summary.total_overload_hours > 0
        ? "OVERALLOCATED"
        : "ON_TRACK"
  );

  return (
    <div className="space-y-6" data-testid="resource-analysis-page">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Resource Analysis</h1>
          <p className="text-muted-foreground mt-1">
            {timelinePayload.job_number} - {timelinePayload.job_name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/jobs">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Jobs
            </Button>
          </Link>
          <div className={`inline-flex w-fit items-center rounded-md px-3 py-1.5 text-sm font-semibold ${statusClass(overallStatus)}`}>
            {overallStatus}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Working Days (5-day week)</p>
            <p className="text-2xl font-bold">{summary.days ?? "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Required Hours</p>
            <p className="text-2xl font-bold">{formatHours(summary.total_required_hours)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Available Hours</p>
            <p className="text-2xl font-bold">{formatHours(summary.total_available_hours)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Overload Hours</p>
            <p className="text-2xl font-bold">{formatHours(summary.total_overload_hours)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Crew Over</p>
            <p className="text-2xl font-bold">{formatNumber(totalCrewOver, 2)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Standard Crew</p>
            <p className="text-2xl font-bold">{formatNumber(analysisSummary.standard_crew, 1)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Tasks Overallocated</p>
            <p className="text-2xl font-bold">{analysisSummary.tasks_overallocated ?? "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Saturday Required Tasks</p>
            <p className="text-2xl font-bold">{analysisSummary.tasks_requiring_saturday ?? "-"}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Max Crew Needed</p>
            <p className="text-2xl font-bold">{formatNumber(analysisSummary.max_required_crew_standard, 2)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Max Extra Crew</p>
            <p className="text-2xl font-bold">{formatNumber(analysisSummary.max_extra_crew_standard, 2)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Crew Capacity</CardTitle>
            <CardDescription>Highest crew limit returned in this timeline</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Peak Capacity</span>
              <span className="font-semibold">{formatNumber(peakCrewCapacity, 2)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Peak Required</span>
              <span className="font-semibold">{formatNumber(peakCrewRequired, 2)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recovery Summary</CardTitle>
            <CardDescription>Programme pressure based on quoted hours and dated window</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Approved Scope Hours</span>
              <span className="font-semibold">{formatHours(analysisSummary.total_approved_scope_hours)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Available Hours</span>
              <span className="font-semibold">{formatHours(analysisSummary.total_available_hours_standard)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Available + Saturday</span>
              <span className="font-semibold">{formatHours(analysisSummary.total_available_hours_with_saturday)}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Capacity Rule</CardTitle>
            <CardDescription>Interpretation of labour and crew constraints</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>OVERALLOCATED = required hours exceed available hours.</p>
            <p>SATURDAY_REQUIRED = current dates only work with Saturday backup.</p>
            <p>Recommended recovery crew is the rounded crew needed to hold the current dates.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Load Graph</CardTitle>
          <CardDescription>
            Required hours against available hours by working day
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
            <div className="rounded-lg border p-3">
              Bars compare required vs available labour by date
            </div>
            <div className="rounded-lg border p-3">
              Overload = required hours above available hours
            </div>
            <div className="rounded-lg border p-3">
              Crew capacity and crew over are listed below
            </div>
          </div>

          <div className="h-[260px] w-full max-w-[1100px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 24 }} barCategoryGap="35%">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="shortDate" />
                <YAxis />
                <Tooltip
                  formatter={(value, name) => {
                    if (name === "hours_required") return [`${Number(value).toFixed(2)}h`, "Required"];
                    if (name === "hours_available") return [`${Number(value).toFixed(2)}h`, "Available"];
                    if (name === "overload_hours") return [`${Number(value).toFixed(2)}h`, "Overload"];
                    return [value, name];
                  }}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    return row ? `${label} | ${row.status} | ${row.task_count} tasks` : label;
                  }}
                />
                <ReferenceLine y={0} />
                <Bar dataKey="hours_available" name="hours_available" radius={[4, 4, 0, 0]} maxBarSize={48} />
                <Bar dataKey="hours_required" name="hours_required" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Daily Load Table</CardTitle>
          <CardDescription>Calculated day-by-day labour demand and overload</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th className="text-right">Required</th>
                  <th className="text-right">Available</th>
                  <th className="text-right">Overload</th>
                  <th className="text-right">Crew Req</th>
                  <th className="text-right">Crew Cap</th>
                  <th className="text-right">Crew Over</th>
                  <th className="text-right">OT Allowed</th>
                  <th className="text-right">OT Req</th>
                  <th className="text-right">Tasks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((row) => (
                  <tr key={row.date}>
                    <td>{formatShortDate(row.date)}</td>
                    <td className="text-right">{formatHours(row.hours_required)}</td>
                    <td className="text-right">{formatHours(row.hours_available)}</td>
                    <td className="text-right">{formatHours(row.overload_hours)}</td>
                    <td className="text-right">{formatNumber(row.crew_required, 2)}</td>
                    <td className="text-right">{formatNumber(row.crew_capacity, 2)}</td>
                    <td className="text-right">{formatNumber(row.crew_over, 2)}</td>
                    <td className="text-right">{row.overtime_allowed ? "Yes" : "No"}</td>
                    <td className="text-right">{row.overtime_required ? "Yes" : "No"}</td>
                    <td className="text-right">{row.task_count ?? "-"}</td>
                    <td>
                      <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${statusClass(row.status)}`}>
                        {row.status ?? "-"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Task Recovery Analysis</CardTitle>
          <CardDescription>
            Recovery pressure by task based on quoted hours, current dates, and standard crew
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Window</th>
                  <th className="text-right">Quoted</th>
                  <th className="text-right">Std Days</th>
                  <th className="text-right">Crew Req</th>
                  <th className="text-right">Crew Req + Sat</th>
                  <th className="text-right">Days @ Std Crew</th>
                  <th className="text-right">Gap</th>
                  <th className="text-right">Extra Crew</th>
                  <th className="text-right">Recovery Crew</th>
                  <th>Recovery</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {taskRows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center text-muted-foreground py-6">
                      No task recovery data available.
                    </td>
                  </tr>
                ) : (
                  taskRows.map((row) => (
                    <tr key={row.task_id}>
                      <td className="font-medium">{row.task_name || "-"}</td>
                      <td>{formatDateRange(row.planned_start, row.planned_finish)}</td>
                      <td className="text-right">{formatHours(row.quoted_hours)}</td>
                      <td className="text-right">{formatNumber(row.available_days_standard, 0)}</td>
                      <td className="text-right">{formatNumber(row.required_crew_standard, 2)}</td>
                      <td className="text-right">{formatNumber(row.required_crew_with_saturday, 2)}</td>
                      <td className="text-right">{formatNumber(row.duration_days_at_standard_crew, 0)}</td>
                      <td className="text-right">{formatNumber(row.duration_gap_days_at_standard_crew, 0)}</td>
                      <td className="text-right">{formatNumber(row.extra_crew_needed_standard, 2)}</td>
                      <td className="text-right">{formatNumber(row.recommended_recovery_crew, 1)}</td>
                      <td>{formatRecoveryStrategy(row.recovery_strategy)}</td>
                      <td>
                        <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold ${statusClass(row.programme_feasible)}`}>
                          {row.programme_feasible || "-"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}


