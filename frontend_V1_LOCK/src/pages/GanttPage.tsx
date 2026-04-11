import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "@/lib/api";

type TaskItem = {
  id: string;
  task_name?: string;
  task_type?: string;
  early_start?: number;
  early_finish?: number;
  total_float?: number;
  is_critical?: boolean;
  planned_start?: string;
  planned_finish?: string;
};

function formatDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString();
}

function addDays(base: Date, days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function formatShortHeaderDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short"
  });
}

export default function GanttPage() {
  const { job_id } = useParams();
  const navigate = useNavigate();

  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [hoveredTask, setHoveredTask] = useState<string | null>(null);
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState("All");

  useEffect(() => {
    async function load() {
      if (!job_id) {
        setTasks([]);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const [jobRes, tasksRes] = await Promise.all([
          api.get(`/jobs/${job_id}`),
          api.get(`/tasks?job_id=${job_id}`)
        ]);

        setJob(jobRes.data || null);

        const incoming = Array.isArray(tasksRes.data) ? tasksRes.data : [];

        const cleaned = incoming
          .filter((t: TaskItem) => t && t.id)
          .sort((a: TaskItem, b: TaskItem) => {
            const aStart = a.early_start ?? 0;
            const bStart = b.early_start ?? 0;
            if (aStart !== bStart) return aStart - bStart;

            const aFinish = a.early_finish ?? 0;
            const bFinish = b.early_finish ?? 0;
            return aFinish - bFinish;
          });

        setTasks(cleaned);
      } catch (e) {
        console.error(e);
        setJob(null);
        setTasks([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [job_id]);

  const maxFinish = useMemo(() => {
    if (!tasks.length) return 1;
    return Math.max(...tasks.map((t) => t.early_finish ?? 0), 1);
  }, [tasks]);

  const summary = useMemo(() => {
    const criticalCount = tasks.filter((t) => t.is_critical).length;
    return {
      total: tasks.length,
      critical: criticalCount,
      nonCritical: tasks.length - criticalCount,
      finishDay: maxFinish
    };
  }, [tasks, maxFinish]);

  const taskTypes = useMemo(() => {
    const values = Array.from(
      new Set(
        tasks
          .map((t) => (t.task_type || "").trim())
          .filter((value) => value.length > 0)
      )
    ).sort((a, b) => a.localeCompare(b));

    return ["All", ...values];
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (criticalOnly && !t.is_critical) return false;
      if (typeFilter !== "All" && (t.task_type || "Task") !== typeFilter) return false;
      return true;
    });
  }, [tasks, criticalOnly, typeFilter]);

  const filteredSummary = useMemo(() => {
    const criticalCount = filteredTasks.filter((t) => t.is_critical).length;
    return {
      total: filteredTasks.length,
      critical: criticalCount,
      nonCritical: filteredTasks.length - criticalCount
    };
  }, [filteredTasks]);

  const calendarHeader = useMemo(() => {
    const totalDays = Math.min(maxFinish + 1, 50);
    const baseDate = job?.planned_start ? new Date(job.planned_start) : null;
    const weekdayNames = ["S", "M", "T", "W", "T", "F", "S"];

    return Array.from({ length: totalDays }).map((_, i) => {
      const current = baseDate && !Number.isNaN(baseDate.getTime())
        ? addDays(baseDate, i)
        : null;

      return {
        dayOffset: i,
        weekday: current ? weekdayNames[current.getDay()] : weekdayNames[i % 7],
        dateLabel: current ? formatShortHeaderDate(current) : `Day ${i}`,
        isWeekStart: current ? current.getDay() === 1 : i % 7 === 0
      };
    });
  }, [job, maxFinish]);

  if (loading) {
    return <div className="p-6">Loading Gantt...</div>;
  }

  if (!job_id) {
    return <div className="p-6">No job selected.</div>;
  }

  if (!tasks.length) {
    return <div className="p-6">No tasks found for this job.</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-3">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Project Gantt</div>
          <div className="text-sm text-slate-500">
            Job-scoped CPM programme view
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Total Tasks</div>
            <div className="mt-1 text-2xl font-semibold">{summary.total}</div>
          </div>

          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Critical Tasks</div>
            <div className="mt-1 text-2xl font-semibold text-red-600">{summary.critical}</div>
          </div>

          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Non-Critical</div>
            <div className="mt-1 text-2xl font-semibold text-blue-600">{summary.nonCritical}</div>
          </div>

          <div className="rounded-lg border bg-white p-3 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-slate-500">Programme Finish</div>
            <div className="mt-1 text-2xl font-semibold">Day {summary.finishDay}</div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-3 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  Task Type
                </span>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400"
                >
                  {taskTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={criticalOnly}
                  onChange={(e) => setCriticalOnly(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Critical only
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full bg-slate-100 px-3 py-1.5 font-medium text-slate-600">
                Showing {filteredSummary.total} of {summary.total}
              </span>
              <span className="rounded-full bg-red-100 px-3 py-1.5 font-medium text-red-700">
                Critical {filteredSummary.critical}
              </span>
              <span className="rounded-full bg-blue-100 px-3 py-1.5 font-medium text-blue-700">
                Non-critical {filteredSummary.nonCritical}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white shadow-sm">
        <div className="min-w-[1100px]">
          <div className="grid grid-cols-[320px_110px_110px_140px_1fr] gap-4 border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-600">
            <div className="sticky left-0 z-30 flex items-center bg-slate-100">Task</div>
            <div className="sticky left-[320px] z-30 flex items-center bg-slate-100">Start</div>
            <div className="sticky left-[430px] z-30 flex items-center bg-slate-100">Finish</div>
            <div className="sticky left-[540px] z-30 flex items-center bg-slate-100">Status</div>
            <div className="flex items-center justify-between">
              <span>Timeline</span>
              <span className="text-[10px] font-medium tracking-[0.12em] text-slate-400">
                DAYS
              </span>
            </div>
          </div>

          <div className="grid grid-cols-[320px_110px_110px_140px_1fr] gap-4 border-b border-slate-200 bg-white px-4 py-0">
            <div className="sticky left-0 z-20 border-r border-slate-100 bg-white"></div>
            <div className="sticky left-[320px] z-20 border-r border-slate-100 bg-white"></div>
            <div className="sticky left-[430px] z-20 border-r border-slate-100 bg-white"></div>
            <div className="sticky left-[540px] z-20 bg-white"></div>

            <div className="relative h-[64px] border-l border-slate-200 bg-slate-50/50">
              <div className="absolute inset-x-0 top-0 h-7 border-b border-slate-200 bg-slate-50">
                {calendarHeader.map((item) => {
                  const left = (item.dayOffset / maxFinish) * 100;
                  return (
                    <div
                      key={`weekday-${item.dayOffset}`}
                      className="absolute top-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400"
                      style={{ left: `${left}%`, transform: "translateX(-50%)" }}
                    >
                      {item.weekday}
                    </div>
                  );
                })}
              </div>

              <div className="absolute inset-x-0 top-7 h-9 bg-white">
                {calendarHeader
                  .filter((item) => item.isWeekStart)
                  .map((item) => {
                    const left = (item.dayOffset / maxFinish) * 100;
                    return (
                      <div
                        key={`week-${item.dayOffset}`}
                        className="absolute top-2 text-[11px] font-semibold text-slate-700"
                        style={{ left: `${left}%`, transform: "translateX(-50%)" }}
                      >
                        {item.dateLabel}
                      </div>
                    );
                  })}

                {calendarHeader
                  .filter((item) => item.isWeekStart)
                  .map((item) => {
                    const left = (item.dayOffset / maxFinish) * 100;
                    return (
                      <div
                        key={`header-grid-${item.dayOffset}`}
                        className="absolute top-0 h-9 w-px bg-slate-200"
                        style={{ left: `${left}%` }}
                      />
                    );
                  })}

                {(() => {
                  if (!job?.planned_start) return null;

                  const start = new Date(job.planned_start);
                  if (Number.isNaN(start.getTime())) return null;

                  const today = new Date();
                  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));

                  if (diff < 0 || diff > maxFinish) return null;

                  const left = (diff / maxFinish) * 100;

                  return (
                    <>
                      <div
                        className="absolute top-0 h-9 w-0.5 bg-orange-500"
                        style={{ left: `${left}%` }}
                      />
                      <div
                        className="absolute top-2 text-[10px] font-semibold uppercase tracking-wide text-orange-600"
                        style={{ left: `${left}%`, transform: "translateX(-50%)" }}
                      >
                        Today
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {!filteredTasks.length ? (
            <div className="px-4 py-8 text-sm text-slate-500">
              No tasks match the current filters.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTasks.map((t) => {
                const start = t.early_start ?? 0;
                const finish = t.early_finish ?? 0;
                const duration = Math.max(finish - start, 1);
                const totalFloat = t.total_float ?? 0;

                const left = (start / maxFinish) * 100;
                const width = (duration / maxFinish) * 100;

                const isHovered = hoveredTask === t.id;

                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => navigate(`/tasks/${t.id}`)}
                    className="grid w-full grid-cols-[320px_110px_110px_140px_1fr] gap-4 px-4 py-3 text-left transition hover:bg-slate-50"
                  >
                    <div className="min-w-0 sticky left-0 z-10 bg-white pr-2">
                      <div className="truncate text-[13px] font-medium text-slate-900">
                        {t.task_name || "Untitled task"}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {t.task_type || "Task"} • {formatDate(t.planned_start)} → {formatDate(t.planned_finish)}
                      </div>
                    </div>

                    <div className="sticky left-[320px] z-10 bg-white text-[13px] text-slate-700">
                      Day {start}
                    </div>

                    <div className="sticky left-[430px] z-10 bg-white text-[13px] text-slate-700">
                      Day {finish}
                    </div>

                    <div className="sticky left-[540px] z-10 bg-white text-[13px]">
                      {t.is_critical ? (
                        <span className="inline-flex rounded-full bg-red-100 px-2 py-1 text-[11px] font-semibold text-red-700">
                          Critical
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-[11px] font-semibold text-blue-700">
                          Float {totalFloat}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center">
                      <div className="relative h-7 w-full rounded-md bg-slate-100">
                        {calendarHeader
                          .filter((d) => d.isWeekStart)
                          .map((d) => {
                            const gridLeft = (d.dayOffset / maxFinish) * 100;
                            return (
                              <div
                                key={`grid-${d.dayOffset}`}
                                className="absolute top-0 h-7 w-px bg-slate-300"
                                style={{ left: `${gridLeft}%` }}
                              />
                            );
                          })}

                        {(() => {
                          if (!job?.planned_start) return null;

                          const startDate = new Date(job.planned_start);
                          if (Number.isNaN(startDate.getTime())) return null;

                          const today = new Date();
                          const diff = Math.floor((today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

                          if (diff < 0 || diff > maxFinish) return null;

                          const todayLeft = (diff / maxFinish) * 100;

                          return (
                            <div
                              className="absolute top-0 h-7 w-0.5 bg-orange-500"
                              style={{ left: `${todayLeft}%` }}
                              title="Today"
                            />
                          );
                        })()}

                        {Array.from({ length: Math.min(maxFinish + 1, 60) }).map((_, i) => {
                          const allowSaturday = !!job?.allow_saturday;
                          const isWeekend = allowSaturday ? (i % 7 === 6) : (i % 7 === 5 || i % 7 === 6);
                          if (!isWeekend) return null;

                          const weekendLeft = (i / maxFinish) * 100;

                          return (
                            <div
                              key={`weekend-${i}`}
                              className="absolute top-0 h-7 bg-slate-200/60"
                              style={{
                                left: `${weekendLeft}%`,
                                width: `${(1 / maxFinish) * 100}%`
                              }}
                            />
                          );
                        })}

                        <div
                          onMouseEnter={() => setHoveredTask(t.id)}
                          onMouseLeave={() => setHoveredTask(null)}
                          className={`absolute top-0 h-7 rounded-md transition-opacity ${
                            t.is_critical ? "bg-red-500" : "bg-blue-500"
                          } ${isHovered ? "opacity-90" : "opacity-100"}`}
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            minWidth: "8px"
                          }}
                        />

                        {isHovered && (
                          <div
                            className="absolute left-1/2 top-[-110px] z-50 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xl"
                            onMouseEnter={() => setHoveredTask(t.id)}
                            onMouseLeave={() => setHoveredTask(null)}
                          >
                            <div className="truncate font-semibold text-slate-900">
                              {t.task_name || "Untitled task"}
                            </div>

                            <div className="mt-1 text-slate-500">
                              {t.task_type || "Task"}
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-slate-600">
                              <div>Start</div>
                              <div className="text-right font-medium text-slate-900">Day {start}</div>

                              <div>Finish</div>
                              <div className="text-right font-medium text-slate-900">Day {finish}</div>

                              <div>Duration</div>
                              <div className="text-right font-medium text-slate-900">{duration}d</div>

                              <div>Status</div>
                              <div className="text-right font-medium text-slate-900">
                                {t.is_critical ? "Critical" : `Float ${totalFloat}`}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
