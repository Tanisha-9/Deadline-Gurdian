import React, { useState } from 'react';
import { 
  Plus, Calendar, AlertTriangle, CheckCircle2, Circle, Clock,
  ArrowRight, ShieldAlert, Sparkles, BookOpen, ExternalLink, Check, Play,
  Briefcase, Code, GraduationCap, User, DollarSign, Activity, Trash2
} from 'lucide-react';
import { Task, SubTask } from '../types';
import { calculateTaskUrgency, getRescuePlan } from '../api';

interface TaskPlannerProps {
  tasks: Task[];
  onAddTask: (taskData: { title: string; dueDate: string; priority: 'low' | 'medium' | 'high' }) => Promise<void>;
  onToggleTaskComplete: (taskId: string) => void;
  onToggleSubtaskComplete: (taskId: string, subtaskId: string) => void;
  onUpdateTaskUrgency: (taskId: string, data: any) => void;
  onDeleteTask?: (taskId: string) => void;
  onUpdateTaskSubtasks: (taskId: string, updatedSubtasks: any[], updatedEstHours: number) => void;
  isAddingTask: boolean;
  onActivateRescueMode: (taskId: string, rescuePlan: any) => void;
  activeRescueTaskId: string | null;
  activeRescuePlan: any | null;
}

export default function TaskPlanner({
  tasks,
  onAddTask,
  onToggleTaskComplete,
  onToggleSubtaskComplete,
  onUpdateTaskUrgency,
  onDeleteTask,
  onUpdateTaskSubtasks,
  isAddingTask,
  onActivateRescueMode,
  activeRescueTaskId,
  activeRescuePlan
}: TaskPlannerProps) {
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [isTriggeringUrgency, setIsTriggeringUrgency] = useState<string | null>(null);
  const [isTriggeringRescue, setIsTriggeringRescue] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'critical' | 'completed'>('all');

  // Subparts (Subtask) Editing state variables
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [newSubtaskMinutes, setNewSubtaskMinutes] = useState(30);
  
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskTitle, setEditingSubtaskTitle] = useState('');
  const [editingSubtaskMinutes, setEditingSubtaskMinutes] = useState(30);

  const handleAddSubpart = (task: Task) => {
    if (!newSubtaskTitle.trim()) return;
    const newSub: SubTask = {
      id: 'sub-' + Date.now(),
      title: newSubtaskTitle.trim(),
      estimatedMinutes: Number(newSubtaskMinutes) || 30,
      completed: false
    };
    const updatedSubtasks = [...task.subtasks, newSub];
    const totalMinutes = updatedSubtasks.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const updatedEstHours = Math.max(0.5, Math.round((totalMinutes / 60) * 10) / 10);
    
    onUpdateTaskSubtasks(task.id, updatedSubtasks, updatedEstHours);
    setNewSubtaskTitle('');
  };

  const handleStartEditSubpart = (sub: SubTask) => {
    setEditingSubtaskId(sub.id);
    setEditingSubtaskTitle(sub.title);
    setEditingSubtaskMinutes(sub.estimatedMinutes);
  };

  const handleSaveEditSubpart = (task: Task, subId: string) => {
    if (!editingSubtaskTitle.trim()) return;
    const updatedSubtasks = task.subtasks.map(s => {
      if (s.id === subId) {
        return {
          ...s,
          title: editingSubtaskTitle.trim(),
          estimatedMinutes: Number(editingSubtaskMinutes) || 30
        };
      }
      return s;
    });
    const totalMinutes = updatedSubtasks.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const updatedEstHours = Math.max(0.5, Math.round((totalMinutes / 60) * 10) / 10);
    
    onUpdateTaskSubtasks(task.id, updatedSubtasks, updatedEstHours);
    setEditingSubtaskId(null);
  };

  const handleDeleteSubpart = (task: Task, subId: string) => {
    const updatedSubtasks = task.subtasks.filter(s => s.id !== subId);
    const totalMinutes = updatedSubtasks.reduce((sum, s) => sum + s.estimatedMinutes, 0);
    const updatedEstHours = Math.max(0.5, Math.round((totalMinutes / 60) * 10) / 10);
    
    onUpdateTaskSubtasks(task.id, updatedSubtasks, updatedEstHours);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !dueDate) return;
    await onAddTask({ title, dueDate, priority });
    setTitle('');
    setDueDate('');
    setPriority('medium');
  };

  // Recalculate Urgency using the Engine
  const handleRecalculateUrgency = async (task: Task) => {
    setIsTriggeringUrgency(task.id);
    try {
      const data = await calculateTaskUrgency(task, []);
      onUpdateTaskUrgency(task.id, data);
    } catch (err) {
      console.error('Failed to update urgency:', err);
    } finally {
      setIsTriggeringUrgency(null);
    }
  };

  // Trigger Last-Minute Rescue Mode (Crisis Room)
  const handleTriggerRescueMode = async (task: Task) => {
    setIsTriggeringRescue(task.id);
    try {
      const data = await getRescuePlan(task);
      onActivateRescueMode(task.id, data);
    } catch (err) {
      console.error('Failed to trigger Rescue Mode:', err);
    } finally {
      setIsTriggeringRescue(null);
    }
  };

  // Category Icon Mapper
  const getCategoryIcon = (category?: string) => {
    switch (category?.toLowerCase()) {
      case 'coding':
        return <Code className="h-4 w-4 text-sky-400" />;
      case 'academic':
        return <GraduationCap className="h-4 w-4 text-emerald-400" />;
      case 'career':
        return <Briefcase className="h-4 w-4 text-indigo-400" />;
      case 'personal':
        return <User className="h-4 w-4 text-pink-400" />;
      case 'finance':
        return <DollarSign className="h-4 w-4 text-amber-400" />;
      default:
        return <Activity className="h-4 w-4 text-slate-400" />;
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (filter === 'completed') return t.completed;
    if (filter === 'critical') return !t.completed && (t.riskLevel === 'Critical' || t.riskLevel === 'At Risk');
    return true;
  });

  return (
    <div className="space-y-6">
      
      {/* 1. Add Task Form with Autonomous breakdown description */}
      <div id="task-planner-form" className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-5 w-5 text-emerald-400 animate-pulse" />
          <h2 className="text-lg font-bold text-white font-sans">Add task</h2>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5">
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">Goal or Deliverable</label>
            <input 
              type="text" 
              placeholder="e.g. Build Amazon Sentiment Analyzer" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none transition-all font-sans"
              required
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">Due Date</label>
            <input 
              type="date" 
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none transition-all font-sans font-mono"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">Priority</label>
            <select 
              value={priority}
              onChange={e => setPriority(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none transition-all font-sans"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              type="submit"
              disabled={isAddingTask || !title || !dueDate}
              className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white rounded-xl py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-1 font-mono disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAddingTask ? (
                <>
                  <Clock className="h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Plus className="h-4.5 w-4.5" />
                  Analyze
                </>
              )}
            </button>
          </div>
        </form>

        <p className="text-[10px] text-slate-500 font-mono mt-3">
          ⚡ AI will break this into discrete technical milestones with estimated durations, fetch relevant resources, and output your initial urgency metrics.
        </p>
      </div>

      {/* 2. Tasks Filters & Lists */}
      <div className="space-y-4">
        <div className="flex justify-between items-center bg-slate-950/40 p-1.5 rounded-xl border border-slate-900">
          <div className="flex gap-2">
            <button 
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${filter === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              All Tasks
            </button>
            <button 
              onClick={() => setFilter('critical')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${filter === 'critical' ? 'bg-rose-950/60 text-rose-400 border border-rose-900/30' : 'text-slate-400 hover:text-white'}`}
            >
              At Risk / Critical
            </button>
            <button 
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold font-mono transition-all ${filter === 'completed' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Completed
            </button>
          </div>
          <span className="text-xs text-slate-500 font-mono pr-2">Total: {filteredTasks.length}</span>
        </div>

        {/* Task cards */}
        <div className="space-y-4">
          {filteredTasks.map((task, index) => {
            const isExpanded = expandedTaskId === task.id;
            const completedSubCount = task.subtasks.filter(s => s.completed).length;
            const totalSubCount = task.subtasks.length;
            const subProgressPercent = totalSubCount > 0 ? Math.round((completedSubCount / totalSubCount) * 100) : 0;
            
            // Risk colors mapping
            const riskColors = {
              'Safe': 'text-emerald-400 bg-emerald-950/30 border-emerald-900/40',
              'At Risk': 'text-amber-400 bg-amber-950/30 border-amber-900/40',
              'Critical': 'text-rose-400 bg-rose-950/30 border-rose-900/40'
            }[task.riskLevel] || 'text-slate-400 bg-slate-950/30 border-slate-900';

            return (
              <div 
                key={task.id}
                id={index === 0 ? 'first-task-card' : undefined}
                className={`bg-slate-900 border transition-all duration-300 rounded-2xl overflow-hidden ${
                  isExpanded ? 'border-indigo-500/40 ring-1 ring-indigo-500/10' : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                {/* Header row */}
                <div 
                  onClick={() => setExpandedTaskId(isExpanded ? null : task.id)}
                  className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3.5 flex-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTaskComplete(task.id);
                      }}
                      className="text-slate-500 hover:text-white transition-all shrink-0"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                      ) : (
                        <Circle className="h-6 w-6 text-slate-700 hover:text-slate-500" />
                      )}
                    </button>
                    
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-sm font-semibold transition-all ${task.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                          {task.title}
                        </span>
                        
                        <div className="flex items-center gap-1 bg-slate-950/50 border border-slate-800/80 px-2 py-0.5 rounded text-[10px] font-mono font-medium text-slate-400">
                          {getCategoryIcon(task.category)}
                          <span>{task.category || 'Productivity'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-slate-400 font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-500" />
                          {task.dueDate}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-500" />
                          {task.estimatedHours} hrs est
                        </span>
                        {totalSubCount > 0 && (
                          <>
                            <span>•</span>
                            <span>{completedSubCount}/{totalSubCount} subtasks</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Urgency Risk Engine score on the right */}
                  <div className="flex items-center gap-3 shrink-0 self-end md:self-auto">
                    <div className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold flex items-center gap-1.5 ${riskColors}`}>
                      <AlertTriangle className="h-3.5 w-3.5" />
                      <span>{task.riskLevel}: {task.riskScore}% Risk</span>
                    </div>

                    <div className="h-1.5 w-12 bg-slate-800 rounded-full overflow-hidden hidden sm:block">
                      <div 
                        className={`h-full ${task.riskLevel === 'Critical' ? 'bg-rose-500' : task.riskLevel === 'At Risk' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                        style={{ width: `${task.riskScore}%` }}
                      />
                    </div>

                    {/* Delete button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(`Are you sure you want to delete task "${task.title}"?`)) {
                          onDeleteTask && onDeleteTask(task.id);
                        }
                      }}
                      className="text-slate-500 hover:text-rose-400 p-2 rounded-xl hover:bg-slate-800/60 transition-all cursor-pointer delete-task-btn"
                      title="Delete Task"
                    >
                      <Trash2 className="h-4.5 w-4.5" />
                    </button>
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="border-t border-slate-800/80 p-5 bg-slate-950/40 space-y-6">
                    
                    {/* Subtasks checklists & estimates */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">Milestone Subparts</h4>
                          <span className="text-[11px] font-mono text-indigo-400 font-bold">{subProgressPercent}% complete</span>
                        </div>
                        
                        <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                          {task.subtasks.map((sub) => {
                            const isEditing = editingSubtaskId === sub.id;

                            return (
                              <div 
                                key={sub.id}
                                className={`p-3 rounded-xl border transition-all ${
                                  sub.completed 
                                    ? 'bg-emerald-950/20 border-emerald-500/20 text-slate-400' 
                                    : 'bg-slate-900/60 border-slate-800/80 text-slate-200'
                                }`}
                              >
                                {isEditing ? (
                                  <div className="space-y-2">
                                    <div className="grid grid-cols-12 gap-2">
                                      <input 
                                        type="text"
                                        value={editingSubtaskTitle}
                                        onChange={(e) => setEditingSubtaskTitle(e.target.value)}
                                        className="col-span-8 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded px-2 py-1 text-xs text-white"
                                        placeholder="Subpart title"
                                      />
                                      <input 
                                        type="number"
                                        value={editingSubtaskMinutes}
                                        onChange={(e) => setEditingSubtaskMinutes(Number(e.target.value))}
                                        className="col-span-4 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded px-2 py-1 text-xs text-white font-mono text-center"
                                        placeholder="Minutes"
                                      />
                                    </div>
                                    <div className="flex justify-end gap-1.5 pt-1">
                                      <button 
                                        onClick={() => handleSaveEditSubpart(task, sub.id)}
                                        className="text-[10px] font-bold px-2 py-0.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-mono"
                                      >
                                        Save
                                      </button>
                                      <button 
                                        onClick={() => setEditingSubtaskId(null)}
                                        className="text-[10px] font-bold px-2 py-0.5 bg-slate-800 hover:bg-slate-750 text-slate-400 rounded font-mono"
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center justify-between gap-2">
                                    <div 
                                      onClick={() => onToggleSubtaskComplete(task.id, sub.id)}
                                      className="flex items-center gap-2.5 flex-1 cursor-pointer select-none"
                                    >
                                      <div className={`w-4 h-4 rounded flex items-center justify-center border transition-all ${
                                        sub.completed ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-slate-700'
                                      }`}>
                                        {sub.completed && <Check className="h-3 w-3 stroke-[3]" />}
                                      </div>
                                      <span className={`text-xs ${sub.completed ? 'line-through text-slate-500' : ''}`}>{sub.title}</span>
                                    </div>

                                    <div className="flex items-center gap-2.5 shrink-0 font-mono text-[10px]">
                                      <span className="text-slate-500">{sub.estimatedMinutes}m</span>
                                      
                                      <button 
                                        onClick={() => handleStartEditSubpart(sub)}
                                        className="text-slate-500 hover:text-indigo-400 px-1 hover:underline cursor-pointer"
                                        title="Edit subpart title or duration"
                                      >
                                        Edit
                                      </button>
                                      
                                      <button 
                                        onClick={() => handleDeleteSubpart(task, sub.id)}
                                        className="text-slate-600 hover:text-rose-400 px-1 cursor-pointer"
                                        title="Delete subpart"
                                      >
                                        &times;
                                      </button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {task.subtasks.length === 0 && (
                            <p className="text-xs text-slate-500 font-mono py-2 text-center">No subparts in this task yet.</p>
                          )}
                        </div>

                        {/* Inline Form to Add a Subpart */}
                        <div className="p-3 bg-slate-950/30 border border-slate-800/80 rounded-xl space-y-2 mt-2">
                          <p className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wide">➕ Create New Subpart / Edit Time</p>
                          <div className="flex gap-2">
                            <input 
                              type="text"
                              value={newSubtaskTitle}
                              onChange={(e) => setNewSubtaskTitle(e.target.value)}
                              placeholder="e.g., Code API response handler"
                              className="flex-1 bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg px-2.5 py-1.5 text-xs text-white"
                            />
                            <div className="flex items-center gap-1 shrink-0 w-24">
                              <input 
                                type="number"
                                value={newSubtaskMinutes}
                                onChange={(e) => setNewSubtaskMinutes(Number(e.target.value))}
                                className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-lg px-1.5 py-1.5 text-xs text-white text-center font-mono"
                                title="Time duration in minutes"
                              />
                              <span className="text-[10px] text-slate-500 font-mono">m</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddSubpart(task)}
                            disabled={!newSubtaskTitle.trim()}
                            className="w-full py-1.5 bg-indigo-600/80 hover:bg-indigo-600 disabled:opacity-40 text-white rounded-lg text-xs font-mono font-semibold transition-all"
                          >
                            Add Subpart
                          </button>
                        </div>
                      </div>

                      {/* Urgency Factors & Resource Center */}
                      <div className="space-y-4">
                        <div className="p-4 bg-slate-900 border border-slate-800/60 rounded-xl space-y-3">
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">Urgency Parameters</h4>
                            <button
                              onClick={() => handleRecalculateUrgency(task)}
                              disabled={isTriggeringUrgency === task.id}
                              className="text-[10px] text-indigo-400 font-mono hover:underline disabled:opacity-50"
                            >
                              {isTriggeringUrgency === task.id ? 'Analyzing...' : 'Recalculate Score'}
                            </button>
                          </div>
                          
                          {task.urgencyFactors ? (
                            <div className="grid grid-cols-2 gap-2 text-xs font-mono text-slate-300">
                              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/40">
                                <span className="text-[10px] text-slate-500 block">Time Left</span>
                                <span className="font-semibold text-slate-200">{task.urgencyFactors.timeLeft}</span>
                              </div>
                              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/40">
                                <span className="text-[10px] text-slate-500 block">Hours Required</span>
                                <span className="font-semibold text-slate-200">{task.urgencyFactors.workEstimate}</span>
                              </div>
                              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/40">
                                <span className="text-[10px] text-slate-500 block">Net Free Time</span>
                                <span className="font-semibold text-slate-200">{task.urgencyFactors.freeTime}</span>
                              </div>
                              <div className="bg-slate-950/60 p-2.5 rounded-lg border border-slate-800/40">
                                <span className="text-[10px] text-slate-500 block">Calendar Load</span>
                                <span className="font-semibold text-slate-200">{task.urgencyFactors.calendarLoad}</span>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-slate-500">Urgency parameters pending calculations.</p>
                          )}
                        </div>

                        {/* Learning resources */}
                        {task.resources && task.resources.length > 0 && (
                          <div className="p-4 bg-slate-900 border border-slate-800/60 rounded-xl space-y-2">
                            <h4 className="text-xs font-mono uppercase tracking-wider text-slate-400">Generated Resource Aids</h4>
                            <div className="space-y-1.5 max-h-24 overflow-y-auto">
                              {task.resources.map((res, rIdx) => (
                                <a 
                                  key={rIdx} 
                                  href={`https://www.google.com/search?q=${encodeURIComponent(res)}`}
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="flex items-center justify-between text-xs text-indigo-400 hover:text-indigo-300 transition-all font-mono py-1 border-b border-slate-800/40 last:border-0"
                                >
                                  <span className="truncate flex items-center gap-1.5">
                                    <BookOpen className="h-3.5 w-3.5" />
                                    {res}
                                  </span>
                                  <ExternalLink className="h-3 w-3 shrink-0" />
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                    </div>

                    {/* LAST-MINUTE RESCUE CRISIS MODE BUTTON */}
                    {task.riskScore >= 80 && (
                      <div className="bg-rose-950/20 border border-rose-500/20 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 text-rose-400">
                            <ShieldAlert className="h-4 w-4 animate-bounce" />
                            <h5 className="text-xs font-mono uppercase tracking-wider font-bold">Emergency Level Risk Exceeded</h5>
                          </div>
                          <p className="text-xs text-slate-400">Calculated risk exceeds 80%. AI Crisis Management is unlocked.</p>
                        </div>
                        
                        <button
                          onClick={() => handleTriggerRescueMode(task)}
                          disabled={isTriggeringRescue === task.id || activeRescueTaskId === task.id}
                          className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1 shrink-0 shadow-lg shadow-rose-950"
                        >
                          {isTriggeringRescue === task.id ? (
                            <>
                              <Clock className="h-4.5 w-4.5 animate-spin" />
                              Spinning up Crisis Team...
                            </>
                          ) : activeRescueTaskId === task.id ? (
                            <>
                              <CheckCircle2 className="h-4.5 w-4.5" />
                              Crisis Room Active
                            </>
                          ) : (
                            <>
                              <Play className="h-4 w-4 fill-current" />
                              Activate Rescue Mode
                            </>
                          )}
                        </button>
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}

          {filteredTasks.length === 0 && (
            <div className="text-center py-10 bg-slate-900 border border-slate-800 rounded-2xl">
              <p className="text-sm text-slate-400 font-mono">No tasks found matching current filter.</p>
            </div>
          )}
        </div>
      </div>

      {/* 3. ACTIVE LAST-MINUTE RESCUE INTERVENTION SCREEN (The Crisis Room) */}
      {activeRescueTaskId && activeRescuePlan && (
        <div className="bg-rose-950/30 border border-rose-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden ring-2 ring-rose-500/20 animate-pulse-slow">
          <div className="absolute top-0 right-0 w-48 h-48 bg-rose-500/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex justify-between items-start border-b border-rose-500/20 pb-4 mb-5 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-rose-500 text-white shrink-0">
                  Last-Minute Rescue Active
                </span>
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
              </div>
              <h3 className="text-lg font-bold text-white font-sans mt-1">
                Crisis Center: "{tasks.find(t => t.id === activeRescueTaskId)?.title}"
              </h3>
            </div>
            
            <button
              onClick={() => onActivateRescueMode('', null)}
              className="text-xs text-rose-400 hover:text-rose-300 transition-all font-mono hover:underline"
            >
              Close Crisis Room
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* Action plan checklist */}
            <div className="md:col-span-7 space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-rose-400">Extreme Impact Priority Actions</h4>
              <div className="space-y-2">
                {activeRescuePlan.rescueChecklist.map((item: any, i: number) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-slate-950/60 border border-rose-500/10 rounded-xl">
                    <span className="text-xs font-mono bg-rose-950 border border-rose-800 text-rose-400 w-5 h-5 flex items-center justify-center rounded shrink-0">
                      {i + 1}
                    </span>
                    <span className="text-xs text-slate-200 leading-normal font-medium">{item.title}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Strategy & coaching nudge */}
            <div className="md:col-span-5 space-y-4">
              <div className="p-4 bg-slate-950/60 border border-rose-500/15 rounded-xl space-y-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-rose-400">Scope-Cut Strategy (MVD)</h4>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  {activeRescuePlan.simplifiedStrategy}
                </p>
              </div>

              <div className="p-4 bg-rose-950/40 border border-rose-500/20 rounded-xl relative overflow-hidden">
                <div className="space-y-1">
                  <span className="text-[10px] font-mono uppercase tracking-wider font-semibold text-rose-400">Crisis Coach</span>
                  <p className="text-xs text-rose-100 leading-relaxed font-sans italic font-medium">
                    {activeRescuePlan.crisisNudge}
                  </p>
                </div>
              </div>
            </div>

            {/* Quick access resources */}
            {activeRescuePlan.recommendedResources && activeRescuePlan.recommendedResources.length > 0 && (
              <div className="md:col-span-12 space-y-2.5">
                <h4 className="text-xs font-mono uppercase tracking-wider text-rose-400">Emergency Learning Aids</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {activeRescuePlan.recommendedResources.map((res: any, i: number) => (
                    <a
                      key={i}
                      href={`https://www.google.com/search?q=${encodeURIComponent(res.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-3 bg-slate-950/60 border border-rose-500/10 hover:border-rose-500/20 rounded-xl block hover:bg-slate-950/90 transition-all text-left"
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs font-bold text-slate-200">{res.name}</span>
                        <ExternalLink className="h-3.5 w-3.5 text-rose-400" />
                      </div>
                      <p className="text-xs text-slate-400">{res.description}</p>
                    </a>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
