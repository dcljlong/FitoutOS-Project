import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  ArrowLeft,
  Edit,
  Upload,
  Sparkles,
  ClipboardList,
  ListTodo,
  Package,
  Users,
  Clock,
  MapPin,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Plus,
  Trash2,
  Eye,
  ChevronRight,
  Truck,
  AlertCircle,
  Timer,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// Delay type options
const DELAY_TYPES = [
  { value: 'internal', label: 'Internal Causes' },
  { value: 'subcontractor', label: 'Subcontractor' },
  { value: 'main_contractor', label: 'Main Contractor / Others' },
  { value: 'approvals', label: 'Approvals' },
  { value: 'materials', label: 'Materials' },
  { value: 'weather', label: 'Weather' },
  { value: 'access', label: 'Access' },
  { value: 'inspections', label: 'Inspections' },
];

// Material status options
const MATERIAL_STATUSES = [
  { value: 'required', label: 'Required', color: 'secondary' },
  { value: 'takeoff_needed', label: 'Takeoff Needed', color: 'warning' },
  { value: 'ready_to_order', label: 'Ready to Order', color: 'default' },
  { value: 'ordered', label: 'Ordered', color: 'default' },
  { value: 'confirmed', label: 'Confirmed', color: 'success' },
  { value: 'delivered', label: 'Delivered', color: 'success' },
  { value: 'part_delivered', label: 'Part Delivered', color: 'warning' },
  { value: 'delayed', label: 'Delayed', color: 'destructive' },
  { value: 'on_site', label: 'On Site', color: 'success' },
];

// Task status options
const TASK_STATUSES = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'on_track', label: 'On Track' },
  { value: 'at_risk', label: 'At Risk' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'complete', label: 'Complete' },
];

