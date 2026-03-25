import React, { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  AlertTriangle,
  CheckCircle,
  Loader2,
  ClipboardCheck,
  Save,
} from 'lucide-react';
import { toast } from 'sonner';

// Default checklist items
const DEFAULT_CHECKLIST = [
  { key: 'area_handed_over', label: 'Area handed over', checked: false },
  { key: 'previous_trade_complete', label: 'Previous trade complete', checked: false },
  { key: 'services_complete', label: 'Services complete', checked: false },
  { key: 'inspection_passed', label: 'Inspection passed', checked: false },
  { key: 'materials_ready', label: 'Materials ready', checked: false },
  { key: 'access_ready', label: 'Access ready', checked: false },
  { key: 'programme_confirmed', label: 'Programme confirmed', checked: false },
  { key: 'mc_confirmed_ready', label: 'MC confirmed ready', checked: false },
];

export default function PreStartChecklist({
  taskId,
  taskName,
  initialChecklist,
  onUpdate,
  compact = false,
}) {
  const [checklist, setChecklist] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Initialize checklist
  useEffect(() => {
    if (initialChecklist && initialChecklist.length > 0) {
      setChecklist(initialChecklist);
    } else if (taskId) {
      fetchChecklist();
    } else {
      setChecklist(DEFAULT_CHECKLIST.map(item => ({ ...item })));
    }
  }, [taskId, initialChecklist]);

  // Fetch checklist from API
  const fetchChecklist = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/tasks/${taskId}/checklist`);
      setChecklist(response.data.checklist || DEFAULT_CHECKLIST);
    } catch (error) {
      console.error('Failed to fetch checklist:', error);
      setChecklist(DEFAULT_CHECKLIST.map(item => ({ ...item })));
    } finally {
      setLoading(false);
    }
  };

  // Toggle item
  const toggleItem = (key) => {
    const updated = checklist.map(item =>
      item.key === key ? { ...item, checked: !item.checked } : item
    );
    setChecklist(updated);
    setHasChanges(true);
  };

  // Save checklist
  const saveChecklist = async () => {
    if (!taskId) {
      onUpdate?.(checklist);
      setHasChanges(false);
      return;
    }

    setSaving(true);
    try {
      const response = await api.put(`/tasks/${taskId}/checklist`, {
        checklist: checklist,
      });
      toast.success('Checklist saved');
      setHasChanges(false);
      onUpdate?.(response.data.checklist);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save checklist');
    } finally {
      setSaving(false);
    }
  };

  // Calculate progress
  const totalItems = checklist.length;
  const completedItems = checklist.filter(item => item.checked).length;
  const progressPercent = totalItems > 0 ? (completedItems / totalItems) * 100 : 0;
  const isComplete = completedItems === totalItems;

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Compact view for inline display
  if (compact) {
    return (
      <div className="space-y-2" data-testid="prestart-checklist-compact">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Pre-start Checklist</span>
          </div>
          <Badge variant={isComplete ? 'success' : 'secondary'}>
            {completedItems}/{totalItems}
          </Badge>
        </div>
        <Progress value={progressPercent} className="h-2" />
        {!isComplete && (
          <p className="text-xs text-amber-600 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            {totalItems - completedItems} items incomplete
          </p>
        )}
      </div>
    );
  }

  // Full view
  return (
    <Card data-testid="prestart-checklist">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Pre-start Checklist
            </CardTitle>
            {taskName && (
              <CardDescription>{taskName}</CardDescription>
            )}
          </div>
          <Badge variant={isComplete ? 'success' : progressPercent > 50 ? 'secondary' : 'destructive'}>
            {isComplete ? (
              <span className="flex items-center gap-1">
                <CheckCircle className="h-3 w-3" />
                Complete
              </span>
            ) : (
              `${completedItems}/${totalItems}`
            )}
          </Badge>
        </div>
        <Progress value={progressPercent} className="h-2 mt-3" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {checklist.map((item, index) => (
            <div
              key={item.key}
              className={`flex items-center space-x-3 p-2 rounded-lg transition-colors
                ${item.checked ? 'bg-green-50 dark:bg-green-900/20' : 'hover:bg-muted/50'}`}
            >
              <Checkbox
                id={`check-${item.key}`}
                checked={item.checked}
                onCheckedChange={() => toggleItem(item.key)}
              />
              <Label
                htmlFor={`check-${item.key}`}
                className={`flex-1 cursor-pointer ${item.checked ? 'line-through text-muted-foreground' : ''}`}
              >
                {item.label}
              </Label>
              {item.checked && (
                <CheckCircle className="h-4 w-4 text-green-500" />
              )}
            </div>
          ))}
        </div>

        {/* Warning if incomplete */}
        {!isComplete && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-sm font-medium">
                {totalItems - completedItems} item{totalItems - completedItems !== 1 ? 's' : ''} not complete
              </span>
            </div>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
              Complete all checklist items before starting this task
            </p>
          </div>
        )}

        {/* Save button */}
        {hasChanges && (
          <div className="mt-4 flex justify-end">
            <Button onClick={saveChecklist} disabled={saving} size="sm">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Checklist
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
