import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Plus,
  Trash2,
  Save,
  Send,
  Clock,
  Loader2,
  AlertCircle,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';

export default function TimesheetsPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [fallbackCodes, setFallbackCodes] = useState([]);
  const [jobCodesCache, setJobCodesCache] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const today = new Date().toISOString().slice(0, 10);
  
  const [rows, setRows] = useState([{
    id: Date.now(),
    date: today,
    job_id: '',
    task_code_id: '',
    description: '',
    hours: '',
    fallback_reason: '',
  }]);

  const [invalidCodeAlert, setInvalidCodeAlert] = useState({ open: false, rowIndex: null });

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      const [jobsRes, fallbackRes] = await Promise.all([
        api.get('/jobs'),
        api.get('/task-codes/fallback'),
      ]);
      setJobs(jobsRes.data);
      setFallbackCodes(fallbackRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobCodes = async (jobId) => {
    if (jobCodesCache[jobId]) return jobCodesCache[jobId];
    
    try {
      const response = await api.get(`/jobs/${jobId}/task-codes?active_only=true`);
      setJobCodesCache(prev => ({ ...prev, [jobId]: response.data }));
      return response.data;
    } catch (error) {
      console.error('Failed to fetch job codes:', error);
      return [];
    }
  };

  const getAvailableCodes = useCallback((jobId) => {
    if (jobId && jobCodesCache[jobId]) {
      return jobCodesCache[jobId];
    }
    return fallbackCodes;
  }, [jobCodesCache, fallbackCodes]);

  const handleJobChange = async (index, jobId) => {
    const row = rows[index];
    const newRows = [...rows];
    newRows[index] = { ...row, job_id: jobId, task_code_id: '' };
    setRows(newRows);

    if (jobId) {
      await fetchJobCodes(jobId);
      
      // If a code was previously selected, validate it
      if (row.task_code_id) {
        const jobCodes = await fetchJobCodes(jobId);
        const isValidForJob = jobCodes.some(c => c.id === row.task_code_id);
        
        if (!isValidForJob) {
          setInvalidCodeAlert({ open: true, rowIndex: index });
        }
      }
    }
  };

  const handleCodeChange = (index, codeId) => {
    const newRows = [...rows];
    newRows[index] = { ...rows[index], task_code_id: codeId };
    setRows(newRows);
  };

  const updateRow = (index, field, value) => {
    const newRows = [...rows];
    newRows[index] = { ...rows[index], [field]: value };
    setRows(newRows);
  };

  const addRow = () => {
    setRows([...rows, {
      id: Date.now(),
      date: today,
      job_id: '',
      task_code_id: '',
      description: '',
      hours: '',
      fallback_reason: '',
    }]);
  };

  const removeRow = (index) => {
    if (rows.length === 1) return;
    setRows(rows.filter((_, i) => i !== index));
  };

  const totalHours = useMemo(() => {
    return rows.reduce((sum, row) => sum + (parseFloat(row.hours) || 0), 0);
  }, [rows]);

  const canSave = useMemo(() => {
    return rows.some(r => r.task_code_id && parseFloat(r.hours) > 0);
  }, [rows]);

  const validateRows = () => {
    const errors = [];
    rows.forEach((row, index) => {
      if (parseFloat(row.hours) > 0) {
        if (!row.task_code_id) {
          errors.push(`Row ${index + 1}: Task code required`);
        }
        if (!row.job_id && !row.fallback_reason) {
          errors.push(`Row ${index + 1}: Job or fallback reason required`);
        }
      }
    });
    return errors;
  };

  const handleSave = async () => {
    const errors = validateRows();
    if (errors.length > 0) {
      errors.forEach(e => toast.error(e));
      return;
    }

    const validRows = rows.filter(r => r.task_code_id && parseFloat(r.hours) > 0);
    if (validRows.length === 0) {
      toast.error('No valid entries to save');
      return;
    }

    setSaving(true);
    try {
      await api.post('/timesheets', {
        rows: validRows.map(r => ({
          date: r.date,
          job_id: r.job_id || null,
          task_code_id: r.task_code_id,
          description: r.description || null,
          hours: parseFloat(r.hours),
          fallback_reason: r.fallback_reason || null,
        })),
      });
      
      toast.success(`Saved ${validRows.length} timesheet entries`);
      
      // Reset form
      setRows([{
        id: Date.now(),
        date: today,
        job_id: '',
        task_code_id: '',
        description: '',
        hours: '',
        fallback_reason: '',
      }]);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save timesheet');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    await handleSave();
    // In a full implementation, this would also mark entries as submitted
  };

  const getJobLabel = (jobId) => {
    const job = jobs.find(j => j.id === jobId);
    return job ? `${job.job_number} - ${job.job_name}` : '';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="timesheets-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Timesheets</h1>
          <p className="text-muted-foreground mt-1">Enter your daily time by job and task code</p>
        </div>
        <div className="flex items-center gap-2 bg-card border rounded-lg px-4 py-2">
          <Clock className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Total:</span>
          <span className="font-data text-xl font-bold">{totalHours.toFixed(2)} hrs</span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-blue-800 dark:text-blue-200">Job-First Workflow</p>
          <p className="text-blue-700 dark:text-blue-300 mt-1">
            Select a job number first to see job-specific task codes. 
            Leave job blank for general codes (P&G, Tools, etc.)
          </p>
        </div>
      </div>

      {/* Timesheet Entry Card */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Time Entry</CardTitle>
              <CardDescription>Add rows for each task you worked on</CardDescription>
            </div>
            <Button variant="outline" onClick={addRow} data-testid="add-row-btn">
              <Plus className="mr-2 h-4 w-4" />
              Add Row
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Header Row (Desktop) */}
            <div className="hidden md:grid md:grid-cols-12 gap-4 px-4 py-2 bg-muted/50 rounded-lg text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              <div className="col-span-2">Date</div>
              <div className="col-span-3">Job Number</div>
              <div className="col-span-2">Task Code</div>
              <div className="col-span-3">Description</div>
              <div className="col-span-1">Hours</div>
              <div className="col-span-1"></div>
            </div>

            {/* Entry Rows */}
            {rows.map((row, index) => {
              const availableCodes = getAvailableCodes(row.job_id);
              const isJobSelected = !!row.job_id;
              
              return (
                <div
                  key={row.id}
                  className="grid gap-4 md:grid-cols-12 items-start p-4 rounded-lg border bg-card"
                  data-testid={`timesheet-row-${index}`}
                >
                  {/* Date */}
                  <div className="md:col-span-2">
                    <Label className="md:hidden text-xs text-muted-foreground mb-1 block">Date</Label>
                    <Input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateRow(index, 'date', e.target.value)}
                      className="w-full"
                      data-testid={`row-${index}-date`}
                    />
                  </div>

                  {/* Job Selection */}
                  <div className="md:col-span-3">
                    <Label className="md:hidden text-xs text-muted-foreground mb-1 block">
                      Job Number (select first)
                    </Label>
                    <Select
                      value={row.job_id || "no-job"}
                      onValueChange={(value) => handleJobChange(index, value === "no-job" ? "" : value)}
                    >
                      <SelectTrigger data-testid={`row-${index}-job`}>
                        <SelectValue placeholder="Select job (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no-job">No job (use fallback codes)</SelectItem>
                        {jobs.map((job) => (
                          <SelectItem key={job.id} value={job.id}>
                            {job.job_number} - {job.job_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Task Code */}
                  <div className="md:col-span-2">
                    <Label className="md:hidden text-xs text-muted-foreground mb-1 block">
                      {isJobSelected ? 'Job-specific code' : 'Global fallback code'}
                    </Label>
                    <Select
                      value={row.task_code_id || "placeholder"}
                      onValueChange={(value) => handleCodeChange(index, value === "placeholder" ? "" : value)}
                    >
                      <SelectTrigger 
                        data-testid={`row-${index}-code`}
                        className={!isJobSelected ? 'border-dashed' : ''}
                      >
                        <SelectValue placeholder={isJobSelected ? "Select code" : "Fallback code"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableCodes.length === 0 ? (
                          <SelectItem value="no-codes" disabled>
                            {isJobSelected ? 'No codes for this job' : 'Loading...'}
                          </SelectItem>
                        ) : (
                          availableCodes.map((code) => (
                            <SelectItem key={code.id} value={code.id}>
                              {code.code} - {code.custom_label || code.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                    {!isJobSelected && row.task_code_id && (
                      <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Using fallback code
                      </p>
                    )}
                  </div>

                  {/* Description */}
                  <div className="md:col-span-3">
                    <Label className="md:hidden text-xs text-muted-foreground mb-1 block">Description</Label>
                    <Input
                      value={row.description}
                      onChange={(e) => updateRow(index, 'description', e.target.value)}
                      placeholder="Brief description"
                      data-testid={`row-${index}-desc`}
                    />
                  </div>

                  {/* Hours */}
                  <div className="md:col-span-1">
                    <Label className="md:hidden text-xs text-muted-foreground mb-1 block">Hours</Label>
                    <Input
                      type="number"
                      step="0.25"
                      min="0"
                      max="24"
                      value={row.hours}
                      onChange={(e) => updateRow(index, 'hours', e.target.value)}
                      placeholder="0.00"
                      className="text-center"
                      data-testid={`row-${index}-hours`}
                    />
                  </div>

                  {/* Remove Button */}
                  <div className="md:col-span-1 flex items-end justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(index)}
                      disabled={rows.length === 1}
                      className="text-muted-foreground hover:text-destructive"
                      data-testid={`row-${index}-remove`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Fallback Reason (shown when no job selected) */}
                  {!isJobSelected && (
                    <div className="md:col-span-12">
                      <Label className="text-xs text-muted-foreground mb-1 block">
                        Reason for non-job entry
                      </Label>
                      <Select
                        value={row.fallback_reason || "placeholder"}
                        onValueChange={(value) => updateRow(index, 'fallback_reason', value === "placeholder" ? "" : value)}
                      >
                        <SelectTrigger data-testid={`row-${index}-reason`}>
                          <SelectValue placeholder="Select reason" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="job_not_created">Job not yet created</SelectItem>
                          <SelectItem value="general_yard">General yard/workshop</SelectItem>
                          <SelectItem value="travel_admin">Travel / admin</SelectItem>
                          <SelectItem value="misc_small">Misc small works</SelectItem>
                          <SelectItem value="correction">Correction entry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Totals Row */}
            <div className="flex items-center justify-between px-4 py-3 bg-muted/50 rounded-lg">
              <span className="font-medium">Total Hours</span>
              <span className="font-data text-2xl font-bold">{totalHours.toFixed(2)}</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end gap-2 mt-6">
            <Button
              variant="outline"
              onClick={handleSave}
              disabled={!canSave || saving}
              data-testid="save-timesheet-btn"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Save className="mr-2 h-4 w-4" />
              Save Draft
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!canSave || submitting}
              data-testid="submit-timesheet-btn"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Send className="mr-2 h-4 w-4" />
              Save & Submit
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Invalid Code Alert */}
      <AlertDialog open={invalidCodeAlert.open} onOpenChange={(open) => setInvalidCodeAlert({ open, rowIndex: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Invalid Task Code</AlertDialogTitle>
            <AlertDialogDescription>
              The selected task code is not active for this job. 
              Please choose a valid job-specific code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setInvalidCodeAlert({ open: false, rowIndex: null })}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