export default function JobDetailPage() {
  const { jobId } = useParams();
  const { canManage } = useAuth();
  const [job, setJob] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [taskCodes, setTaskCodes] = useState([]);
  const [subcontractors, setSubcontractors] = useState([]);
  const [delays, setDelays] = useState([]);
  const [programme, setProgramme] = useState([]);
  const [unmatchedLabour, setUnmatchedLabour] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [analyzingDocs, setAnalyzingDocs] = useState(false);
  
  // Task dialog state
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [savingTask, setSavingTask] = useState(false);
  const [taskForm, setTaskForm] = useState({
    task_name: '',
    task_type: '',
    linked_task_codes: [],
    planned_start: '',
    planned_finish: '',
      actual_start: '',
    duration_days: '',
    owner_party: '',
    is_internal: true,
    subcontractor_id: '',
    zone_area: '',
    level: '',
    package: '',
    contract: '',
    status: 'planned',
    rag_status: '',
    notes: '',
    interface_prompt: '',
    hold_point: '',
    gain_note: '',
    snapshot_note: '',
    quoted_hours: '',
    is_long_lead: false,
    earliest_possible_start: '',
    manual_start_override: '',
    rounded_crew: '',
      actual_hours: '',
      percent_complete: '0',
  });

  // Task detail sheet state
  const [selectedTask, setSelectedTask] = useState(null);
  const [taskMaterials, setTaskMaterials] = useState([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [documentActionDialogOpen, setDocumentActionDialogOpen] = useState(false);
  const [activeDocument, setActiveDocument] = useState(null);
  const [documentTaskSearch, setDocumentTaskSearch] = useState('');
  const [pendingDocumentTask, setPendingDocumentTask] = useState(null);
  const [documentReviewEditDialogOpen, setDocumentReviewEditDialogOpen] = useState(false);
  const [documentReviewEditMode, setDocumentReviewEditMode] = useState('type');
  const [documentReviewEditForm, setDocumentReviewEditForm] = useState({ value: '' });
  const [savingDocumentReviewEdit, setSavingDocumentReviewEdit] = useState(false);
  // Material dialog state
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [materialForm, setMaterialForm] = useState({
    name: '',
    package_name: '',
    supplier: '',
    is_required: true,
    is_long_lead: false,
    order_lead_time_days: '',
    delivery_buffer_days: '',
    status: 'required',
  });

  // Delay dialog state
  const [delayDialogOpen, setDelayDialogOpen] = useState(false);
  const [savingDelay, setSavingDelay] = useState(false);
  const [delayForm, setDelayForm] = useState({
    task_id: '',
    delay_type: 'main_contractor',
    delay_days: '',
    description: '',
    caused_by: '',
    impact_description: '',
  });


  const fetchJobData = useCallback(async () => {
    try {
      const [jobRes, tasksRes, codesRes, subsRes, delaysRes, programmeRes, documentsRes, unmatchedRes, analysisRes] = await Promise.all([
        api.get(`/jobs/${jobId}`),
        api.get(`/tasks?job_id=${jobId}`),
        api.get(`/jobs/${jobId}/task-codes`),
        api.get('/subcontractors'),
        api.get(`/delays?job_id=${jobId}`),
        api.get(`/jobs/${jobId}/programme`),
        api.get(`/jobs/${jobId}/files`),
        api.get(`/jobs/${jobId}/unmatched-labour`),
        api.post(`/jobs/${jobId}/analyze`),
      ]);
      console.log('JOBDETAIL tasksRes.data =', tasksRes.data);
      setJob(jobRes.data);
      setTasks(Array.isArray(tasksRes.data) ? tasksRes.data : (tasksRes.data?.value || []));
      setTaskCodes(codesRes.data);
      setSubcontractors(subsRes.data);
      setDelays(delaysRes.data);
      setProgramme(programmeRes.data);
      setDocuments(Array.isArray(documentsRes.data) ? documentsRes.data : []);
      setAnalysis(analysisRes.data || jobRes.data?.latest_analysis || null);
      setUnmatchedLabour(unmatchedRes.data.rows || []);
      
    } catch (error) {
      toast.error('Failed to load job details');
    } finally {
      setLoading(false);
    }
  }, [jobId]);


  useEffect(() => {
    fetchJobData();
  }, [fetchJobData]);

  const handleGenerateTasksFromProgramme = async () => {
    try {
      const response = await api.post(`/jobs/${jobId}/programme/generate-tasks`);
      toast.success(response.data?.message || 'Tasks generated from programme');
      fetchJobData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate tasks from programme');
    }
  };

    const handleUploadDocuments = async (event) => {
    const input = event.target;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));

    setUploadingDocs(true);
    try {
      const response = await api.post(`/jobs/${jobId}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      toast.success(response.data?.message || 'Documents uploaded');
      input.value = '';
      fetchJobData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload documents');
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleAnalyzeDocuments = async () => {
    setAnalyzingDocs(true);
    try {
      const response = await api.post(`/jobs/${jobId}/analyze`);
      setAnalysis(response.data || null);
      toast.success('Documents analyzed');
      fetchJobData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to analyze documents');
    } finally {
      setAnalyzingDocs(false);
    }
  };

  const handleUpdateDocumentReview = async (fileId, payload) => {
    try {
      const response = await api.put(`/jobs/${jobId}/files/${fileId}/review`, payload);
      setDocuments((prev) => prev.map((doc) => (doc.id === fileId ? response.data : doc)));
      toast.success('Document review updated');
      return response.data;
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update document review');
      return null;
    }
  };

  const openDocumentActionDialog = (doc) => {
    setActiveDocument(doc);
    setDocumentTaskSearch('');
    setDocumentActionDialogOpen(true);
  };

  const openDocumentReviewEditDialog = (doc, mode) => {
    setActiveDocument(doc);
    setDocumentReviewEditMode(mode);
    setDocumentReviewEditForm({
      value: mode === 'type' ? doc.detected_document_type || '' : doc.mapping_notes || '',
    });
    setDocumentReviewEditDialogOpen(true);
  };

  const closeDocumentReviewEditDialog = () => {
    setDocumentReviewEditDialogOpen(false);
    setActiveDocument(null);
    setDocumentReviewEditForm({ value: '' });
  };

  const handleSaveDocumentReviewEdit = async () => {
    if (!activeDocument) return;

    setSavingDocumentReviewEdit(true);
    try {
      const cleanValue = documentReviewEditForm.value.trim();
      const payload =
        documentReviewEditMode === 'type'
          ? { detected_document_type: cleanValue || null }
          : { mapping_notes: cleanValue || null };

      const updatedDocument = await handleUpdateDocumentReview(activeDocument.id, payload);
      if (updatedDocument) {
        closeDocumentReviewEditDialog();
      }
    } finally {
      setSavingDocumentReviewEdit(false);
    }
  };

  const handleLinkDocumentToTask = async (fileId, presetTaskId = null) => {
    const cleanTaskId = presetTaskId ? String(presetTaskId).split('|')[0].trim() : '';

    if (!cleanTaskId) return;

    try {
      const response = await api.post(`/tasks/${cleanTaskId}/files/${fileId}/link`);
      setTasks((prev) => prev.map((task) => (task.id === cleanTaskId ? response.data : task)));
      await handleUpdateDocumentReview(fileId, { needs_review: false });
      setDocumentActionDialogOpen(false);
      setActiveDocument(null);
      setDocumentTaskSearch('');
      openTaskDetail(response.data);
      toast.success('Document linked to task');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to link document to task');
    }
  };

  const handleUnlinkDocumentFromTask = async (taskId, fileId) => {
    try {
      const response = await api.delete(`/tasks/${taskId}/files/${fileId}/link`);
      const nextTasks = tasks.map((task) => (task.id === taskId ? response.data : task));
      setTasks(nextTasks);

      const stillLinkedElsewhere = nextTasks.some(
        (task) => (task.linked_file_ids || []).includes(fileId)
      );

      if (!stillLinkedElsewhere) {
        await handleUpdateDocumentReview(fileId, { needs_review: true });
      }

      toast.success('Document unlinked from task');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to unlink document from task');
    }
  };


  const handleCreateTaskFromDocument = (doc) => {
    setPendingDocumentTask(doc);
    setEditingTask(null);
    setTaskForm({
      task_name: doc.detected_document_type
        ? `${doc.detected_document_type} - review required`
        : `${doc.original_filename || doc.filename || 'Document'} - review required`,
      task_type: 'document_proposed',
      linked_task_codes: [],
      planned_start: '',
      planned_finish: '',
      actual_start: '',
      duration_days: '',
      owner_party: '',
      is_internal: true,
      subcontractor_id: '',
      zone_area: '',
      level: '',
      package: doc.detected_document_type || '',
      contract: '',
      status: 'planned',
      rag_status: 'amber',
      notes: doc.mapping_notes || 'Created from document review',
      interface_prompt: '',
      hold_point: '',
      gain_note: '',
      snapshot_note: '',
      quoted_hours: '',
      is_long_lead: false,
      earliest_possible_start: '',
      manual_start_override: '',
      rounded_crew: '',
      actual_hours: '',
      percent_complete: '0',
    });
    setDocumentActionDialogOpen(false);
    setActiveDocument(null);
    setDocumentTaskSearch('');
    setTaskDialogOpen(true);
  };



const fetchTaskMaterials = async (taskId) => {
    setLoadingMaterials(true);
    try {
      const response = await api.get(`/materials?task_id=${taskId}`);
      setTaskMaterials(response.data);
    } catch (error) {
      toast.error('Failed to load materials');
    } finally {
      setLoadingMaterials(false);
    }
  };

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    fetchTaskMaterials(task.id);
  };

  const closeTaskDetail = () => {
    setSelectedTask(null);
    setTaskMaterials([]);
  };

  // Task form handlers
  const resetTaskForm = () => {
    setTaskForm({
      task_name: '',
      task_type: '',
      linked_task_codes: [],
      planned_start: '',
      planned_finish: '',
      actual_start: '',
      duration_days: '',
      owner_party: '',
      is_internal: true,
      subcontractor_id: '',
      zone_area: '',
    level: '',
    package: '',
    contract: '',
      status: 'planned',
    rag_status: '',
      notes: '',
    interface_prompt: '',
    hold_point: '',
    gain_note: '',
    snapshot_note: '',
      quoted_hours: '',
    is_long_lead: false,
    earliest_possible_start: '',
    manual_start_override: '',
    rounded_crew: '',
      actual_hours: '',
      percent_complete: '0',
    });
    setEditingTask(null);
    setPendingDocumentTask(null);
  };

  const openTaskDialog = (task = null) => {
    if (task) {
      setEditingTask(task);
      setTaskForm({
        task_name: task.task_name,
        task_type: task.task_type || '',
        linked_task_codes: task.linked_task_codes || [],
        planned_start: task.planned_start || '',
        planned_finish: task.planned_finish || '',
          actual_start: task.actual_start || '',
        duration_days: task.duration_days?.toString() || '',
        owner_party: task.owner_party || '',
        is_internal: task.is_internal,
        subcontractor_id: task.subcontractor_id || '',
        zone_area: task.zone_area || '',
        level: task.level || '',
        package: task.package || '',
        contract: task.contract || '',
        status: task.status,
        rag_status: task.rag_status || '',
        notes: task.notes || '',
        interface_prompt: task.interface_prompt || '',
        hold_point: task.hold_point || '',
        gain_note: task.gain_note || '',
        snapshot_note: task.snapshot_note || '',
        quoted_hours: task.quoted_hours?.toString() || '',
        is_long_lead: task.is_long_lead || false,
        earliest_possible_start: task.earliest_possible_start || '',
        manual_start_override: task.manual_start_override || '',
        rounded_crew: task.rounded_crew?.toString() || '',
          actual_hours: task.actual_hours?.toString() || '',
          percent_complete: task.percent_complete?.toString() || '0',
      });
    } else {
      resetTaskForm();
    }
    setTaskDialogOpen(true);
  };

  const handleSaveTask = async (e) => {
    e.preventDefault();
    setSavingTask(true);
    
    const payload = {
      job_id: jobId,
      task_name: taskForm.task_name,
      task_type: taskForm.task_type || null,
      linked_task_codes: taskForm.linked_task_codes,
      planned_start: taskForm.planned_start || null,
      planned_finish: taskForm.planned_finish || null,
      actual_start: taskForm.actual_start || null,
      duration_days: taskForm.duration_days ? parseInt(taskForm.duration_days) : null,
      owner_party: taskForm.owner_party || null,
      is_internal: taskForm.is_internal,
      subcontractor_id: !taskForm.is_internal && taskForm.subcontractor_id ? taskForm.subcontractor_id : null,
      zone_area: taskForm.zone_area || null,
      level: taskForm.level || null,
      package: taskForm.package || null,
      contract: taskForm.contract || null,
      status: taskForm.status,
      rag_status: taskForm.rag_status || null,
      notes: taskForm.notes || null,
      interface_prompt: taskForm.interface_prompt || null,
      hold_point: taskForm.hold_point || null,
      gain_note: taskForm.gain_note || null,
      snapshot_note: taskForm.snapshot_note || null,
      quoted_hours: taskForm.quoted_hours ? parseFloat(taskForm.quoted_hours) : null,
      is_long_lead: !!taskForm.is_long_lead,
      earliest_possible_start: taskForm.earliest_possible_start || null,
      manual_start_override: taskForm.manual_start_override || null,
      rounded_crew: taskForm.rounded_crew ? parseInt(taskForm.rounded_crew) : null,
      actual_hours: taskForm.actual_hours ? parseFloat(taskForm.actual_hours) : 0,
      percent_complete: taskForm.percent_complete ? parseInt(taskForm.percent_complete) : 0,
    };

    if (!editingTask && pendingDocumentTask) {
      payload.linked_file_ids = [pendingDocumentTask.id];
    }

    try {
      if (editingTask) {
        const response = await api.put(`/tasks/${editingTask.id}`, payload);
        setTasks(tasks.map(t => t.id === editingTask.id ? response.data : t));
        toast.success('Task updated');
      } else {
        const response = await api.post('/tasks', payload);
        setTasks((prev) => [...prev, response.data]);

        if (pendingDocumentTask) {
          await handleUpdateDocumentReview(pendingDocumentTask.id, { needs_review: false });
          openTaskDetail(response.data);
          toast.success('Proposed task created from document');
        } else {
          toast.success('Task created');
        }
      }
      setTaskDialogOpen(false);
      resetTaskForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save task');
    } finally {
      setSavingTask(false);
    }
  };

  // Material form handlers
  const resetMaterialForm = () => {
    setMaterialForm({
      name: '',
      package_name: '',
      supplier: '',
      is_required: true,
      is_long_lead: false,
      order_lead_time_days: '',
      delivery_buffer_days: '',
      status: 'required',
    });
  };

  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    
    setSavingMaterial(true);
    
    const payload = {
      task_id: selectedTask.id,
      name: materialForm.name,
      package_name: materialForm.package_name || null,
      supplier: materialForm.supplier || null,
      is_required: materialForm.is_required,
      is_long_lead: materialForm.is_long_lead,
      order_lead_time_days: materialForm.order_lead_time_days ? parseInt(materialForm.order_lead_time_days) : null,
      delivery_buffer_days: materialForm.delivery_buffer_days ? parseInt(materialForm.delivery_buffer_days) : null,
      status: materialForm.status,
    };

    try {
      const response = await api.post('/materials', payload);
      setTaskMaterials([...taskMaterials, response.data]);
      toast.success('Material added');
      setMaterialDialogOpen(false);
      resetMaterialForm();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add material');
    } finally {
      setSavingMaterial(false);
    }
  };

  const updateMaterialStatus = async (materialId, newStatus) => {
    const material = taskMaterials.find(m => m.id === materialId);
    if (!material) return;

    try {
      const payload = {
        task_id: material.task_id,
        name: material.name,
        package_name: material.package_name,
        supplier: material.supplier,
        is_required: material.is_required,
        is_long_lead: material.is_long_lead,
        order_lead_time_days: material.order_lead_time_days,
        delivery_buffer_days: material.delivery_buffer_days,
        status: newStatus,
      };
      
      const response = await api.put(`/materials/${materialId}`, payload);
      setTaskMaterials(taskMaterials.map(m => m.id === materialId ? response.data : m));
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const toggleTaskCode = (codeId) => {
    setTaskForm(prev => ({
      ...prev,
      linked_task_codes: prev.linked_task_codes.includes(codeId)
        ? prev.linked_task_codes.filter(c => c !== codeId)
        : [...prev.linked_task_codes, codeId]
    }));
  };

  const getStatusBadge = (status) => {
    const variants = {
      active: 'default',
      completed: 'secondary',
      complete: 'secondary',
      on_hold: 'outline',
      planned: 'secondary',
      blocked: 'destructive',
      delayed: 'warning',
      at_risk: 'warning',
      on_track: 'success',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status?.replace('_', ' ')}</Badge>;
  };

  const getMaterialStatusBadge = (status) => {
    const config = MATERIAL_STATUSES.find(s => s.value === status);
    return <Badge variant={config?.color || 'secondary'}>{config?.label || status}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold">Job not found</h2>
        <Link to="/jobs" className="mt-4 inline-block">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Previous
          </Button>
        </Link>
      </div>
    );
  }

  const getTaskActual = (task) => parseFloat(task.actual_hours || 0);
  const getTaskPlanned = (task) => parseFloat(task.quoted_hours || 0);
  const normalizeMatchText = (value) =>
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

  const getSuggestedTasksForDocument = (doc) => {
    const sourceText = normalizeMatchText(
      [
        doc.original_filename,
        doc.filename,
        doc.name,
        doc.detected_document_type,
        doc.mapping_notes,
      ]
        .filter(Boolean)
        .join(' ')
    );

    if (!sourceText) return [];

    const sourceWords = Array.from(
      new Set(sourceText.split(' ').filter((word) => word.length >= 3))
    );

    return tasks
      .map((task) => {
        const taskText = normalizeMatchText(
          [
            task.task_name,
            task.zone_area,
            task.level,
            task.package,
            task.contract,
            task.task_type,
          ]
            .filter(Boolean)
            .join(' ')
        );

        let score = 0;

        sourceWords.forEach((word) => {
          if (taskText.includes(word)) {
            score += word.length >= 6 ? 2 : 1;
          }
        });

        if (
          doc.detected_document_type &&
          task.package &&
          normalizeMatchText(task.package).includes(normalizeMatchText(doc.detected_document_type))
        ) {
          score += 3;
        }

        return {
          ...task,
          _matchScore: score,
        };
      })
      .filter((task) => task._matchScore > 0)
      .sort((a, b) => b._matchScore - a._matchScore)
      .slice(0, 3);
  };

  const isDocumentLinkedToTask = (doc) =>
    tasks.some((task) => (task.linked_file_ids || []).includes(doc.id));

  const getDocumentWorkflowStatus = (doc) => {
    if (doc.needs_review) return 'Review Queue';
    if (isDocumentLinkedToTask(doc)) return 'Linked';
    return 'Ready / Reviewed';
  };

  const getDocumentWorkflowRank = (doc) => {
    if (doc.needs_review) return 0;
    if (isDocumentLinkedToTask(doc)) return 2;
    return 1;
  };

  const documentWorkflowCounts = documents.reduce(
    (acc, doc) => {
      if (doc.needs_review) {
        acc.reviewQueue += 1;
      } else if (isDocumentLinkedToTask(doc)) {
        acc.linked += 1;
      } else {
        acc.ready += 1;
      }
      return acc;
    },
    { reviewQueue: 0, ready: 0, linked: 0 }
  );

  const orderedDocuments = [...documents].sort((a, b) => {
    const rankDiff = getDocumentWorkflowRank(a) - getDocumentWorkflowRank(b);
    if (rankDiff !== 0) return rankDiff;

    const aTime = a.uploaded_at ? new Date(a.uploaded_at).getTime() : 0;
    const bTime = b.uploaded_at ? new Date(b.uploaded_at).getTime() : 0;
    return bTime - aTime;
  });

  const getTaskVariance = (task) => getTaskActual(task) - getTaskPlanned(task);
  const completedTasks = tasks.filter(t => t.status === 'complete').length;
  const taskProgress = tasks.length > 0 ? (completedTasks / tasks.length) * 100 : 0;
  const unmatchedLabourCount = unmatchedLabour.length;
  const unmatchedLabourHours = unmatchedLabour.reduce((sum, row) => sum + (parseFloat(row.hours) || 0), 0);

  return (
    <div className="space-y-6" data-testid="job-detail-page">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <Link to="/jobs" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Previous
        </Link>
        
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-lg text-muted-foreground">{job.job_number}</span>
              {getStatusBadge(job.status)}
            </div>
            <h1 className="text-3xl font-bold font-['Manrope']">{job.job_name}</h1>
          </div>
          
          {canManage() && (
              <div className="flex gap-2 flex-wrap">
                <Link to={`/jobs/${jobId}/programmes`}>
                  <Button variant="outline">
                    Programmes
                  </Button>
                </Link>
                <Link to={`/jobs/${jobId}/gantt`}>
                  <Button variant="outline">
                    Gantt
                  </Button>
                </Link>
                <Link to={`/resource-analysis/${jobId}`}>
                  <Button variant="outline">
                    Resource Analysis
                  </Button>
                </Link>
                <Link to={`/jobs/${jobId}/setup`}>
                  <Button variant="outline">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Analyze
                  </Button>
                </Link>
                <Button variant="outline" onClick={() => { window.location.href = `/jobs/${jobId}/setup?step=0`; }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit Job
                </Button>
              </div>
            )}
        </div>
      </div>

      {/* Job Info Cards */}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        {job.main_contractor && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Main Contractor</p>
                  <p className="font-medium">{job.main_contractor}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {job.site_address && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Site Address</p>
                  <p className="font-medium">{job.site_address}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {job.planned_start && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Start Date</p>
                  <p className="font-medium">{new Date(job.planned_start).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {job.planned_finish && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">End Date</p>
                  <p className="font-medium">{new Date(job.planned_finish).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Progress Overview */}
      {(unmatchedLabourCount > 0 || unmatchedLabourHours > 0) && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Unmatched Labour</CardTitle>
            <CardDescription>Imported labour not yet linked to a task</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-amber-500/10">
                <p className="font-data text-xl font-bold text-amber-600">{unmatchedLabourCount}</p>
                <p className="text-xs text-muted-foreground">Unmatched Rows</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-amber-500/10">
                <p className="font-data text-xl font-bold text-amber-600">{unmatchedLabourHours.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Unmatched Hours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Progress Overview</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-sm mb-1.5">
                <span>Task Completion</span>
                <span className="font-medium">{completedTasks} / {tasks.length} tasks</span>
              </div>
              <Progress value={taskProgress} className="h-2" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
              <div className="text-center p-3 rounded-lg border bg-muted/30">
                <p className="font-data text-xl font-bold">{tasks.length}</p>
                <p className="text-xs text-muted-foreground">Total Tasks</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-green-500/10">
                <p className="font-data text-xl font-bold text-green-600">{completedTasks}</p>
                <p className="text-xs text-muted-foreground">Completed</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-blue-500/10">
                <p className="font-data text-xl font-bold text-blue-600">{tasks.filter(t => t.status === 'active').length}</p>
                <p className="text-xs text-muted-foreground">In Progress</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-red-500/10">
                <p className="font-data text-xl font-bold text-red-600">{tasks.filter(t => t.status === 'blocked').length}</p>
                <p className="text-xs text-muted-foreground">Blocked</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      {/* ============================= */}
      {/* LD RISK DASHBOARD */}
      {/* ============================= */}

      {analysis?.ld_risk && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">LD Risk Overview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className="bg-red-50 border border-red-200 rounded p-4">
                <h3 className="font-semibold text-red-700 mb-1">High Risk</h3>
                <p className="text-xs text-red-600 mb-3">
                  {analysis.ld_risk.summary.high_risk_count} items
                </p>
                <div className="space-y-1 text-xs max-h-40 overflow-auto">
                  {analysis.ld_risk.high_risk_tasks.slice(0,10).map((t,i)=>(
                    <div key={i} className="border-b border-red-100 pb-1">
                      {t.description?.replace(/^\*\s*/,"")}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded p-4">
                <h3 className="font-semibold text-yellow-700 mb-1">External</h3>
                <p className="text-xs text-yellow-700 mb-3">
                  {analysis.ld_risk.summary.external_dependency_count} items
                </p>
                <div className="space-y-1 text-xs max-h-40 overflow-auto">
                  {analysis.ld_risk.external_dependencies.slice(0,10).map((t,i)=>(
                    <div key={i} className="border-b border-yellow-100 pb-1">
                      {t.description?.replace(/^\*\s*/,"")}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded p-4">
                <h3 className="font-semibold mb-2">Contract Split</h3>
                <div className="text-sm space-y-2">
                  <div className="flex justify-between">
                    <span>Fitout</span>
                    <span className="font-semibold">{analysis.contract_split.fitout.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Base Build</span>
                    <span className="font-semibold">{analysis.contract_split.base_build.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shared</span>
                    <span className="font-semibold">{analysis.contract_split.shared.length}</span>
                  </div>
                </div>
              </div>

            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs for Details */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList>
          <TabsTrigger value="tasks" className="flex items-center gap-2">
            <ListTodo className="h-4 w-4" />
            Tasks ({tasks.length})
          </TabsTrigger>
          <TabsTrigger value="documents" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Documents ({documents.length})
          </TabsTrigger>
          <TabsTrigger value="programme" className="flex items-center gap-2">            <Calendar className="h-4 w-4" />            Programme ({programme.length})          </TabsTrigger>          <TabsTrigger value="codes" className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4" />
            Task Codes ({taskCodes.length})
          </TabsTrigger>
          <TabsTrigger value="delays" className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Delays ({delays.filter(d => !d.resolved).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Document Intake + Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canManage() && (
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center">
                    <Input type="file" multiple onChange={handleUploadDocuments} />
                    <Button onClick={handleAnalyzeDocuments} disabled={analyzingDocs || uploadingDocs}>
                      {analyzingDocs ? 'Analyzing...' : 'Analyze Documents'}
                    </Button>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Latest analysis: {job?.latest_analysis_status || analysis?.status || 'Not run'}
                  </div>
                </div>
              )}

              {documents.length > 0 && (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <div className="rounded-lg border p-3">
                    <div className="text-xs font-medium text-muted-foreground">Review Queue</div>
                    <div className="text-2xl font-semibold">{documentWorkflowCounts.reviewQueue}</div>
                    <div className="text-xs text-muted-foreground">Needs review or decision</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs font-medium text-muted-foreground">Ready / Reviewed</div>
                    <div className="text-2xl font-semibold">{documentWorkflowCounts.ready}</div>
                    <div className="text-xs text-muted-foreground">Reviewed but not linked yet</div>
                  </div>
                  <div className="rounded-lg border p-3">
                    <div className="text-xs font-medium text-muted-foreground">Linked</div>
                    <div className="text-2xl font-semibold">{documentWorkflowCounts.linked}</div>
                    <div className="text-xs text-muted-foreground">Connected to task control</div>
                  </div>
                </div>
              )}

              {documents.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No documents uploaded yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {orderedDocuments.map((doc) => (
                    <Card key={doc.id}>
                      <CardContent className="pt-4 space-y-2">
                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="font-medium">
                              {doc.original_filename || doc.filename || doc.name || 'Document'}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Uploaded {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleString() : '-'}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline">{doc.parse_status || 'unknown'}</Badge>
                            {doc.reference_only && <Badge variant="secondary">Reference only</Badge>}
                            {doc.needs_review && <Badge variant="destructive">Needs review</Badge>}
                            {doc.detected_document_type && (
                              <Badge variant="outline">{doc.detected_document_type}</Badge>
                            )}
                            <Badge variant="secondary">{getDocumentWorkflowStatus(doc)}</Badge>
                          </div>
                        </div>

                        {canManage() && (
                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-md border p-3 space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">1. Review step</div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdateDocumentReview(doc.id, { needs_review: false })}
                                >
                                  Mark Reviewed
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdateDocumentReview(doc.id, { reference_only: !doc.reference_only })}
                                >
                                  {doc.reference_only ? 'Unset Reference Only' : 'Set Reference Only'}
                                </Button>
                              </div>
                            </div>

                            <div className="rounded-md border p-3 space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">2. Classify use</div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdateDocumentReview(doc.id, { use_for_programme: !doc.use_for_programme })}
                                >
                                  {doc.use_for_programme ? 'Unset Programme Use' : 'Use for Programme'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUpdateDocumentReview(doc.id, { use_for_scope: !doc.use_for_scope })}
                                >
                                  {doc.use_for_scope ? 'Unset Scope Use' : 'Use for Scope'}
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDocumentReviewEditDialog(doc, 'type')}
                                >
                                  Set Type
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDocumentReviewEditDialog(doc, 'notes')}
                                >
                                  Add Mapping Note
                                </Button>
                              </div>
                            </div>

                            <div className="rounded-md border p-3 space-y-2">
                              <div className="text-xs font-medium text-muted-foreground">3. Link / create task</div>
                              <div className="flex flex-wrap gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDocumentActionDialog(doc)}
                                >
                                  Link to Task
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => openDocumentActionDialog(doc)}
                                >
                                  Create Proposed Task
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}


                        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                        </div>

                        {Array.isArray(doc.warnings) && doc.warnings.length > 0 && (
                          <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3">
                            <div className="text-xs font-medium text-yellow-800 mb-1">Warnings</div>
                            <ul className="text-xs text-yellow-700 space-y-1 list-disc pl-4">
                              {doc.warnings.map((warning, index) => (
                                <li key={`${doc.id}-warning-${index}`}>{warning}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground">OCR:</span>{' '}
                            <span>{doc.ocr_status || '-'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Review:</span>{' '}
                            <span>{doc.needs_review ? 'Pending' : 'Reviewed'}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Use:</span>{' '}
                            <span>{doc.reference_only ? 'Reference only' : 'Programme / scope candidate'}</span>
                          </div>
                        </div>

                        {tasks.filter(task => (task.linked_file_ids || []).includes(doc.id)).length > 0 && (
                          <div className="rounded-md border bg-muted/30 p-3">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Linked to Tasks
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {tasks
                                .filter(task => (task.linked_file_ids || []).includes(doc.id))
                                .map(task => (
                                  <div key={`${doc.id}-linked-${task.id}`} className="flex items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => openTaskDetail(task)}
                                    >
                                      Open Task: {task.task_name}
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleUnlinkDocumentFromTask(task.id, doc.id)}
                                    >
                                      Unlink Task
                                    </Button>
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}

                        {getSuggestedTasksForDocument(doc).length > 0 && (
                          <div className="rounded-md border bg-muted/30 p-3">
                            <div className="text-xs font-medium text-muted-foreground mb-2">
                              Suggested Matches
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {getSuggestedTasksForDocument(doc).map((task) => (
                                <Button
                                  key={`${doc.id}-suggested-${task.id}`}
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleLinkDocumentToTask(doc.id, task.id)}
                                >
                                  {task.task_name}
                                </Button>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="programme" className="space-y-4">
          {canManage() && programme.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={handleGenerateTasksFromProgramme}>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Tasks from Programme
              </Button>
            </div>
          )}
          {programme.length > 0 && (
            <Card>
              <CardContent className="pt-6">
                <div className="mb-4">
                  <h3 className="text-sm font-medium">Programme Timeline</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Simple relative timeline based on programme order and duration
                  </p>
                </div>

                <div className="space-y-3">
                  {(() => {
                    let runningDay = 0;
                    const totalDays = Math.max(
                      programme.reduce((sum, item) => sum + (Number(item.duration) || 1), 0),
                      1
                    );

                    return programme.map((item, index) => {
                      const duration = Number(item.duration) || 1;
                      const start = runningDay;
                      runningDay += duration;

                      const leftPct = (start / totalDays) * 100;
                      const widthPct = Math.max((duration / totalDays) * 100, 4);

                      return (
                        <div key={`gantt-${item.id || index}`} className="space-y-1">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-medium truncate">
                              {index + 1}. {item.name}
                            </div>
                            <div className="text-xs text-muted-foreground whitespace-nowrap">
                              {duration} {item.duration_unit || 'days'}
                            </div>
                          </div>

                          <div className="relative h-6 rounded-md bg-muted overflow-hidden">
                            <div
                              className="absolute top-0 h-6 rounded-md bg-primary/80 text-primary-foreground text-[10px] flex items-center px-2 whitespace-nowrap"
                              style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                            >
                              {item.phase || item.trade || 'Task'}
                            </div>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardContent>
            </Card>
          )}
          {programme.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                No programme defined for this job
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-3">
                  {programme.map((item, index) => (
                    <div key={item.id} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center">
                        <div className="font-medium">
                          {index + 1}. {item.name}
                        </div>
                        {item.confidence && (
                          <Badge variant="outline">
                            {item.confidence}
                          </Badge>
                        )}
                      </div>

                      <div className="text-sm text-muted-foreground mt-1">
                        {item.phase && `${item.phase} â€¢ `}
                        {item.trade && `${item.trade} â€¢ `}
                        {item.duration && `${item.duration} ${item.duration_unit}`}
                      </div>

                      {item.depends_on?.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Depends on: {item.depends_on.join(", ")}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="tasks" className="space-y-4">
          {/* Add Task Button */}
          {canManage() && (
            <div className="flex justify-end">
              <Button onClick={() => openTaskDialog()} data-testid="add-task-btn">
                <Plus className="mr-2 h-4 w-4" />
                Add Task
              </Button>
            </div>
          )}

          {tasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListTodo className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No tasks yet</h3>
                <p className="text-muted-foreground text-center mt-2">
                  Create tasks to track work for this job
                </p>
                {canManage() && (
                  <Button onClick={() => openTaskDialog()} className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Task
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => (
                <Card 
                  key={task.id} 
                  className="card-hover cursor-pointer" 
                  onClick={() => openTaskDetail(task)}
                  data-testid={`task-${task.id}`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-medium truncate">{task.task_name}</h3>
                          {getStatusBadge(task.status)}
                          {task.is_critical && (
                            <Badge variant="destructive" className="text-xs">Critical</Badge>
                          )}
                          {task.is_internal ? (
                            <Badge variant="outline" className="text-xs">Internal</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Subcontractor</Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {task.planned_start && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(task.planned_start).toLocaleDateString()}
                            </span>
                          )}
                          {task.duration_days && (
                            <span>{task.duration_days} days</span>
                          )}
                          {task.quoted_hours && (
                            <span>{task.quoted_hours}h quoted</span>
                          )}
                          <>
                            <span>Planned: {getTaskPlanned(task).toFixed(2)}h</span>
                            <span>Actual: {getTaskActual(task).toFixed(2)}h</span>
                            <span className={getTaskVariance(task) > 0 ? "text-red-600 font-medium" : getTaskVariance(task) < 0 ? "text-green-600 font-medium" : ""}>
                              Variance: {getTaskVariance(task) > 0 ? "+" : ""}{getTaskVariance(task).toFixed(2)}h
                            </span>
                          </>
                          {task.linked_task_codes?.length > 0 && (
                            <span className="flex items-center gap-1">
                              <ClipboardList className="h-3 w-3" />
                              {task.linked_task_codes.length} codes
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {task.percent_complete > 0 && (
                          <div className="text-right">
                            <span className="font-data text-lg font-bold">{task.percent_complete}%</span>
                          </div>
                        )}
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="codes" className="space-y-4">
          {taskCodes.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ClipboardList className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium">No task codes assigned</h3>
                <p className="text-muted-foreground text-center mt-2">
                  Task codes are auto-assigned when jobs are created
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {taskCodes.map((code) => (
                <Card key={code.id} data-testid={`code-${code.code}`}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-mono font-bold">{code.code}</span>
                        <p className="text-sm text-muted-foreground mt-1">
                          {code.custom_label || code.name}
                        </p>
                      </div>
                      <Badge variant={code.is_active ? 'default' : 'secondary'}>
                        {code.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="delays" className="space-y-4">
          {/* Add Delay Button */}
          {canManage() && tasks.length > 0 && (
            <div className="flex justify-end">
              <Button onClick={() => setDelayDialogOpen(true)} variant="outline" data-testid="add-delay-btn">
                <AlertTriangle className="mr-2 h-4 w-4" />
                Record Delay
              </Button>
            </div>
          )}

          {delays.filter(d => !d.resolved).length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="h-12 w-12 text-green-500/50 mb-4" />
                <h3 className="text-lg font-medium">No active delays</h3>
                <p className="text-muted-foreground text-center mt-2">
                  All tasks are on track
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {delays.filter(d => !d.resolved).map((delay) => (
                <Card key={delay.id} className="border-l-4 border-l-orange-500" data-testid={`delay-${delay.id}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-500" />
                          <span className="font-medium">{delay.task_name}</span>
                          <Badge variant="outline">{DELAY_TYPES.find(t => t.value === delay.delay_type)?.label}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{delay.description}</p>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {delay.delay_days} days delay
                          </span>
                          {delay.caused_by && (
                            <span>Caused by: {delay.caused_by}</span>
                          )}
                          {delay.affected_tasks?.length > 0 && (
                            <span className="text-orange-600">{delay.affected_tasks.length} downstream tasks affected</span>
                          )}
                        </div>
                      </div>
                      {canManage() && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={async () => {
                            try {
                              await api.post(`/delays/${delay.id}/resolve`);
                              setDelays(delays.map(d => d.id === delay.id ? {...d, resolved: true} : d));
                              fetchJobData(); // Refresh tasks too
                              toast.success('Delay resolved');
                            } catch (e) {
                              toast.error('Failed to resolve delay');
                            }
                          }}
                        >
                          <CheckCircle className="mr-1 h-3 w-3" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Resolved Delays */}
          {delays.filter(d => d.resolved).length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">Resolved Delays</h3>
              <div className="space-y-2">
                {delays.filter(d => d.resolved).map((delay) => (
                  <Card key={delay.id} className="opacity-60">
                    <CardContent className="p-3">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-500" />
                        <span className="line-through">{delay.task_name}</span>
                        <span className="text-muted-foreground">- {delay.delay_days} days ({delay.delay_type})</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Task Creation/Edit Dialog */}
      <Dialog open={taskDialogOpen} onOpenChange={(open) => { setTaskDialogOpen(open); if (!open) resetTaskForm(); }}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <form onSubmit={handleSaveTask}>
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
              <DialogDescription>
                {editingTask ? 'Update task details' : 'Add a new task to this job'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Task Name *</Label>
                <Input
                  value={taskForm.task_name}
                  onChange={(e) => setTaskForm({ ...taskForm, task_name: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Install partition walls Level 2"
                  required
                  data-testid="task-name-input"
                />
              </div>
              
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Type</Label>
                <Input
                  value={taskForm.task_type}
                  onChange={(e) => setTaskForm({ ...taskForm, task_type: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Installation, Finishing"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Zone/Area</Label>
                <Input
                  value={taskForm.zone_area}
                  onChange={(e) => setTaskForm({ ...taskForm, zone_area: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Level 2, North Wing"
                />
              </div>

              

                <div className="col-span-4 pt-2">
                  <div className="rounded-lg border p-4 space-y-4">
                    <div>
                      <h4 className="font-medium">Planning Controls</h4>
                      <p className="text-sm text-muted-foreground">
                        Live planning fields for status, gain, interface, and reporting
                      </p>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label>Level</Label>
                        <Input
                          value={taskForm.level}
                          onChange={(e) => setTaskForm({ ...taskForm, level: e.target.value })}
                          placeholder="e.g. L4"
                        />
                      </div>

                      <div>
                        <Label>Package</Label>
                        <Input
                          value={taskForm.package}
                          onChange={(e) => setTaskForm({ ...taskForm, package: e.target.value })}
                          placeholder="e.g. Steel Stud Partitions"
                        />
                      </div>

                      <div>
                        <Label>Contract</Label>
                        <Input
                          value={taskForm.contract}
                          onChange={(e) => setTaskForm({ ...taskForm, contract: e.target.value })}
                          placeholder="e.g. Fitout"
                        />
                      </div>

                      <div>
                        <Label>RAG Status</Label>
                        <Select
                          value={taskForm.rag_status || "none"}
                          onValueChange={(value) => setTaskForm({ ...taskForm, rag_status: value === "none" ? "" : value })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">None</SelectItem>
                            <SelectItem value="green">Green</SelectItem>
                            <SelectItem value="amber">Amber</SelectItem>
                            <SelectItem value="red">Red</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-4">
                      <div>
                        <Label>Earliest Possible Start</Label>
                        <Input
                          type="date"
                          value={taskForm.earliest_possible_start}
                          onChange={(e) => setTaskForm({ ...taskForm, earliest_possible_start: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label>Manual Start Override</Label>
                        <Input
                          type="date"
                          value={taskForm.manual_start_override}
                          onChange={(e) => setTaskForm({ ...taskForm, manual_start_override: e.target.value })}
                        />
                      </div>

                      <div>
                        <Label>Rounded Crew</Label>
                        <Input
                          type="number"
                          value={taskForm.rounded_crew}
                          onChange={(e) => setTaskForm({ ...taskForm, rounded_crew: e.target.value })}
                          placeholder="0"
                        />
                      </div>

                      <div className="flex items-end gap-2 pb-2">
                        <Checkbox
                          checked={!!taskForm.is_long_lead}
                          onCheckedChange={(checked) => setTaskForm({ ...taskForm, is_long_lead: !!checked })}
                        />
                        <span className="text-sm text-muted-foreground">Long lead item</span>
                      </div>
                    </div>

                    <div>
                      <Label>Interface Prompt</Label>
                      <Textarea
                        value={taskForm.interface_prompt}
                        onChange={(e) => setTaskForm({ ...taskForm, interface_prompt: e.target.value })}
                        placeholder="e.g. Builder area release, mechanical rough-in complete, ceiling support confirmed"
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label>Hold Point</Label>
                      <Textarea
                        value={taskForm.hold_point}
                        onChange={(e) => setTaskForm({ ...taskForm, hold_point: e.target.value })}
                        placeholder="e.g. Inspection required before close-up"
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label>Gain Note</Label>
                      <Textarea
                        value={taskForm.gain_note}
                        onChange={(e) => setTaskForm({ ...taskForm, gain_note: e.target.value })}
                        placeholder="e.g. Can pull forward if release achieved early"
                        rows={2}
                      />
                    </div>

                    <div>
                      <Label>Snapshot Note</Label>
                      <Textarea
                        value={taskForm.snapshot_note}
                        onChange={(e) => setTaskForm({ ...taskForm, snapshot_note: e.target.value })}
                        placeholder="Short status note for reports and snapshots"
                        rows={2}
                      />
                    </div>
                  </div>
                </div>
<div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Start Date</Label>
                <Input
                  type="date"
                  value={taskForm.planned_start}
                  onChange={(e) => setTaskForm({ ...taskForm, planned_start: e.target.value })}
                  className="col-span-3"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">End Date</Label>
                <Input
                  type="date"
                  value={taskForm.planned_finish}
                  onChange={(e) => setTaskForm({ ...taskForm, planned_finish: e.target.value })}
                  className="col-span-3"
                />
              </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Actual Start</Label>
                  <Input
                    type="date"
                    value={taskForm.actual_start}
                    onChange={(e) => setTaskForm({ ...taskForm, actual_start: e.target.value })}
                    className="col-span-3"
                  />
                </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Duration</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    type="number"
                    value={taskForm.duration_days}
                    onChange={(e) => setTaskForm({ ...taskForm, duration_days: e.target.value })}
                    placeholder="0"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Quoted Hours</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    type="number"
                    step="0.5"
                    value={taskForm.quoted_hours}
                    onChange={(e) => setTaskForm({ ...taskForm, quoted_hours: e.target.value })}
                    placeholder="0"
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">hours</span>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Status</Label>
                <Select
                  value={taskForm.status}
                  onValueChange={(value) => setTaskForm({ ...taskForm, status: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Actual Hours</Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.5"
                      value={taskForm.actual_hours}
                      onChange={(e) => setTaskForm({ ...taskForm, actual_hours: e.target.value })}
                      placeholder="0"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">hours</span>
                  </div>
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Progress %</Label>
                  <div className="col-span-3 flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={taskForm.percent_complete}
                      onChange={(e) => setTaskForm({ ...taskForm, percent_complete: e.target.value })}
                      placeholder="0"
                      className="w-24"
                    />
                    <span className="text-sm text-muted-foreground">percent</span>
                  </div>
                </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Internal?</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Switch
                    checked={taskForm.is_internal}
                    onCheckedChange={(checked) => setTaskForm({ ...taskForm, is_internal: checked })}
                  />
                  <span className="text-sm text-muted-foreground">
                    {taskForm.is_internal ? 'Internal crew' : 'Subcontractor'}
                  </span>
                </div>
              </div>

              {!taskForm.is_internal && (
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label className="text-right">Subcontractor</Label>
                  <Select
                    value={taskForm.subcontractor_id || "none"}
                    onValueChange={(value) => setTaskForm({ ...taskForm, subcontractor_id: value === "none" ? "" : value })}
                  >
                    <SelectTrigger className="col-span-3">
                      <SelectValue placeholder="Select subcontractor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Select subcontractor</SelectItem>
                      {subcontractors.map(sub => (
                        <SelectItem key={sub.id} value={sub.id}>
                          {sub.company_name} ({sub.trade_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Task Codes</Label>
                <div className="col-span-3">
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
                    {taskCodes.filter(c => c.is_active).map(code => (
                      <Badge
                        key={code.id}
                        variant={taskForm.linked_task_codes.includes(code.id) ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleTaskCode(code.id)}
                      >
                        {code.code}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click to select/deselect codes linked to this task
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Notes</Label>
                <Textarea
                  value={taskForm.notes}
                  onChange={(e) => setTaskForm({ ...taskForm, notes: e.target.value })}
                  className="col-span-3"
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setTaskDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingTask} data-testid="save-task-btn">
                {savingTask && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingTask ? 'Update Task' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog
        open={documentReviewEditDialogOpen}
        onOpenChange={(open) => {
          setDocumentReviewEditDialogOpen(open);
          if (!open) {
            setActiveDocument(null);
            setDocumentReviewEditForm({ value: '' });
          }
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {documentReviewEditMode === 'type' ? 'Set document type' : 'Add mapping note'}
            </DialogTitle>
            <DialogDescription>
              Update the document review metadata without leaving the Documents workflow.
            </DialogDescription>
          </DialogHeader>

          {activeDocument && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="font-medium text-sm">
                  {activeDocument.original_filename || activeDocument.filename || activeDocument.name || 'Document'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Current type: {activeDocument.detected_document_type || 'Not set'}
                </div>
              </div>

              {documentReviewEditMode === 'type' ? (
                <div className="space-y-2">
                  <Label htmlFor="document-review-type">Document type</Label>
                  <Input
                    id="document-review-type"
                    value={documentReviewEditForm.value}
                    onChange={(event) => setDocumentReviewEditForm({ value: event.target.value })}
                    placeholder="e.g. Programme, Scope, Drawing, RFI, Variation"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="document-review-notes">Mapping notes</Label>
                  <Textarea
                    id="document-review-notes"
                    value={documentReviewEditForm.value}
                    onChange={(event) => setDocumentReviewEditForm({ value: event.target.value })}
                    rows={5}
                    placeholder="Add notes about floor, package, scope, risk, or suggested task mapping."
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeDocumentReviewEditDialog}
              disabled={savingDocumentReviewEdit}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSaveDocumentReviewEdit}
              disabled={savingDocumentReviewEdit || !activeDocument}
            >
              {savingDocumentReviewEdit ? 'Saving...' : 'Save Review Detail'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={documentActionDialogOpen}
        onOpenChange={(open) => {
          setDocumentActionDialogOpen(open);
          if (!open) {
            setActiveDocument(null);
            setDocumentTaskSearch('');
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Review document task action</DialogTitle>
            <DialogDescription>
              Choose an existing task from a visible list, or create a proposed task from this document.
            </DialogDescription>
          </DialogHeader>

          {activeDocument && (
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="font-medium text-sm">
                  {activeDocument.original_filename || activeDocument.filename || activeDocument.name || 'Document'}
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {activeDocument.detected_document_type || 'No document type set'}
                </div>
                {activeDocument.mapping_notes && (
                  <div className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                    {activeDocument.mapping_notes}
                  </div>
                )}
              </div>

              {getSuggestedTasksForDocument(activeDocument).length > 0 && (
                <div className="space-y-2">
                  <Label>Suggested matches</Label>
                  <div className="flex flex-wrap gap-2">
                    {getSuggestedTasksForDocument(activeDocument).map((task) => (
                      <Button
                        key={`dialog-suggested-${task.id}`}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleLinkDocumentToTask(activeDocument.id, task.id)}
                      >
                        {task.task_name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Find existing task</Label>
                <Input
                  value={documentTaskSearch}
                  onChange={(e) => setDocumentTaskSearch(e.target.value)}
                  placeholder="Search by task name, level, package, contract, or area"
                />
              </div>

              <div className="max-h-80 overflow-y-auto rounded-lg border p-2 space-y-2">
                {tasks
                  .filter((task) => {
                    const needle = documentTaskSearch.trim().toLowerCase();
                    if (!needle) return true;

                    return [
                      task.task_name,
                      task.level,
                      task.package,
                      task.contract,
                      task.zone_area
                    ]
                      .filter(Boolean)
                      .some((value) => String(value).toLowerCase().includes(needle));
                  })
                  .slice(0, 20)
                  .map((task) => (
                    <div key={`document-link-${task.id}`} className="flex items-center justify-between gap-3 rounded-md border p-3">
                      <div className="min-w-0">
                        <div className="font-medium text-sm">{task.task_name}</div>
                        <div className="text-xs text-muted-foreground">
                          {[task.level, task.package, task.contract, task.zone_area].filter(Boolean).join(' • ') || task.id}
                        </div>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleLinkDocumentToTask(activeDocument.id, task.id)}
                      >
                        Link
                      </Button>
                    </div>
                  ))}

                {tasks.filter((task) => {
                  const needle = documentTaskSearch.trim().toLowerCase();
                  if (!needle) return true;

                  return [
                    task.task_name,
                    task.level,
                    task.package,
                    task.contract,
                    task.zone_area
                  ]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(needle));
                }).length === 0 && (
                  <div className="text-sm text-muted-foreground p-2">
                    No matching tasks found.
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setDocumentActionDialogOpen(false);
                setActiveDocument(null);
                setDocumentTaskSearch('');
              }}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => activeDocument && handleCreateTaskFromDocument(activeDocument)}
            >
              Create Proposed Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Sheet */}
      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && closeTaskDetail()}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedTask && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedTask.status)}
                  {selectedTask.is_internal ? (
                    <Badge variant="outline">Internal</Badge>
                  ) : (
                    <Badge variant="outline">Subcontractor</Badge>
                  )}
                </div>
                <SheetTitle className="text-xl">{selectedTask.task_name}</SheetTitle>
                <SheetDescription>
                  {selectedTask.task_type && `${selectedTask.task_type} Ã¢â‚¬Â¢ `}
                  {selectedTask.zone_area && `${selectedTask.zone_area}`}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Task Info */}
                <div className="grid grid-cols-2 gap-4">
                  {selectedTask.planned_start && (
                    <div>
                      <p className="text-sm text-muted-foreground">Start Date</p>
                      <p className="font-medium">{new Date(selectedTask.planned_start).toLocaleDateString()}</p>
                    </div>
                  )}
                    {selectedTask.actual_start && (
                      <div>
                        <p className="text-sm text-muted-foreground">Actual Start</p>
                        <p className="font-medium">{new Date(selectedTask.actual_start).toLocaleDateString()}</p>
                      </div>
                    )}
                  {selectedTask.planned_finish && (
                    <div>
                      <p className="text-sm text-muted-foreground">End Date</p>
                      <p className="font-medium">{new Date(selectedTask.planned_finish).toLocaleDateString()}</p>
                    </div>
                  )}
                  {selectedTask.duration_days && (
                    <div>
                      <p className="text-sm text-muted-foreground">Duration</p>
                      <p className="font-medium">{selectedTask.duration_days} days</p>
                    </div>
                  )}
                  {selectedTask.quoted_hours && (
                    <div>
                      <p className="text-sm text-muted-foreground">Quoted Hours</p>
                      <p className="font-medium">{selectedTask.quoted_hours}h</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Actual Hours</p>
                    <p className="font-medium">{selectedTask.actual_hours || 0}h</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Progress</p>
                    <p className="font-medium">{selectedTask.percent_complete}%</p>
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Level</p>
                    <p className="font-medium">{selectedTask.level || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Package</p>
                    <p className="font-medium">{selectedTask.package || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Contract</p>
                    <p className="font-medium">{selectedTask.contract || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">RAG</p>
                    <p className="font-medium">{selectedTask.rag_status || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Rounded Crew</p>
                    <p className="font-medium">{selectedTask.rounded_crew || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Long Lead</p>
                    <p className="font-medium">{selectedTask.is_long_lead ? 'Yes' : 'No'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Interface Prompt</p>
                    <p className="font-medium whitespace-pre-wrap">{selectedTask.interface_prompt || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Hold Point</p>
                    <p className="font-medium whitespace-pre-wrap">{selectedTask.hold_point || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Gain Note</p>
                    <p className="font-medium whitespace-pre-wrap">{selectedTask.gain_note || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Snapshot Note</p>
                    <p className="font-medium whitespace-pre-wrap">{selectedTask.snapshot_note || '-'}</p>
                  </div>

                </div>

                {selectedTask.linked_file_ids?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Linked Documents</h4>
                    <div className="space-y-2">
                      {selectedTask.linked_file_ids.map(fileId => {
                        const doc = documents.find(d => d.id === fileId);
                        return (
                          <div key={fileId} className="rounded-md border p-3">
                            <div className="font-medium text-sm">
                              {doc ? (doc.original_filename || doc.filename || doc.name || fileId) : fileId}
                            </div>
                            {doc && (
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleUnlinkDocumentFromTask(selectedTask.id, fileId)}
                                >
                                  Unlink Document
                                </Button>
                                <Badge variant="outline">{doc.parse_status || 'unknown'}</Badge>
                                {doc.reference_only && <Badge variant="secondary">Reference only</Badge>}
                                {doc.use_for_programme && <Badge variant="outline">Programme Use</Badge>}
                                {doc.use_for_scope && <Badge variant="outline">Scope Use</Badge>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Linked Task Codes */}
                {selectedTask.linked_task_codes?.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Linked Task Codes</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedTask.linked_task_codes.map(codeId => {
                        const codeRow = taskCodes.find(c => c.id === codeId);
                        return (
                          <Badge key={codeId} variant="outline">
                            {codeRow ? `${codeRow.code} - ${codeRow.name}` : codeId}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {selectedTask.notes && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Notes</h4>
                    <p className="text-sm text-muted-foreground">{selectedTask.notes}</p>
                  </div>
                )}

                {/* Materials Section */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Materials & Procurement
                    </h4>
                    {canManage() && (
                      <Button size="sm" variant="outline" onClick={() => setMaterialDialogOpen(true)}>
                        <Plus className="mr-1 h-3 w-3" />
                        Add Material
                      </Button>
                    )}
                  </div>

                  {loadingMaterials ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : taskMaterials.length === 0 ? (
                    <div className="text-center py-6 border rounded-lg border-dashed">
                      <Package className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                      <p className="text-sm text-muted-foreground">No materials added</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {taskMaterials.map(material => (
                        <div 
                          key={material.id} 
                          className="p-3 border rounded-lg"
                          data-testid={`material-${material.id}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{material.name}</span>
                                {material.is_long_lead && (
                                  <Badge variant="destructive" className="text-xs">Long Lead</Badge>
                                )}
                              </div>
                              {material.package_name && (
                                <p className="text-xs text-muted-foreground">{material.package_name}</p>
                              )}
                              {material.supplier && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                                  <Truck className="h-3 w-3" />
                                  {material.supplier}
                                </p>
                              )}
                              {material.order_due_date && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Order by: {new Date(material.order_due_date).toLocaleDateString()}
                                </p>
                              )}
                            </div>
                            <div>
                              {canManage() ? (
                                <Select
                                  value={material.status}
                                  onValueChange={(value) => updateMaterialStatus(material.id, value)}
                                >
                                  <SelectTrigger className="w-[140px] h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {MATERIAL_STATUSES.map(s => (
                                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                getMaterialStatusBadge(material.status)
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Edit Task Button */}
                {canManage() && (
                  <div className="flex gap-2 pt-4 border-t">
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        closeTaskDetail();
                        openTaskDialog(selectedTask);
                      }}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Task
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Material Creation Dialog */}
      <Dialog open={materialDialogOpen} onOpenChange={(open) => { setMaterialDialogOpen(open); if (!open) resetMaterialForm(); }}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSaveMaterial}>
            <DialogHeader>
              <DialogTitle>Add Material</DialogTitle>
              <DialogDescription>
                Add material or procurement item to track for this task
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Name *</Label>
                <Input
                  value={materialForm.name}
                  onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Gib Board 13mm"
                  required
                  data-testid="material-name-input"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Package</Label>
                <Input
                  value={materialForm.package_name}
                  onChange={(e) => setMaterialForm({ ...materialForm, package_name: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Wall Linings Package"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Supplier</Label>
                <Input
                  value={materialForm.supplier}
                  onChange={(e) => setMaterialForm({ ...materialForm, supplier: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Winstone Wallboards"
                />
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Order Lead</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    type="number"
                    value={materialForm.order_lead_time_days}
                    onChange={(e) => setMaterialForm({ ...materialForm, order_lead_time_days: e.target.value })}
                    placeholder="0"
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">days before task start</span>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Delivery Buffer</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    type="number"
                    value={materialForm.delivery_buffer_days}
                    onChange={(e) => setMaterialForm({ ...materialForm, delivery_buffer_days: e.target.value })}
                    placeholder="0"
                    className="w-20"
                  />
                  <span className="text-sm text-muted-foreground">days before task start</span>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Long Lead?</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Switch
                    checked={materialForm.is_long_lead}
                    onCheckedChange={(checked) => setMaterialForm({ ...materialForm, is_long_lead: checked })}
                  />
                  <span className="text-sm text-muted-foreground">
                    Requires extra planning attention
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Status</Label>
                <Select
                  value={materialForm.status}
                  onValueChange={(value) => setMaterialForm({ ...materialForm, status: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MATERIAL_STATUSES.map(s => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMaterialDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingMaterial} data-testid="save-material-btn">
                {savingMaterial && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Material
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delay Recording Dialog */}
      <Dialog open={delayDialogOpen} onOpenChange={(open) => { 
        setDelayDialogOpen(open); 
        if (!open) setDelayForm({ task_id: '', delay_type: 'main_contractor', delay_days: '', description: '', caused_by: '', impact_description: '' }); 
      }}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={async (e) => {
            e.preventDefault();
            if (!delayForm.task_id || !delayForm.delay_days) {
              toast.error('Task and delay days are required');
              return;
            }
            setSavingDelay(true);
            try {
              const response = await api.post('/delays', {
                ...delayForm,
                delay_days: parseInt(delayForm.delay_days),
              });
              setDelays([response.data, ...delays]);
              fetchJobData(); // Refresh tasks to show updated statuses
              toast.success(`Delay recorded. ${response.data.affected_tasks?.length || 0} downstream tasks affected.`);
              setDelayDialogOpen(false);
              setDelayForm({ task_id: '', delay_type: 'main_contractor', delay_days: '', description: '', caused_by: '', impact_description: '' });
            } catch (error) {
              toast.error(error.response?.data?.detail || 'Failed to record delay');
            } finally {
              setSavingDelay(false);
            }
          }}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-500" />
                Record Delay
              </DialogTitle>
              <DialogDescription>
                Record a delay and track its impact on downstream tasks
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Task *</Label>
                <Select
                  value={delayForm.task_id || "placeholder"}
                  onValueChange={(value) => setDelayForm({ ...delayForm, task_id: value === "placeholder" ? "" : value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue placeholder="Select affected task" />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.map(task => (
                      <SelectItem key={task.id} value={task.id}>
                        {task.task_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Delay Type *</Label>
                <Select
                  value={delayForm.delay_type}
                  onValueChange={(value) => setDelayForm({ ...delayForm, delay_type: value })}
                >
                  <SelectTrigger className="col-span-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DELAY_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Delay Days *</Label>
                <div className="col-span-3 flex items-center gap-2">
                  <Input
                    type="number"
                    min="1"
                    value={delayForm.delay_days}
                    onChange={(e) => setDelayForm({ ...delayForm, delay_days: e.target.value })}
                    placeholder="0"
                    className="w-24"
                    required
                    data-testid="delay-days-input"
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>
              </div>

              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Caused By</Label>
                <Input
                  value={delayForm.caused_by}
                  onChange={(e) => setDelayForm({ ...delayForm, caused_by: e.target.value })}
                  className="col-span-3"
                  placeholder="e.g. Main contractor, Weather event"
                />
              </div>

              <div className="grid grid-cols-4 items-start gap-4">
                <Label className="text-right pt-2">Description</Label>
                <Textarea
                  value={delayForm.description}
                  onChange={(e) => setDelayForm({ ...delayForm, description: e.target.value })}
                  className="col-span-3"
                  placeholder="Details about the delay..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDelayDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={savingDelay} data-testid="save-delay-btn">
                {savingDelay && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Delay
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}




































