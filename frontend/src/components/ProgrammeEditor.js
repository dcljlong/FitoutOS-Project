import React, { useState, useEffect } from 'react';
import { format, parseISO, addDays, differenceInDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Plus,
  Trash2,
  Save,
  Check,
  AlertCircle,
  Calendar,
  Users,
  Clock,
  Link as LinkIcon,
  GripVertical,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';

// Trade options
const TRADE_OPTIONS = [
  'Framing',
  'Linings',
  'Stopping',
  'Ceilings',
  'Insulation',
  'Aluminium',
  'General',
  'Site',
  'Logistics',
];

// Phase options
const PHASE_OPTIONS = [
  'Preliminaries',
  'Construction',
  'Finishing',
  'Handover',
];

export default function ProgrammeEditor({
  items = [],
  taskCodes = [],
  jobStartDate,
  onSave,
  onConfirm,
  onCancel,
  loading = false,
}) {
  const [programmeItems, setProgrammeItems] = useState([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [errors, setErrors] = useState([]);

  // Initialize items
  useEffect(() => {
    if (items.length > 0) {
      setProgrammeItems(items.map((item, index) => ({
        ...item,
        id: item.id || `prog-${String(index + 1).padStart(3, '0')}`,
        _index: index,
      })));
    }
  }, [items]);

  // Add new item
  const addItem = () => {
    const newIndex = programmeItems.length;
    const newId = `prog-${String(newIndex + 1).padStart(3, '0')}`;
    
    // Calculate default start date based on last item
    let defaultStart = jobStartDate || format(new Date(), 'yyyy-MM-dd');
    if (programmeItems.length > 0) {
      const lastItem = programmeItems[programmeItems.length - 1];
      if (lastItem.planned_finish) {
        defaultStart = format(addDays(parseISO(lastItem.planned_finish), 1), 'yyyy-MM-dd');
      } else if (lastItem.planned_start && lastItem.duration) {
        defaultStart = format(addDays(parseISO(lastItem.planned_start), lastItem.duration), 'yyyy-MM-dd');
      }
    }
    
    setProgrammeItems([...programmeItems, {
      id: newId,
      name: '',
      phase: 'Construction',
      trade: 'General',
      duration: 1,
      duration_unit: 'days',
      planned_start: defaultStart,
      planned_finish: defaultStart,
      depends_on: [],
      task_code_id: null,
      crew_size: null,
      hours_per_day: 8,
      resource_name: '',
      confidence: 'manual',
      _index: newIndex,
    }]);
  };

  // Remove item
  const removeItem = (index) => {
    const itemId = programmeItems[index]?.id;
    const updated = programmeItems.filter((_, i) => i !== index);
    
    // Remove references to deleted item from depends_on
    updated.forEach(item => {
      if (item.depends_on?.includes(itemId)) {
        item.depends_on = item.depends_on.filter(id => id !== itemId);
      }
    });
    
    setProgrammeItems(updated);
  };

  // Update field
  const updateField = (index, field, value) => {
    const updated = [...programmeItems];
    updated[index] = { ...updated[index], [field]: value };
    
    // Auto-calculate finish date when start or duration changes
    if ((field === 'planned_start' || field === 'duration') && updated[index].planned_start) {
      const duration = parseInt(updated[index].duration) || 1;
      const start = parseISO(updated[index].planned_start);
      updated[index].planned_finish = format(addDays(start, duration - 1), 'yyyy-MM-dd');
    }
    
    // Auto-calculate duration when finish date changes
    if (field === 'planned_finish' && updated[index].planned_start && updated[index].planned_finish) {
      const start = parseISO(updated[index].planned_start);
      const finish = parseISO(updated[index].planned_finish);
      updated[index].duration = differenceInDays(finish, start) + 1;
    }
    
    setProgrammeItems(updated);
  };

  // Validate programme
  const validate = () => {
    const validationErrors = [];
    
    programmeItems.forEach((item, index) => {
      if (!item.name?.trim()) {
        validationErrors.push(`Row ${index + 1}: Task name is required`);
      }
      if (!item.planned_start) {
        validationErrors.push(`Row ${index + 1}: Start date is required`);
      }
      if (item.duration < 1) {
        validationErrors.push(`Row ${index + 1}: Duration must be at least 1 day`);
      }
      
      // Check for circular dependencies
      if (item.depends_on?.includes(item.id)) {
        validationErrors.push(`Row ${index + 1}: Cannot depend on itself`);
      }
    });
    
    setErrors(validationErrors);
    return validationErrors.length === 0;
  };

  // Handle save (without generating tasks)
  const handleSave = () => {
    if (validate()) {
      onSave?.(programmeItems);
    }
  };

  // Handle confirm (will generate tasks)
  const handleConfirm = () => {
    if (validate()) {
      setShowConfirmDialog(true);
    }
  };

  const confirmAndGenerate = () => {
    setShowConfirmDialog(false);
    onConfirm?.(programmeItems);
  };

  // Get available predecessors for a given item
  const getAvailablePredecessors = (currentIndex) => {
    return programmeItems
      .filter((_, i) => i < currentIndex)
      .map(item => ({ id: item.id, name: item.name }));
  };

  return (
    <div className="space-y-4" data-testid="programme-editor">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Programme Editor</h3>
          <p className="text-sm text-muted-foreground">
            Edit tasks, dates, and dependencies before confirming
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addItem}>
            <Plus className="mr-2 h-4 w-4" />
            Add Task
          </Button>
        </div>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3">
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">Please fix the following errors:</span>
          </div>
          <ul className="list-disc list-inside text-sm text-destructive space-y-1">
            {errors.map((error, i) => (
              <li key={i}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Programme table */}
      <Card>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10">
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead className="min-w-[200px]">Task Name</TableHead>
                <TableHead className="w-32">Phase</TableHead>
                <TableHead className="w-32">Trade</TableHead>
                <TableHead className="w-32">Start Date</TableHead>
                <TableHead className="w-32">Finish Date</TableHead>
                <TableHead className="w-20">Days</TableHead>
                <TableHead className="w-40">Predecessor</TableHead>
                <TableHead className="w-32">Task Code</TableHead>
                <TableHead className="w-20">Crew</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {programmeItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    No programme items. Click "Add Task" to start.
                  </TableCell>
                </TableRow>
              ) : (
                programmeItems.map((item, index) => (
                  <TableRow key={item.id} className="group">
                    <TableCell className="font-mono text-muted-foreground">
                      {index + 1}
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.name || ''}
                        onChange={(e) => updateField(index, 'name', e.target.value)}
                        placeholder="Task name"
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.phase || ''}
                        onValueChange={(v) => updateField(index, 'phase', v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Phase" />
                        </SelectTrigger>
                        <SelectContent>
                          {PHASE_OPTIONS.map(phase => (
                            <SelectItem key={phase} value={phase}>{phase}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.trade || ''}
                        onValueChange={(v) => updateField(index, 'trade', v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Trade" />
                        </SelectTrigger>
                        <SelectContent>
                          {TRADE_OPTIONS.map(trade => (
                            <SelectItem key={trade} value={trade}>{trade}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={item.planned_start || ''}
                        onChange={(e) => updateField(index, 'planned_start', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="date"
                        value={item.planned_finish || ''}
                        onChange={(e) => updateField(index, 'planned_finish', e.target.value)}
                        className="h-8"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        value={item.duration || ''}
                        onChange={(e) => updateField(index, 'duration', parseInt(e.target.value) || 1)}
                        className="h-8 w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.depends_on?.[0] || 'none'}
                        onValueChange={(v) => updateField(index, 'depends_on', v === 'none' ? [] : [v])}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="None" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {getAvailablePredecessors(index).map(pred => (
                            <SelectItem key={pred.id} value={pred.id}>
                              {pred.name || pred.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.task_code_id || 'none'}
                        onValueChange={(v) => updateField(index, 'task_code_id', v === 'none' ? null : v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue placeholder="Code" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {taskCodes.map(code => (
                            <SelectItem key={code.id} value={code.id}>
                              {code.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min="1"
                        step="0.5"
                        value={item.crew_size || ''}
                        onChange={(e) => updateField(index, 'crew_size', parseFloat(e.target.value) || null)}
                        placeholder="—"
                        className="h-8 w-16"
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeItem(index)}
                        className="opacity-0 group-hover:opacity-100 h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Summary */}
      <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
        <div className="flex gap-6 text-sm">
          <div>
            <span className="text-muted-foreground">Total Tasks:</span>
            <span className="ml-2 font-medium">{programmeItems.length}</span>
          </div>
          {programmeItems.length > 0 && programmeItems[0].planned_start && (
            <div>
              <span className="text-muted-foreground">Start:</span>
              <span className="ml-2 font-medium">
                {format(parseISO(programmeItems[0].planned_start), 'MMM d, yyyy')}
              </span>
            </div>
          )}
          {programmeItems.length > 0 && programmeItems[programmeItems.length - 1].planned_finish && (
            <div>
              <span className="text-muted-foreground">Finish:</span>
              <span className="ml-2 font-medium">
                {format(parseISO(programmeItems[programmeItems.length - 1].planned_finish), 'MMM d, yyyy')}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
          )}
          <Button variant="outline" onClick={handleSave} disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            Save Draft
          </Button>
          <Button onClick={handleConfirm} disabled={loading || programmeItems.length === 0}>
            <Check className="mr-2 h-4 w-4" />
            Confirm & Generate Tasks
          </Button>
        </div>
      </div>

      {/* Confirm Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Programme</DialogTitle>
            <DialogDescription>
              This will generate {programmeItems.length} tasks from your programme.
              Existing tasks linked to this programme will be updated.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span>Tasks to create/update:</span>
                <span className="font-medium">{programmeItems.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Dependencies defined:</span>
                <span className="font-medium">
                  {programmeItems.filter(i => i.depends_on?.length > 0).length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Task codes assigned:</span>
                <span className="font-medium">
                  {programmeItems.filter(i => i.task_code_id).length}
                </span>
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Cancel
            </Button>
            <Button onClick={confirmAndGenerate}>
              <ArrowRight className="mr-2 h-4 w-4" />
              Generate Tasks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
