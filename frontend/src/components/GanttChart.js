import React, { useState, useMemo, useRef, useEffect } from 'react';
import { format, addDays, differenceInDays, startOfWeek, endOfWeek, isWeekend, parseISO, isSameDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  AlertTriangle,
  Lock,
  Users,
  Clock,
  Calendar,
} from 'lucide-react';

// NZ Public Holidays for 2026
const NZ_HOLIDAYS_2026 = [
  '2026-01-01', '2026-01-02', '2026-01-26', // New Year, Day after, Auckland Anniversary
  '2026-02-06', // Waitangi Day
  '2026-04-03', '2026-04-06', // Good Friday, Easter Monday
  '2026-04-27', // ANZAC Day (observed)
  '2026-06-01', // Queen's Birthday
  '2026-07-10', // Matariki
  '2026-10-26', // Labour Day
  '2026-12-25', '2026-12-28', // Christmas, Boxing Day (observed)
];

const isHoliday = (date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return NZ_HOLIDAYS_2026.includes(dateStr);
};

const isWorkday = (date) => {
  return !isWeekend(date) && !isHoliday(date);
};

// Trade colors
const TRADE_COLORS = {
  'Framing': 'bg-blue-500',
  'Linings': 'bg-green-500',
  'Stopping': 'bg-yellow-500',
  'Ceilings': 'bg-purple-500',
  'Insulation': 'bg-pink-500',
  'General': 'bg-gray-500',
  'Aluminium': 'bg-cyan-500',
  'default': 'bg-slate-500',
};

// Status colors
const STATUS_COLORS = {
  'planned': 'bg-slate-400',
  'active': 'bg-blue-500',
  'on_track': 'bg-green-500',
  'at_risk': 'bg-amber-500',
  'delayed': 'bg-orange-500',
  'blocked': 'bg-red-500',
  'complete': 'bg-emerald-600',
};

