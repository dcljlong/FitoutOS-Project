import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from 'lucide-react';
import { toast } from 'sonner';

import GanttChart from '@/components/GanttChart';
import RiskWarnings from '@/components/RiskWarnings';
import PreStartChecklist from '@/components/PreStartChecklist';

export default function GanttPage() {
  const { jobId } = useParams();
  const [job, setJob] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [programme, setProgramme] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [colorBy, setColorBy] = useState('trade');

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [jobRes, tasksRes, progRes] = await Promise.all([
        api.get(`/jobs/${jobId}`),
        api.get(`/tasks?job_id=${jobId}`),
        api.get(`/jobs/${jobId}/programme`),
      ]);
      setJob(jobRes.data);
      setTasks(tasksRes.data);
      setProgramme(progRes.data);
    } catch (error) {
      toast.error('Failed to load job data');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle task click
  const handleTaskClick = (task) => {
    setSelectedTask(task);
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
              Back to Job
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
            {tasks.length} Tasks
          </Badge>
          {tasks.some(t => t.is_blocked || t.status === 'blocked') && (
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
          />
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
                    <p className="mt-1 font-medium">{selectedTask.trade_resource || selectedTask.owner_party || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Start Date</span>
                    <p className="mt-1 font-medium">{selectedTask.planned_start || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Finish Date</span>
                    <p className="mt-1 font-medium">{selectedTask.planned_finish || '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Crew Size</span>
                    <p className="mt-1 font-medium flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {selectedTask.crew_size || '—'}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quoted Hours</span>
                    <p className="mt-1 font-medium">{selectedTask.quoted_hours || '—'}</p>
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
