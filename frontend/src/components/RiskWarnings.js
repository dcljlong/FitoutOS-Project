import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  ClipboardList,
  ChevronRight,
  Loader2,
  XCircle,
  CheckCircle,
} from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';

export default function RiskWarnings({
  jobId,
  tasks = [],
  onTaskClick,
  compact = false,
}) {
  const [riskData, setRiskData] = useState(null);
  const [loading, setLoading] = useState(false);

  // Fetch risk analysis from API if jobId provided
  useEffect(() => {
    if (jobId) {
      fetchRiskAnalysis();
    } else if (tasks.length > 0) {
      analyzeTasksLocally();
    }
  }, [jobId, tasks]);

  const fetchRiskAnalysis = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/jobs/${jobId}/risk-analysis`);
      setRiskData(response.data);
    } catch (error) {
      console.error('Failed to fetch risk analysis:', error);
      analyzeTasksLocally();
    } finally {
      setLoading(false);
    }
  };

  const analyzeTasksLocally = () => {
    const now = new Date();
    const blocked = [];
    const atRisk = [];
    const checklistIncomplete = [];

    tasks.forEach(task => {
      // Check blocked status
      if (task.status === 'blocked' || task.is_blocked || task.prerequisite_status === 'blocked') {
        blocked.push({
          task_id: task.id,
          task_name: task.task_name,
          status: task.status,
          prerequisite_owner: task.prerequisite_owner,
          blockers: task.blockers,
          planned_start: task.planned_start,
        });
      }

      // Check delay risk
      if (task.planned_start && task.status !== 'complete') {
        const startDate = parseISO(task.planned_start);
        const daysUntilStart = differenceInDays(startDate, now);
        
        if (daysUntilStart <= 3 && daysUntilStart >= 0 && task.status === 'planned') {
          atRisk.push({
            task_id: task.id,
            task_name: task.task_name,
            planned_start: task.planned_start,
            status: task.status,
            reason: `Starts in ${daysUntilStart} day${daysUntilStart !== 1 ? 's' : ''}`,
          });
        } else if (daysUntilStart < 0 && task.status === 'planned') {
          atRisk.push({
            task_id: task.id,
            task_name: task.task_name,
            planned_start: task.planned_start,
            status: task.status,
            reason: `Start date passed (${Math.abs(daysUntilStart)} days ago)`,
          });
        }
      }

      // Check incomplete checklist
      if (task.has_incomplete_checklist || 
          (task.pre_start_checklist && task.pre_start_checklist.some(i => !i.checked))) {
        const checklist = task.pre_start_checklist || [];
        const incomplete = checklist.filter(i => !i.checked);
        checklistIncomplete.push({
          task_id: task.id,
          task_name: task.task_name,
          incomplete_items: incomplete.slice(0, 3).map(i => i.label),
          total_incomplete: incomplete.length,
        });
      }
    });

    setRiskData({
      summary: {
        total_tasks: tasks.length,
        blocked_count: blocked.length,
        at_risk_count: atRisk.length,
        checklist_incomplete_count: checklistIncomplete.length,
      },
      blocked_tasks: blocked,
      at_risk_tasks: atRisk,
      checklist_incomplete: checklistIncomplete,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!riskData) return null;

  const { summary, blocked_tasks, at_risk_tasks, checklist_incomplete } = riskData;
  const hasIssues = summary.blocked_count > 0 || summary.at_risk_count > 0 || summary.checklist_incomplete_count > 0;

  // Compact view for dashboard
  if (compact) {
    if (!hasIssues) {
      return (
        <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 p-3 rounded-lg">
          <CheckCircle className="h-4 w-4" />
          <span className="text-sm">No risks or blockers detected</span>
        </div>
      );
    }

    return (
      <div className="space-y-2" data-testid="risk-warnings-compact">
        {summary.blocked_count > 0 && (
          <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <XCircle className="h-4 w-4" />
              <span className="text-sm font-medium">{summary.blocked_count} blocked task{summary.blocked_count !== 1 ? 's' : ''}</span>
            </div>
            <Badge variant="destructive">{summary.blocked_count}</Badge>
          </div>
        )}
        {summary.at_risk_count > 0 && (
          <div className="flex items-center justify-between p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">{summary.at_risk_count} at risk</span>
            </div>
            <Badge variant="warning">{summary.at_risk_count}</Badge>
          </div>
        )}
        {summary.checklist_incomplete_count > 0 && (
          <div className="flex items-center justify-between p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <ClipboardList className="h-4 w-4" />
              <span className="text-sm font-medium">{summary.checklist_incomplete_count} checklist incomplete</span>
            </div>
            <Badge variant="secondary">{summary.checklist_incomplete_count}</Badge>
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <Card data-testid="risk-warnings">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Risk & Blockers
          </CardTitle>
          {hasIssues ? (
            <Badge variant="destructive">
              {summary.blocked_count + summary.at_risk_count} issues
            </Badge>
          ) : (
            <Badge variant="success">All Clear</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {!hasIssues ? (
          <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <CheckCircle className="h-5 w-5" />
            <div>
              <p className="font-medium">No risks detected</p>
              <p className="text-sm text-muted-foreground">All tasks are on track</p>
            </div>
          </div>
        ) : (
          <ScrollArea className="h-[300px]">
            <div className="space-y-4">
              {/* Blocked Tasks */}
              {blocked_tasks?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    Blocked Tasks ({blocked_tasks.length})
                  </h4>
                  <div className="space-y-2">
                    {blocked_tasks.map((task, i) => (
                      <div
                        key={task.task_id || i}
                        className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                        onClick={() => onTaskClick?.(task)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{task.task_name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        {task.prerequisite_owner && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Waiting on: {task.prerequisite_owner}
                          </p>
                        )}
                        {task.blockers && (
                          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                            {task.blockers}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* At Risk Tasks */}
              {at_risk_tasks?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    At Risk ({at_risk_tasks.length})
                  </h4>
                  <div className="space-y-2">
                    {at_risk_tasks.map((task, i) => (
                      <div
                        key={task.task_id || i}
                        className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
                        onClick={() => onTaskClick?.(task)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{task.task_name}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.reason}
                        </p>
                        {task.planned_start && (
                          <p className="text-xs text-muted-foreground">
                            Start: {format(parseISO(task.planned_start), 'MMM d, yyyy')}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Checklist Incomplete */}
              {checklist_incomplete?.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Checklist Incomplete ({checklist_incomplete.length})
                  </h4>
                  <div className="space-y-2">
                    {checklist_incomplete.map((task, i) => (
                      <div
                        key={task.task_id || i}
                        className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                        onClick={() => onTaskClick?.(task)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm">{task.task_name}</span>
                          <Badge variant="secondary">{task.total_incomplete} items</Badge>
                        </div>
                        {task.incomplete_items?.length > 0 && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Missing: {task.incomplete_items.join(', ')}
                            {task.total_incomplete > 3 && ` +${task.total_incomplete - 3} more`}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