export default function GanttChart({
  tasks = [],
  programme = [],
  startDate,
  endDate,
  onTaskClick,
  onTaskMove,
  onTaskDurationChange,
  colorBy = 'trade', // 'trade' or 'status'
  showDependencies = true,
  showWeekends = true,
  showHolidays = true,
  editable = false,
}) {
  const [zoom, setZoom] = useState('day'); // 'day', 'week', 'month'
  const [viewStart, setViewStart] = useState(null);
  const containerRef = useRef(null);
  const [dragging, setDragging] = useState(null);

  // Combine tasks and programme items
  const items = useMemo(() => {
    const allItems = [];
    
    // Add tasks
    tasks.forEach(task => {
      if (task.planned_start && task.planned_finish) {
        allItems.push({
          id: task.id,
          name: task.task_name,
          start: parseISO(task.planned_start),
          end: parseISO(task.planned_finish),
          trade: task.trade_resource || task.owner_party || 'General',
          status: task.status,
          crew_size: task.crew_size,
          quoted_hours: task.quoted_hours,
          predecessor_ids: task.predecessor_ids || [],
          is_blocked: task.is_blocked,
          is_critical: task.is_critical,
          locked: task.locked,
          type: 'task',
          original: task,
        });
      }
    });
    
    // Add programme items (if no tasks yet)
    if (tasks.length === 0 && programme.length > 0) {
      programme.forEach(item => {
        const start = item.planned_start ? parseISO(item.planned_start) : null;
        const end = item.planned_finish ? parseISO(item.planned_finish) : 
                    (start && item.duration ? addDays(start, item.duration - 1) : null);
        
        if (start) {
          allItems.push({
            id: item.id,
            name: item.name,
            start: start,
            end: end || start,
            trade: item.trade || 'General',
            status: 'planned',
            crew_size: item.crew_size,
            quoted_hours: item.hours_per_day ? item.hours_per_day * (item.duration || 1) : null,
            predecessor_ids: item.depends_on || [],
            is_blocked: false,
            is_critical: false,
            locked: false,
            type: 'programme',
            original: item,
          });
        }
      });
    }
    
    return allItems.sort((a, b) => a.start - b.start);
  }, [tasks, programme]);

  // Calculate date range
  const dateRange = useMemo(() => {
    if (items.length === 0) {
      const today = new Date();
      return {
        start: startDate ? parseISO(startDate) : today,
        end: endDate ? parseISO(endDate) : addDays(today, 30),
      };
    }
    
    const minDate = items.reduce((min, item) => item.start < min ? item.start : min, items[0].start);
    const maxDate = items.reduce((max, item) => item.end > max ? item.end : max, items[0].end);
    
    // Add buffer
    return {
      start: addDays(minDate, -3),
      end: addDays(maxDate, 7),
    };
  }, [items, startDate, endDate]);

  // Initialize view start
  useEffect(() => {
    if (!viewStart) {
      setViewStart(dateRange.start);
    }
  }, [dateRange, viewStart]);

  // Calculate columns based on zoom level
  const columns = useMemo(() => {
    if (!viewStart) return [];
    
    const cols = [];
    const daysToShow = zoom === 'day' ? 30 : zoom === 'week' ? 90 : 180;
    
    for (let i = 0; i < daysToShow; i++) {
      const date = addDays(viewStart, i);
      cols.push({
        date,
        isWeekend: isWeekend(date),
        isHoliday: isHoliday(date),
        isWorkday: isWorkday(date),
        label: zoom === 'day' ? format(date, 'd') : 
               zoom === 'week' ? format(date, 'MMM d') :
               format(date, 'MMM'),
      });
    }
    
    return cols;
  }, [viewStart, zoom]);

  // Column width based on zoom
  const colWidth = zoom === 'day' ? 32 : zoom === 'week' ? 16 : 8;

  // Calculate task position
  const getTaskPosition = (item) => {
    if (!viewStart) return { left: 0, width: 0 };
    
    const startOffset = differenceInDays(item.start, viewStart);
    const duration = differenceInDays(item.end, item.start) + 1;
    
    return {
      left: startOffset * colWidth,
      width: duration * colWidth - 2,
    };
  };

  // Get color for item
  const getItemColor = (item) => {
    if (item.is_blocked) return 'bg-red-500';
    if (item.is_critical) return 'bg-orange-500';
    
    if (colorBy === 'status') {
      return STATUS_COLORS[item.status] || STATUS_COLORS.planned;
    }
    
    return TRADE_COLORS[item.trade] || TRADE_COLORS.default;
  };

  // Navigation handlers
  const navigatePrev = () => {
    const days = zoom === 'day' ? 7 : zoom === 'week' ? 30 : 90;
    setViewStart(prev => addDays(prev, -days));
  };

  const navigateNext = () => {
    const days = zoom === 'day' ? 7 : zoom === 'week' ? 30 : 90;
    setViewStart(prev => addDays(prev, days));
  };

  const navigateToday = () => {
    setViewStart(new Date());
  };

  // Drag handlers for task editing
  const handleMouseDown = (e, item, action) => {
    if (!editable || item.locked) return;
    
    e.preventDefault();
    setDragging({
      item,
      action, // 'move' or 'resize'
      startX: e.clientX,
      originalStart: item.start,
      originalEnd: item.end,
    });
  };

  const handleMouseMove = (e) => {
    if (!dragging) return;
    
    const deltaX = e.clientX - dragging.startX;
    const deltaDays = Math.round(deltaX / colWidth);
    
    if (dragging.action === 'move' && onTaskMove) {
      const newStart = addDays(dragging.originalStart, deltaDays);
      const newEnd = addDays(dragging.originalEnd, deltaDays);
      onTaskMove(dragging.item.id, format(newStart, 'yyyy-MM-dd'), format(newEnd, 'yyyy-MM-dd'));
    } else if (dragging.action === 'resize' && onTaskDurationChange) {
      const newEnd = addDays(dragging.originalEnd, deltaDays);
      if (newEnd >= dragging.originalStart) {
        onTaskDurationChange(dragging.item.id, format(newEnd, 'yyyy-MM-dd'));
      }
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
  };

  useEffect(() => {
    if (dragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging]);

  // Render dependency lines
  const renderDependencyLines = () => {
    if (!showDependencies) return null;
    
    const lines = [];
    const itemsById = Object.fromEntries(items.map(i => [i.id, i]));
    
    items.forEach(item => {
      item.predecessor_ids?.forEach(predId => {
        const pred = itemsById[predId];
        if (!pred) return;
        
        const predPos = getTaskPosition(pred);
        const itemPos = getTaskPosition(item);
        const predIndex = items.indexOf(pred);
        const itemIndex = items.indexOf(item);
        
        const x1 = predPos.left + predPos.width;
        const y1 = predIndex * 40 + 20;
        const x2 = itemPos.left;
        const y2 = itemIndex * 40 + 20;
        
        lines.push(
          <path
            key={`${predId}-${item.id}`}
            d={`M ${x1} ${y1} C ${x1 + 20} ${y1}, ${x2 - 20} ${y2}, ${x2} ${y2}`}
            stroke="#94a3b8"
            strokeWidth="1.5"
            fill="none"
            markerEnd="url(#arrowhead)"
          />
        );
      });
    });
    
    return (
      <svg className="absolute inset-0 pointer-events-none overflow-visible" style={{ zIndex: 1 }}>
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="6" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#94a3b8" />
          </marker>
        </defs>
        {lines}
      </svg>
    );
  };

  if (!viewStart) return null;

  return (
    <div className="border rounded-lg bg-card" data-testid="gantt-chart">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={navigatePrev}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={navigateToday}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={navigateNext}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground ml-2">
            {format(viewStart, 'MMM d, yyyy')}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={zoom} onValueChange={setZoom}>
            <SelectTrigger className="w-24 h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="day">Day</SelectItem>
              <SelectItem value="week">Week</SelectItem>
              <SelectItem value="month">Month</SelectItem>
            </SelectContent>
          </Select>
          
          <Select value={colorBy} onValueChange={() => {}}>
            <SelectTrigger className="w-28 h-8">
              <SelectValue placeholder="Color by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="trade">By Trade</SelectItem>
              <SelectItem value="status">By Status</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chart area */}
      <div className="flex overflow-hidden">
        {/* Task names column */}
        <div className="w-64 flex-shrink-0 border-r bg-muted/30">
          <div className="h-10 border-b px-3 flex items-center font-medium text-sm">
            Task
          </div>
          {items.map((item, index) => (
            <div
              key={item.id}
              className="h-10 border-b px-3 flex items-center gap-2 text-sm hover:bg-muted/50 cursor-pointer"
              onClick={() => onTaskClick?.(item.original)}
            >
              {item.locked && <Lock className="h-3 w-3 text-muted-foreground" />}
              {item.is_blocked && <AlertTriangle className="h-3 w-3 text-red-500" />}
              <span className="truncate flex-1">{item.name}</span>
              {item.crew_size && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {item.crew_size}
                </span>
              )}
            </div>
          ))}
        </div>

        {/* Timeline area */}
        <div className="flex-1 overflow-x-auto" ref={containerRef}>
          {/* Date headers */}
          <div className="flex h-10 border-b bg-muted/30">
            {columns.map((col, i) => (
              <div
                key={i}
                className={`flex-shrink-0 border-r text-center text-xs flex items-center justify-center
                  ${col.isWeekend && showWeekends ? 'bg-slate-100 dark:bg-slate-800/50' : ''}
                  ${col.isHoliday && showHolidays ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                style={{ width: colWidth }}
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Task bars */}
          <div className="relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex">
              {columns.map((col, i) => (
                <div
                  key={i}
                  className={`flex-shrink-0 border-r h-full
                    ${col.isWeekend && showWeekends ? 'bg-slate-50 dark:bg-slate-800/30' : ''}
                    ${col.isHoliday && showHolidays ? 'bg-red-50/50 dark:bg-red-900/10' : ''}`}
                  style={{ width: colWidth }}
                />
              ))}
            </div>

            {/* Dependency lines */}
            {renderDependencyLines()}

            {/* Task bars */}
            {items.map((item, index) => {
              const pos = getTaskPosition(item);
              
              if (pos.left < -100 || pos.left > columns.length * colWidth + 100) {
                return (
                  <div key={item.id} className="h-10 border-b" />
                );
              }
              
              return (
                <div key={item.id} className="h-10 border-b relative" style={{ zIndex: 2 }}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          className={`absolute top-1 h-8 rounded flex items-center px-2 text-white text-xs font-medium
                            ${getItemColor(item)} ${editable && !item.locked ? 'cursor-move' : 'cursor-pointer'}
                            ${item.is_blocked ? 'opacity-75 border-2 border-red-600' : ''}
                            ${item.is_critical ? 'ring-2 ring-orange-400' : ''}`}
                          style={{
                            left: Math.max(0, pos.left),
                            width: Math.max(24, pos.width),
                          }}
                          onClick={() => onTaskClick?.(item.original)}
                          onMouseDown={(e) => handleMouseDown(e, item, 'move')}
                        >
                          <span className="truncate">{item.name}</span>
                          
                          {/* Resize handle */}
                          {editable && !item.locked && (
                            <div
                              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/30"
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                handleMouseDown(e, item, 'resize');
                              }}
                            />
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-xs">
                        <div className="space-y-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs">
                            {format(item.start, 'MMM d')} - {format(item.end, 'MMM d, yyyy')}
                          </p>
                          <div className="flex gap-2 text-xs">
                            {item.trade && <Badge variant="outline">{item.trade}</Badge>}
                            {item.status && <Badge variant="secondary">{item.status}</Badge>}
                          </div>
                          {item.crew_size && (
                            <p className="text-xs flex items-center gap-1">
                              <Users className="h-3 w-3" /> Crew: {item.crew_size}
                            </p>
                          )}
                          {item.quoted_hours && (
                            <p className="text-xs flex items-center gap-1">
                              <Clock className="h-3 w-3" /> Hours: {item.quoted_hours}
                            </p>
                          )}
                          {item.is_blocked && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> BLOCKED
                            </p>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 p-3 border-t bg-muted/30 text-xs">
        <span className="font-medium">Legend:</span>
        {colorBy === 'trade' ? (
          <>
            {Object.entries(TRADE_COLORS).filter(([k]) => k !== 'default').map(([trade, color]) => (
              <div key={trade} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${color}`} />
                <span>{trade}</span>
              </div>
            ))}
          </>
        ) : (
          <>
            {Object.entries(STATUS_COLORS).map(([status, color]) => (
              <div key={status} className="flex items-center gap-1">
                <div className={`w-3 h-3 rounded ${color}`} />
                <span className="capitalize">{status.replace('_', ' ')}</span>
              </div>
            ))}
          </>
        )}
        {showWeekends && (
          <div className="flex items-center gap-1 ml-4">
            <div className="w-3 h-3 bg-slate-200 dark:bg-slate-700 rounded" />
            <span>Weekend</span>
          </div>
        )}
        {showHolidays && (
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-red-100 dark:bg-red-900/30 rounded" />
            <span>Holiday</span>
          </div>
        )}
      </div>
    </div>
  );
}
