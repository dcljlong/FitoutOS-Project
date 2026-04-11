import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Search,
  Edit,
  ClipboardList,
  Loader2,
  Building2,
} from 'lucide-react';
import { toast } from 'sonner';

const emptyMasterCode = {
  code: '',
  name: '',
  description: '',
  category: '',
  is_global_fallback: false,
};

export default function TaskCodesPage() {
  const { isAdmin } = useAuth();
  const [masterCodes, setMasterCodes] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [jobCodes, setJobCodes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialog states
  const [masterDialogOpen, setMasterDialogOpen] = useState(false);
  const [editMasterDialogOpen, setEditMasterDialogOpen] = useState(false);
  const [jobCodeDialogOpen, setJobCodeDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [newMasterCode, setNewMasterCode] = useState(emptyMasterCode);
  const [editingMasterCodeId, setEditingMasterCodeId] = useState(null);
  const [editMasterCode, setEditMasterCode] = useState(emptyMasterCode);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedJob) {
      fetchJobCodes(selectedJob);
    }
  }, [selectedJob]);

  const fetchData = async () => {
    try {
      const [codesRes, jobsRes] = await Promise.all([
        api.get('/task-codes/master'),
        api.get('/jobs'),
      ]);
      setMasterCodes(codesRes.data);
      setJobs(jobsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const fetchJobCodes = async (jobId) => {
    try {
      const response = await api.get(`/jobs/${jobId}/task-codes`);
      setJobCodes(response.data);
    } catch (error) {
      toast.error('Failed to load job task codes');
    }
  };

  const handleCreateMasterCode = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const response = await api.post('/task-codes/master', newMasterCode);
      setMasterCodes([...masterCodes, response.data]);
      setMasterDialogOpen(false);
      setNewMasterCode(emptyMasterCode);
      toast.success('Task code created');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to create task code');
    } finally {
      setSaving(false);
    }
  };

  const openEditMasterDialog = (code) => {
    setEditingMasterCodeId(code.id);
    setEditMasterCode({
      code: code.code || '',
      name: code.name || '',
      description: code.description || '',
      category: code.category || '',
      is_global_fallback: !!code.is_global_fallback,
    });
    setEditMasterDialogOpen(true);
  };

  const handleUpdateMasterCode = async (e) => {
    e.preventDefault();
    if (!editingMasterCodeId) return;

    setSaving(true);
    try {
      const response = await api.put(`/task-codes/master/${editingMasterCodeId}`, editMasterCode);
      setMasterCodes(masterCodes.map((code) => (
        code.id === editingMasterCodeId ? response.data : code
      )));
      setEditMasterDialogOpen(false);
      setEditingMasterCodeId(null);
      setEditMasterCode(emptyMasterCode);
      toast.success('Task code updated');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update task code');
    } finally {
      setSaving(false);
    }
  };

  const handleAddToJob = async (masterCodeId) => {
    if (!selectedJob) {
      toast.error('Please select a job first');
      return;
    }

    try {
      const response = await api.post(`/jobs/${selectedJob}/task-codes`, {
        master_code_id: masterCodeId,
        is_active: true,
      });
      setJobCodes([...jobCodes, response.data]);
      toast.success('Code added to job');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add code');
    }
  };

  const handleToggleJobCode = async (codeId, isActive) => {
    try {
      const code = jobCodes.find(c => c.id === codeId);
      await api.put(`/jobs/${selectedJob}/task-codes/${codeId}`, {
        master_code_id: code.master_code_id,
        custom_label: code.custom_label || '',
        is_active: isActive,
      });
      setJobCodes(jobCodes.map(c => c.id === codeId ? { ...c, is_active: isActive } : c));
      toast.success(`Code ${isActive ? 'activated' : 'deactivated'}`);
    } catch (error) {
      toast.error('Failed to update code');
    }
  };

  const filteredMasterCodes = masterCodes.filter(code =>
    code.code.toLowerCase().includes(search.toLowerCase()) ||
    code.name.toLowerCase().includes(search.toLowerCase()) ||
    code.category?.toLowerCase().includes(search.toLowerCase())
  );

  const categories = [...new Set(masterCodes.map(c => c.category).filter(Boolean))];

  return (
    <div className="space-y-6" data-testid="task-codes-page">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Manrope']">Task Codes</h1>
          <p className="text-muted-foreground mt-1">Manage master and job-specific task codes</p>
        </div>
        {isAdmin() && (
          <Dialog open={masterDialogOpen} onOpenChange={setMasterDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-master-code-btn">
                <Plus className="mr-2 h-4 w-4" />
                Add Master Code
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleCreateMasterCode}>
                <DialogHeader>
                  <DialogTitle>Add Master Task Code</DialogTitle>
                  <DialogDescription>
                    Create a new task code that can be used across all jobs
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="code" className="text-right">Code</Label>
                    <Input
                      id="code"
                      value={newMasterCode.code}
                      onChange={(e) => setNewMasterCode({ ...newMasterCode, code: e.target.value })}
                      className="col-span-3"
                      placeholder="e.g. 101"
                      required
                      data-testid="master-code-input"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="name" className="text-right">Name</Label>
                    <Input
                      id="name"
                      value={newMasterCode.name}
                      onChange={(e) => setNewMasterCode({ ...newMasterCode, name: e.target.value })}
                      className="col-span-3"
                      placeholder="e.g. Suspended Ceilings"
                      required
                      data-testid="master-name-input"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="category" className="text-right">Category</Label>
                    <Input
                      id="category"
                      value={newMasterCode.category}
                      onChange={(e) => setNewMasterCode({ ...newMasterCode, category: e.target.value })}
                      className="col-span-3"
                      placeholder="e.g. Ceilings"
                      data-testid="master-category-input"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="description" className="text-right">Description</Label>
                    <Input
                      id="description"
                      value={newMasterCode.description}
                      onChange={(e) => setNewMasterCode({ ...newMasterCode, description: e.target.value })}
                      className="col-span-3"
                      placeholder="Optional description"
                    />
                  </div>
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label className="text-right">Global Fallback</Label>
                    <div className="col-span-3 flex items-center gap-2">
                      <Switch
                        checked={newMasterCode.is_global_fallback}
                        onCheckedChange={(checked) => setNewMasterCode({ ...newMasterCode, is_global_fallback: checked })}
                      />
                      <span className="text-sm text-muted-foreground">
                        Available for non-job entries
                      </span>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setMasterDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving} data-testid="save-master-code-btn">
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Create Code
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Dialog open={editMasterDialogOpen} onOpenChange={setEditMasterDialogOpen}>
        <DialogContent>
          <form onSubmit={handleUpdateMasterCode}>
            <DialogHeader>
              <DialogTitle>Edit Master Task Code</DialogTitle>
              <DialogDescription>
                Update the selected master task code
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-code" className="text-right">Code</Label>
                <Input
                  id="edit-code"
                  value={editMasterCode.code}
                  onChange={(e) => setEditMasterCode({ ...editMasterCode, code: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. 101"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-name" className="text-right">Name</Label>
                <Input
                  id="edit-name"
                  value={editMasterCode.name}
                  onChange={(e) => setEditMasterCode({ ...editMasterCode, name: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Suspended Ceilings"
                  required
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-category" className="text-right">Category</Label>
                <Input
                  id="edit-category"
                  value={editMasterCode.category}
                  onChange={(e) => setEditMasterCode({ ...editMasterCode, category: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Ceilings"
                  list="task-code-categories"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="edit-description" className="text-right">Description</Label>
                <Input
                  id="edit-description"
                  value={editMasterCode.description}
                  onChange={(e) => setEditMasterCode({ ...editMasterCode, description: e.target.value })}
                  className="col-span-3"
                  placeholder="Optional description"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Global Fallback</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Switch
                    checked={editMasterCode.is_global_fallback}
                    onCheckedChange={(checked) => setEditMasterCode({ ...editMasterCode, is_global_fallback: checked })}
                  />
                  <span className="text-sm text-muted-foreground">
                    Available for non-job entries
                  </span>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditMasterDialogOpen(false);
                  setEditingMasterCodeId(null);
                  setEditMasterCode(emptyMasterCode);
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving} data-testid="update-master-code-btn">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <datalist id="task-code-categories">
        {categories.map((category) => (
          <option key={category} value={category} />
        ))}
      </datalist>

      {/* Tabs */}
      <Tabs defaultValue="master" className="space-y-4">
        <TabsList>
          <TabsTrigger value="master">Master Codes</TabsTrigger>
          <TabsTrigger value="job">Job-Specific Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="master" className="space-y-4">
          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search codes..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
              data-testid="search-codes"
            />
          </div>

          {/* Codes Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                        </td>
                      </tr>
                    ) : filteredMasterCodes.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          No task codes found
                        </td>
                      </tr>
                    ) : (
                      filteredMasterCodes.map((code) => (
                        <tr key={code.id} data-testid={`master-row-${code.code}`}>
                          <td className="font-mono font-bold">{code.code}</td>
                          <td>{code.name}</td>
                          <td>{code.category || '-'}</td>
                          <td>
                            {code.is_global_fallback ? (
                              <Badge variant="outline">Fallback</Badge>
                            ) : (
                              <Badge variant="secondary">Standard</Badge>
                            )}
                          </td>
                          <td>
                            <Badge variant={code.is_active ? 'default' : 'secondary'}>
                              {code.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              {isAdmin() && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openEditMasterDialog(code)}
                                  data-testid={`edit-master-${code.code}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleAddToJob(code.id)}
                                disabled={!selectedJob}
                              >
                                Add to Job
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="job" className="space-y-4">
          {/* Job Selector */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1 max-w-md">
                  <Select value={selectedJob || ''} onValueChange={setSelectedJob}>
                    <SelectTrigger data-testid="job-selector">
                      <SelectValue placeholder="Select a job to manage codes" />
                    </SelectTrigger>
                    <SelectContent>
                      {jobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.job_number} - {job.job_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {selectedJob ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Active Codes for Job</CardTitle>
                <CardDescription>
                  Toggle codes on/off to control what's available for timesheets
                </CardDescription>
              </CardHeader>
              <CardContent>
                {jobCodes.length === 0 ? (
                  <div className="text-center py-8">
                    <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No codes added to this job yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Go to Master Codes tab and click "Add to Job" to add codes
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {jobCodes.map((code) => (
                      <div
                        key={code.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                        data-testid={`job-code-${code.code}`}
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">{code.code}</span>
                            <span className="text-muted-foreground">-</span>
                            <span><Input className="h-8 w-48" value={code.custom_label || ""} placeholder={code.name} onChange={(e)=>setJobCodes(jobCodes.map(c=>c.id===code.id?{...c,custom_label:e.target.value}:c))} onBlur={()=>api.put(`/jobs/${selectedJob}/task-codes/${code.id}`,{master_code_id:code.master_code_id,custom_label:code.custom_label||"",is_active:code.is_active})} /></span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={code.is_active ? 'default' : 'secondary'}>
                            {code.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Switch
                            checked={code.is_active}
                            onCheckedChange={(checked) => handleToggleJobCode(code.id, checked)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Select a job to manage its task codes</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

