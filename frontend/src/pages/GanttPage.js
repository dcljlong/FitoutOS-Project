import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ArrowLeft,
  Calendar,
  BarChart3,
  Loader2,
  AlertTriangle,
  Settings,
  Users,
  ChevronRight,
  AlertOctagon,
  Shield,
  CheckCircle,
  ListTodo,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import GanttChart from '@/components/GanttChart';
import RiskWarnings from '@/components/RiskWarnings';
import PreStartChecklist from '@/components/PreStartChecklist';

export default function GanttPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [programme, setProgramme] = useState([]);
  const [analysisPayload, setAnalysisPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [colorBy, setColorBy] = useState('trade');
  const [showTaskList, setShowTaskList] = useState(true);
  const taskListRefs = useRef({});

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [jobRes, tasksRes, progRes, analysisRes] = await Promise.all([
        api.get(`/jobs/${jobId}`),
        api.get(`/tasks?job_id=${jobId}`),
        api.get(`/jobs/${jobId}/programme`),
        api.get(`/jobs/${jobId}/resource-analysis`),
      ]);

      const analysisData = analysisRes.data || {};
      const analysisTasks = analysisData.tasks || [];
      const analysisById = Object.fromEntries(
        analysisTasks.map((row) => [row.task_id, row])
      );

      const mergedTasks = (tasksRes.data || []).map((task) => {
        const recovery = analysisById[task.id];
        if (!recovery) return task;

        return {
          ...task,
          required_crew_standard: recovery.required_crew_standard,
          required_crew_with_saturday: recovery.required_crew_with_saturday,
          average_hours_per_day_standard: recovery.average_hours_per_day_standard,
          average_hours_per_day_with_saturday: recovery.average_hours_per_day_with_saturday,
          duration_days_at_standard_crew: recovery.duration_days_at_standard_crew,
          duration_gap_days_at_standard_crew: recovery.duration_gap_days_at_standard_crew,
          duration_days_at_required_crew_standard: recovery.duration_days_at_required_crew_standard,
          duration_days_at_required_crew_with_saturday: recovery.duration_days_at_required_crew_with_saturday,
          extra_crew_needed_standard: recovery.extra_crew_needed_standard,
          extra_crew_needed_with_saturday: recovery.extra_crew_needed_with_saturday,
          recommended_recovery_crew: recovery.recommended_recovery_crew,
          recovery_strategy: recovery.recovery_strategy,
          programme_feasible: recovery.programme_feasible,
          requires_saturday: recovery.requires_saturday,
        };
      });

      const rawProgramme = progRes.data || [];
      const cleanedProgramme = rawProgramme.filter((row) => {
        if (!row) return false;
        if (row.source_format !== 'mpp') return true;
        if (row.is_summary) return false;
        if (row.is_milestone) return false;
        return true;
      });

      setJob(jobRes.data);
      setTasks(mergedTasks);
      setProgramme(cleanedProgramme);
      setAnalysisPayload(analysisData);
    } catch (error) {
      setAnalysisPayload(null);
      toast.error('Failed to load job data');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle task click - highlight in both Gantt and task list
  const handleTaskClick = (task) => {
    setSelectedTask(task);
    setHighlightedTaskId(task.id);
    
    // Scroll to task in list
    if (taskListRefs.current[task.id]) {
      taskListRefs.current[task.id].scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
    
    // Auto-clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedTaskId(null);
    }, 3000);
  };

  // Handle task click from list - open details
  const handleTaskListClick = (task) => {
    setSelectedTask(task);
    setHighlightedTaskId(task.id);
    
    // Auto-clear highlight after 3 seconds
    setTimeout(() => {
      setHighlightedTaskId(null);
    }, 3000);
  };

  // Get risk badge for task
  const getTaskRiskBadge = (task) => {
    if (task.is_blocked || task.status === 'blocked') {
      return <Badge variant="destructive" className="text-[10px] px-1 py-0"><AlertOctagon className="h-2 w-2" /></Badge>;
    }
    if (task.is_critical || task.total_float === 0) {
      return <Badge className="text-[10px] px-1 py-0 bg-orange-500"><Shield className="h-2 w-2" /></Badge>;
    }
    if (task.delay_risk || task.at_risk || task.status === 'at_risk') {
      return <Badge className="text-[10px] px-1 py-0 bg-amber-500"><AlertTriangle className="h-2 w-2" /></Badge>;
    }
    if (task.status === 'complete') {
      return <Badge variant="outline" className="text-[10px] px-1 py-0 border-green-500 text-green-500"><CheckCircle className="h-2 w-2" /></Badge>;
    }
    return null;
  };

  // Handle task move (drag)
  const handleTaskMove = async (taskId, newStart, newEnd) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      await api.put(`/tasks/${taskId}`, {
        ...task,
        planned_start: newStart,
        planned_finish: newEnd,
      });
      
      // Refresh tasks
      const tasksRes = await api.get(`/tasks?job_id=${jobId}`);
      setTasks(tasksRes.data);
      toast.success('Task dates updated');
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  // Handle task duration change (resize)
  const handleTaskDurationChange = async (taskId, newEnd) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      await api.put(`/tasks/${taskId}`, {
        ...task,
        planned_finish: newEnd,
      });
      
      // Refresh tasks
      const tasksRes = await api.get(`/tasks?job_id=${jobId}`);
      setTasks(tasksRes.data);
      toast.success('Task duration updated');
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  // Navigate to task in risk warning
  const handleRiskTaskClick = (task) => {
    const fullTask = tasks.find(t => t.id === task.task_id);
    if (fullTask) {
      setSelectedTask(fullTask);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="gantt-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to={`/jobs/${jobId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Previous
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Programme Gantt
            </h1>
            {job && (
              <p className="text-muted-foreground">
                {job.job_number} - {job.job_name}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant="outline">
            {tasks.length > 0 ? `${tasks.length} Tasks` : `${programme.length} Programme Items`}
          </Badge>
                      {analysisPayload?.summary?.tasks_overallocated > 0 && (
              <Badge variant="destructive">
                {analysisPayload.summary.tasks_overallocated} Overallocated
              </Badge>
            )}{tasks.some(t => t.is_blocked || t.status === 'blocked') && (
            <Badge variant="destructive">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Blockers
            </Badge>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Gantt Chart - Main area */}
        <div className="lg:col-span-3">
          <GanttChart
            tasks={tasks}
            programme={programme}
            startDate={job?.planned_start}
            endDate={job?.planned_finish}
            onTaskClick={handleTaskClick}
            onTaskMove={handleTaskMove}
            onTaskDurationChange={handleTaskDurationChange}
            colorBy={colorBy}
            showDependencies={true}
            showWeekends={true}
            showHolidays={true}
            editable={true}
            highlightedTaskId={highlightedTaskId}
          />
          
          {/* Task List Panel */}
          <Card className="mt-4" data-testid="gantt-task-list">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  Task List
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowTaskList(!showTaskList)}
                >
                  {showTaskList ? 'Hide' : 'Show'}
                </Button>
              </div>
            </CardHeader>
            {showTaskList && (
              <CardContent className="p-0">
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1 p-4">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        ref={(el) => taskListRefs.current[task.id] = el}
                        className={cn(
                          "flex items-center justify-between p-2 rounded cursor-pointer transition-all duration-300",
                          "hover:bg-accent/50 border border-transparent",
                          highlightedTaskId === task.id && "bg-primary/10 border-primary ring-2 ring-primary/20",
                          (task.is_blocked || task.status === 'blocked') && "border-l-4 border-l-red-500"
                        )}
                        onClick={() => handleTaskListClick(task)}
                        data-testid={`task-list-item-${task.id}`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {getTaskRiskBadge(task)}
                          <span className="text-sm truncate">{task.task_name}</span>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    ))}
                    {tasks.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {programme.length > 0 ? 'No generated tasks yet. Showing imported programme only.' : 'No tasks found'}
                      </p>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            )}
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Risk Warnings */}
          <RiskWarnings
            tasks={tasks}
            onTaskClick={handleRiskTaskClick}
          />

          {/* Job Summary */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Job Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Tasks</span>
                <span className="font-medium">{tasks.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Complete</span>
                <span className="font-medium">
                  {tasks.filter(t => t.status === 'complete').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Active</span>
                <span className="font-medium">
                  {tasks.filter(t => t.status === 'active').length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Blocked</span>
                <span className="font-medium text-red-600">
                  {tasks.filter(t => t.status === 'blocked' || t.is_blocked).length}
                </span>
              </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Overallocated</span>
                  <span className="font-medium text-red-600">
                    {analysisPayload?.summary?.tasks_overallocated ?? "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Recovery Crew</span>
                  <span className="font-medium">
                    {analysisPayload?.summary?.max_required_crew_standard ?? "-"}
                  </span>
                </div>
            </CardContent>
          </Card>

          {/* Color Legend */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Display Options</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={colorBy} onValueChange={setColorBy}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="trade">By Trade</TabsTrigger>
                  <TabsTrigger value="status">By Status</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Task Detail Sheet */}
      <Sheet open={!!selectedTask} onOpenChange={() => setSelectedTask(null)}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle>{selectedTask?.task_name}</SheetTitle>
            <SheetDescription>
              Task details and pre-start checklist
            </SheetDescription>
          </SheetHeader>
          
          {selectedTask && (
            <div className="mt-6 space-y-6">
              {/* Task Info */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Status</span>
                    <div className="mt-1">
                      <Badge variant={selectedTask.status === 'blocked' ? 'destructive' : 'secondary'}>
                        {selectedTask.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Trade</span>
                    <p className="mt-1 font-medium">{selectedTask.trade_resource || selectedTask.owner_party || 'â€”'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Start Date</span>
                    <p className="mt-1 font-medium">{selectedTask.planned_start || 'â€”'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Finish Date</span>
                    <p className="mt-1 font-medium">{selectedTask.planned_finish || 'â€”'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Crew Size</span>
                    <p className="mt-1 font-medium flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {selectedTask.crew_size || 'â€”'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quoted Hours</span>
                    <p className="mt-1 font-medium">{selectedTask.quoted_hours || 'â€”'}</p>
                  </div>
                </div>

                {/* Prerequisite */}
                {selectedTask.prerequisite_owner && (
                  <div className="p-3 bg-muted rounded-lg">
                    <span className="text-sm text-muted-foreground">Prerequisite Owner</span>
                    <p className="font-medium">{selectedTask.prerequisite_owner}</p>
                    <Badge variant={selectedTask.prerequisite_status === 'complete' ? 'success' : 'secondary'} className="mt-1">
                      {selectedTask.prerequisite_status}
                    </Badge>
                  </div>
                )}

                {/* Blockers */}
                {selectedTask.blockers && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                    <span className="text-sm text-red-600">Blockers</span>
                    <p className="text-sm">{selectedTask.blockers}</p>
                  </div>
                )}
              </div>

              {/* Pre-start Checklist */}
              <PreStartChecklist
                taskId={selectedTask.id}
                taskName={selectedTask.task_name}
                initialChecklist={selectedTask.pre_start_checklist}
                onUpdate={(checklist) => {
                  // Update local state
                  setTasks(prev => prev.map(t => 
                    t.id === selectedTask.id 
                      ? { ...t, pre_start_checklist: checklist }
                      : t
                  ));
                }}
              />

              {/* Actions */}
              <div className="flex gap-2">
                <Link to={`/jobs/${jobId}`} className="flex-1">
                  <Button variant="outline" className="w-full">
                    View Full Details
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}




