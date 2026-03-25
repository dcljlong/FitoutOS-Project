import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CheckCircle,
  XCircle,
  Clock,
  Filter,
  Loader2,
  User,
  Calendar,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

export default function TimesheetApprovalPage() {
  const [timesheets, setTimesheets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEntries, setSelectedEntries] = useState([]);
  const [processing, setProcessing] = useState(false);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [jobFilter, setJobFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('all');

  useEffect(() => {
    fetchData();
  }, [statusFilter, jobFilter, userFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'all') params.append('status', statusFilter);
      if (jobFilter !== 'all') params.append('job_id', jobFilter);
      if (userFilter !== 'all') params.append('user_id', userFilter);
      
      const [tsRes, jobsRes, usersRes] = await Promise.all([
        api.get(`/timesheets?${params.toString()}`),
        api.get('/jobs'),
        api.get('/users'),
      ]);
      
      setTimesheets(tsRes.data);
      setJobs(jobsRes.data);
      setUsers(usersRes.data);
    } catch (error) {
      toast.error('Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  };

  const toggleEntry = (id) => {
    setSelectedEntries(prev =>
      prev.includes(id) ? prev.filter(e => e !== id) : [...prev, id]
    );
  };

  const toggleAll = () => {
    if (selectedEntries.length === timesheets.length) {
      setSelectedEntries([]);
    } else {
      setSelectedEntries(timesheets.map(t => t.id));
    }
  };

  const handleApprove = async () => {
    if (selectedEntries.length === 0) {
      toast.error('No entries selected');
      return;
    }
    
    setProcessing(true);
    try {
      await api.post('/timesheets/approve', selectedEntries);
      toast.success(`Approved ${selectedEntries.length} entries`);
      setSelectedEntries([]);
      fetchData();
    } catch (error) {
      toast.error('Failed to approve entries');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (selectedEntries.length === 0) {
      toast.error('No entries selected');
      return;
    }
    
    setProcessing(true);
    try {
      await api.post('/timesheets/reject', selectedEntries);
      toast.success(`Rejected ${selectedEntries.length} entries`);
      setSelectedEntries([]);
      fetchData();
    } catch (error) {
      toast.error('Failed to reject entries');
    } finally {
      setProcessing(false);
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      draft: 'secondary',
      submitted: 'default',
      approved: 'success',
      needs_correction: 'destructive',
      exported: 'outline',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status.replace('_', ' ')}</Badge>;
  };

  // Group timesheets by user and date
  const groupedTimesheets = timesheets.reduce((acc, ts) => {
    const key = `${ts.user_id}-${ts.date}`;
    if (!acc[key]) {
      acc[key] = {
        user_id: ts.user_id,
        user_name: ts.user_name,
        date: ts.date,
        entries: [],
        total_hours: 0,
      };
    }
    acc[key].entries.push(ts);
    acc[key].total_hours += ts.hours;
    return acc;
  }, {});

  const totalSelectedHours = timesheets
    .filter(t => selectedEntries.includes(t.id))
    .reduce((sum, t) => sum + t.hours, 0);

  return (
    <div className="space-y-6" data-testid="approval-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Timesheet Approval</h1>
          <p className="text-muted-foreground mt-1">Review and approve submitted timesheets</p>
        </div>
        
        {selectedEntries.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              {selectedEntries.length} selected ({totalSelectedHours.toFixed(2)}h)
            </span>
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={processing}
              className="text-destructive"
              data-testid="reject-btn"
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </Button>
            <Button
              onClick={handleApprove}
              disabled={processing}
              data-testid="approve-btn"
            >
              {processing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4" />
              )}
              Approve
            </Button>
          </div>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <Filter className="h-4 w-4 text-muted-foreground" />
            
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]" data-testid="status-filter">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="submitted">Submitted</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="needs_correction">Needs Correction</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>

            <Select value={jobFilter} onValueChange={setJobFilter}>
              <SelectTrigger className="w-[200px]" data-testid="job-filter">
                <SelectValue placeholder="Filter by job" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                {jobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    {job.job_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="w-[200px]" data-testid="user-filter">
                <SelectValue placeholder="Filter by user" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Users</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Timesheets Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">Timesheet Entries</CardTitle>
              <CardDescription>
                {timesheets.length} entries found
              </CardDescription>
            </div>
            {timesheets.length > 0 && (
              <Button variant="outline" size="sm" onClick={toggleAll}>
                {selectedEntries.length === timesheets.length ? 'Deselect All' : 'Select All'}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : timesheets.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium">No timesheets found</h3>
              <p className="text-muted-foreground mt-2">
                {statusFilter === 'submitted' 
                  ? 'No timesheets awaiting approval'
                  : 'Try adjusting your filters'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-[40px]"></th>
                    <th>Date</th>
                    <th>User</th>
                    <th>Job</th>
                    <th>Task Code</th>
                    <th>Description</th>
                    <th className="text-right">Hours</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheets.map((ts) => (
                    <tr 
                      key={ts.id}
                      className={selectedEntries.includes(ts.id) ? 'bg-primary/5' : ''}
                      data-testid={`ts-row-${ts.id}`}
                    >
                      <td>
                        <Checkbox
                          checked={selectedEntries.includes(ts.id)}
                          onCheckedChange={() => toggleEntry(ts.id)}
                          disabled={ts.status !== 'submitted'}
                        />
                      </td>
                      <td className="whitespace-nowrap">
                        {new Date(ts.date).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-muted-foreground" />
                          {ts.user_name}
                        </div>
                      </td>
                      <td>
                        {ts.job_number ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span className="font-mono">{ts.job_number}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">No job</span>
                        )}
                      </td>
                      <td>
                        <span className="font-mono font-medium">{ts.task_code}</span>
                        <span className="text-muted-foreground ml-2">
                          {ts.task_code_name}
                        </span>
                      </td>
                      <td className="max-w-[200px] truncate">
                        {ts.description || '-'}
                      </td>
                      <td className="text-right font-data font-bold">
                        {ts.hours.toFixed(2)}
                      </td>
                      <td>{getStatusBadge(ts.status)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6} className="text-right font-medium">
                      Total Hours
                    </td>
                    <td className="text-right font-data text-xl font-bold">
                      {timesheets.reduce((sum, t) => sum + t.hours, 0).toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
