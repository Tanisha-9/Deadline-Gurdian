import React, { useState } from 'react';
import { 
  Zap, Calendar, BookOpen, Clock, AlertTriangle, CheckCircle, 
  TrendingUp, Compass, Award, ShieldAlert, Sparkles, UserCheck, 
  Mail, ThumbsUp, Trash2, Bell, PlusCircle, Check, Play, Send, ChevronRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Task, Habit, Opportunity, ShadowPlan, ProcrastinationEvent, AccountabilityState } from '../types';
import { dispatchEmailAlert } from '../api';

interface DashboardProps {
  user: any;
  tasks: Task[];
  habits: Habit[];
  opportunities: Opportunity[];
  shadowPlan: ShadowPlan | null;
  onAddOpportunityTask: (opp: Opportunity) => void;
  onDismissOpportunity: (oppId: string) => void;
  onToggleHabit: (habitId: string) => void;
  onTriggerShadowPlan: () => void;
  isGeneratingPlan: boolean;
  procrastinationLogs: ProcrastinationEvent[];
  persona?: 'student' | 'professional' | 'entrepreneur';
  onToggleTaskComplete?: (taskId: string) => void;
  onStartTour?: () => void;
}

export default function Dashboard({
  user,
  tasks,
  habits,
  opportunities,
  shadowPlan,
  onAddOpportunityTask,
  onDismissOpportunity,
  onToggleHabit,
  onTriggerShadowPlan,
  isGeneratingPlan,
  procrastinationLogs,
  persona = 'student',
  onToggleTaskComplete,
  onStartTour
}: DashboardProps) {
  const [showAllPlan, setShowAllPlan] = useState(false);
  const [manualHabitText, setManualHabitText] = useState('');
  const [selectedHabitId, setSelectedHabitId] = useState('');
  const [alertRecipientEmail, setAlertRecipientEmail] = useState('tanishaghanty@gmail.com');
  const [isDispatchingAlert, setIsDispatchingAlert] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any | null>(null);
  const [inAppToasts, setInAppToasts] = useState<{ id: string; message: string; type: 'low' | 'medium' | 'critical' }[]>([]);
  const [toastMessageText, setToastMessageText] = useState('');

  const addToast = (message: string, type: 'low' | 'medium' | 'critical') => {
    const id = Date.now().toString();
    setInAppToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setInAppToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  };

  const handleLogManualHabitCompletion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHabitId && !manualHabitText.trim()) return;
    const targetId = selectedHabitId || (habits[0] ? habits[0].id : '');
    if (targetId) {
      onToggleHabit(targetId);
      const habitObj = habits.find(h => h.id === targetId);
      addToast(`Logged manual completion: "${manualHabitText.trim() || (habitObj ? habitObj.name : 'Active Habit')}"! Daily Streak Incremented.`, 'low');
      setManualHabitText('');
    } else {
      addToast(`Self-Reported completed task: "${manualHabitText.trim()}"! Progress synced.`, 'low');
      setManualHabitText('');
    }
  };

  const handleSendEmailAlert = async () => {
    setIsDispatchingAlert(true);
    setDispatchResult(null);
    try {
      const res = await dispatchEmailAlert(tasks, habits, persona, alertRecipientEmail);
      setDispatchResult(res);
      addToast(`Everyday agenda dispatched securely to ${alertRecipientEmail}!`, 'medium');
    } catch (err: any) {
      console.error(err);
      addToast(`Alert dispatch error: ${err.message}`, 'critical');
    } finally {
      setIsDispatchingAlert(false);
    }
  };


  // Calculate stats
  const totalTasks = tasks.length;
  const completedTasksCount = tasks.filter(t => t.completed).length;
  const atRiskTasks = tasks.filter(t => !t.completed && t.riskLevel === 'At Risk').length;
  const criticalTasks = tasks.filter(t => !t.completed && t.riskLevel === 'Critical').length;

  // Calculate current Accountability Level based on procrastination and critical tasks
  const getAccountabilityState = (): AccountabilityState => {
    const totalCriticalOrRisk = criticalTasks + atRiskTasks;
    const ignoredNudgesCount = procrastinationLogs.length;

    if (criticalTasks >= 2 || ignoredNudgesCount >= 4) {
      return {
        level: 4,
        title: "Level 4: Simplified Strategy Activated",
        description: "Severe risk detected. Standard plan suspended. Scope has been cut to the absolute minimum viable deliverables.",
        remedyAction: "Enter Rescue Mode for your highest critical task immediately."
      };
    } else if (criticalTasks >= 1 || ignoredNudgesCount >= 2) {
      return {
        level: 3,
        title: "Level 3: Emergency Mode Activated",
        description: "You are lagging behind schedule. AI Coach has restructured focus blocks to secure core submission guidelines.",
        remedyAction: "Acknowledge the emergency plan in the Tasks section to get started."
      };
    } else if (totalCriticalOrRisk >= 1 || ignoredNudgesCount >= 1) {
      return {
        level: 2,
        title: "Level 2: Warning - 2 Hrs Behind",
        description: "Slight behavioral drift detected (frequent app switching or ignored focus targets).",
        remedyAction: "Complete a 10-minute micro-focus block to reset your inertia."
      };
    }
    return {
      level: 1,
      title: "Level 1: System Balanced",
      description: "You are currently maintaining focus. All deadlines are within safe buffer windows.",
      remedyAction: "Execute your next Battle Plan item to stay on top."
    };
  };

  const accountability = getAccountabilityState();

  // Color mappings for accountability
  const levelColors = {
    1: "bg-emerald-950/40 border-emerald-500/30 text-emerald-400",
    2: "bg-amber-950/40 border-amber-500/30 text-amber-400",
    3: "bg-orange-950/40 border-orange-500/30 text-orange-400",
    4: "bg-rose-950/40 border-rose-500/30 text-rose-400"
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const greetingDetails = {
    student: {
      title: `Welcome back, ${user?.displayName || 'Scholar'}!`,
      sub: "Your academic sprint is active. DSA milestones, study schedules, and exam goals are fully optimized."
    },
    professional: {
      title: `Welcome back, ${user?.displayName || 'Industry Pro'}!`,
      sub: "Optimize deep work, system design structures, and professional certification timelines."
    },
    entrepreneur: {
      title: `Welcome back, ${user?.displayName || 'Founder'}!`,
      sub: "Pitch prep, fundraising milestones, core team delivery, and market scans are synchronizing."
    }
  }[persona];

  return (
    <div className="space-y-6">
      {/* Welcome & Overview Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white font-sans">
              {greetingDetails.title}
            </h1>
            <Sparkles className="h-5 w-5 text-indigo-400 animate-pulse" />
          </div>
          <p className="text-slate-400 text-sm mt-1">
            {greetingDetails.sub}
          </p>
          {onStartTour && (
            <div className="mt-3.5 flex items-center gap-3">
              <button
                onClick={onStartTour}
                className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-indigo-950/40 hover:shadow-indigo-950/60 transition-all font-mono hover:scale-[1.02] active:scale-[0.98]"
              >
                <Sparkles className="h-4 w-4 animate-pulse fill-current" />
                <span>Take Interactive Tour</span>
              </button>
            </div>
          )}
        </div>

        {/* Stats strip */}
        <div className="flex items-center gap-4 self-stretch md:self-auto overflow-x-auto py-1">
          <div className="bg-slate-950/60 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3 shrink-0">
            <CheckCircle className="h-5 w-5 text-emerald-400" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">Tasks</p>
              <p className="text-sm font-semibold text-slate-200 font-mono">
                {completedTasksCount}/{totalTasks}
              </p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3 shrink-0">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">Critical</p>
              <p className="text-sm font-semibold text-rose-400 font-mono">{criticalTasks}</p>
            </div>
          </div>

          <div className="bg-slate-950/60 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-3 shrink-0">
            <Zap className="h-5 w-5 text-yellow-400 animate-bounce" />
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-mono">Daily Streak</p>
              <p className="text-sm font-semibold text-yellow-400 font-mono">
                {habits.length > 0 ? Math.max(...habits.map(h => h.streak)) : 0} days
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Real-time Toast Notifications */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence>
          {inAppToasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 50, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85, transition: { duration: 0.15 } }}
              className={`p-4 rounded-xl border shadow-xl flex items-start gap-3 pointer-events-auto ${
                toast.type === 'critical'
                  ? 'bg-rose-950/90 border-rose-500/30 text-rose-200'
                  : toast.type === 'medium'
                    ? 'bg-amber-950/90 border-amber-500/30 text-amber-200'
                    : 'bg-slate-900/90 border-slate-700 text-slate-100'
              }`}
            >
              <Bell className={`h-5 w-5 shrink-0 ${toast.type === 'critical' ? 'text-rose-400 animate-bounce' : 'text-indigo-400'}`} />
              <div className="space-y-0.5">
                <span className="text-[10px] font-mono font-bold uppercase tracking-widest block opacity-60">
                  {toast.type === 'critical' ? '🚨 EMERGENCY ACTION ALERT' : toast.type === 'medium' ? '✉️ EMAIL WARNING ACTIVE' : '🔔 LOCAL NOTIFICATION'}
                </span>
                <p className="text-xs leading-relaxed font-sans">{toast.message}</p>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Grid of Accountability, Shadow Plan, Habits, and Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column (8-col width on desktop) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Today's Action Plan (Today's task list in short + User manual task completion) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400 animate-pulse" />
                <h2 className="text-lg font-bold text-white font-sans">Today's Action Plan</h2>
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-900/40 px-2.5 py-0.5 rounded-md">
                {persona === 'student' ? '🎓 STUDENT VIEW' : '💼 PROFESSIONAL VIEW'}
              </span>
            </div>

            {/* Persona-specific Tips Overlay */}
            <div className="mb-4 p-3.5 bg-slate-950/50 border border-slate-800/80 rounded-xl">
              <p className="text-xs text-slate-300 leading-relaxed font-sans flex items-center gap-2">
                <span className="text-xs">💡</span>
                {persona === 'student' ? (
                  <span><b>Student Focus Agenda:</b> Priority is LeetCode DSA practice and checking Flipkart GRiD timeline. Tackle coding before class blocks.</span>
                ) : (
                  <span><b>Pro Deep Work Agenda:</b> Focus on container scale limitations, AWS subnet routing design, and microservices decoupling metrics.</span>
                )}
              </p>
            </div>

            {/* Active Short-form checklist */}
            <div className="space-y-2.5 mb-4 max-h-52 overflow-y-auto pr-1">
              {tasks.filter(t => !t.completed).map((task) => (
                <div key={task.id} className="flex items-center justify-between p-3 bg-slate-950/30 border border-slate-800/80 rounded-xl hover:bg-slate-950/50 transition-all">
                  <div className="flex items-center gap-3">
                    <span className={`h-2.5 w-2.5 rounded-full ${
                      task.riskLevel === 'Critical' ? 'bg-rose-500' : task.riskLevel === 'At Risk' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`} />
                    <div>
                      <span className="text-xs font-semibold text-slate-200 block line-clamp-1">{task.title}</span>
                      <span className="text-[9px] font-mono text-slate-500">
                        Difficulty: {task.difficulty} | Due: {task.dueDate}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-slate-400 px-1.5 py-0.5 bg-slate-900 rounded">
                      {task.subtasks?.filter(s => s.completed).length || 0}/{task.subtasks?.length || 0} subparts
                    </span>
                  </div>
                </div>
              ))}

              {tasks.filter(t => !t.completed).length === 0 && (
                <p className="text-center text-xs text-slate-500 font-mono py-4">
                  🎉 Great job! No active tasks left for today.
                </p>
              )}
            </div>

            {/* Self-Report / Self-Enter Completed Task Option */}
            <form onSubmit={handleLogManualHabitCompletion} className="border-t border-slate-800/80 pt-4 mt-2">
              <div className="flex flex-col sm:flex-row gap-2.5 items-end">
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">
                    Self-Report Completed Task / Habit Detail
                  </label>
                  <input
                    type="text"
                    value={manualHabitText}
                    onChange={(e) => setManualHabitText(e.target.value)}
                    placeholder="E.g., Finished LeetCode Trees Practice or Scaled AWS Auto-group"
                    className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 text-xs p-2.5 rounded-xl text-slate-100 outline-none placeholder:text-slate-600 font-mono"
                  />
                </div>
                
                {habits.length > 0 && (
                  <div className="w-full sm:w-44 space-y-1.5 shrink-0">
                    <label className="text-[10px] font-mono text-slate-500 font-bold uppercase tracking-wider block">
                      Link to Habit Loop
                    </label>
                    <select
                      value={selectedHabitId}
                      onChange={(e) => setSelectedHabitId(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 focus:border-emerald-500/50 text-xs p-2.5 rounded-xl text-slate-300 outline-none font-mono"
                    >
                      <option value="">-- No link --</option>
                      {habits.map(h => (
                        <option key={h.id} value={h.id}>{h.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>Report Completed</span>
                </button>
              </div>
            </form>
          </div>
          
          {/* 1. Proactive Accountability Agent Card */}
          <motion.div 
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className={`border rounded-2xl p-6 shadow-lg ${levelColors[accountability.level]} transition-colors duration-300`}
          >
            <div className="flex items-start gap-4">
              <div className="p-3 bg-slate-950/50 rounded-xl border border-white/5">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div className="space-y-1 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-slate-950/70 border border-white/10">
                    Escalation Level {accountability.level}
                  </span>
                  <span className="h-2 w-2 rounded-full bg-current animate-ping" />
                </div>
                <h3 className="text-lg font-bold font-sans mt-1">{accountability.title}</h3>
                <p className="text-sm opacity-90 leading-relaxed">{accountability.description}</p>
                
                <div className="mt-4 p-3 bg-slate-950/30 rounded-xl border border-white/5 flex items-center gap-2.5">
                  <UserCheck className="h-4 w-4 shrink-0" />
                  <span className="text-xs font-mono font-semibold">Recommended Fix: {accountability.remedyAction}</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 2. Tomorrow's Battle Plan (AI Shadow Planner) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-indigo-400" />
                <h2 className="text-lg font-bold text-white font-sans">Tomorrow's AI Shadow Plan</h2>
              </div>
              
              <button
                onClick={onTriggerShadowPlan}
                disabled={isGeneratingPlan}
                className="text-xs font-semibold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg disabled:opacity-50 transition-all font-mono"
              >
                {isGeneratingPlan ? 'Recalculating...' : 'Regenerate'}
              </button>
            </div>

            {shadowPlan ? (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                
                {/* Circular predicted success gauge */}
                <div className="md:col-span-4 flex flex-col items-center justify-center p-4 bg-slate-950/40 rounded-xl border border-slate-800 text-center">
                  <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-3">Predicted Success</p>
                  
                  <div className="relative w-28 h-28 flex items-center justify-center">
                    {/* SVG Circular path */}
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="56" cy="56" r="46" className="stroke-slate-800" strokeWidth="8" fill="transparent" />
                      <circle 
                        cx="56" cy="56" r="46" 
                        className="stroke-indigo-500 transition-all duration-1000" 
                        strokeWidth="8" 
                        fill="transparent" 
                        strokeDasharray={2 * Math.PI * 46}
                        strokeDashoffset={2 * Math.PI * 46 * (1 - shadowPlan.predictedSuccessRate / 100)}
                        strokeLinecap="round"
                      />
                    </svg>
                    <span className="absolute text-xl font-bold font-mono text-indigo-300">
                      {shadowPlan.predictedSuccessRate}%
                    </span>
                  </div>
                  
                  <p className="text-xs text-indigo-400 mt-3 font-semibold">Ready to Conquer</p>
                </div>

                {/* Timeline display */}
                <div className="md:col-span-8 space-y-3">
                  <p className="text-xs text-slate-500 font-mono uppercase tracking-wider mb-2">Battle Plan Routine</p>
                  
                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {shadowPlan.timeline.slice(0, showAllPlan ? undefined : 3).map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-950/50 border border-slate-800/80 rounded-xl hover:border-slate-700/80 transition-all">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-indigo-400 bg-indigo-950/50 border border-indigo-900/40 px-2 py-0.5 rounded-md">
                            {item.time}
                          </span>
                          <span className="text-sm font-semibold text-slate-200">{item.title}</span>
                        </div>
                        <span className="text-xs text-slate-400 font-mono shrink-0">{item.duration}</span>
                      </div>
                    ))}
                  </div>

                  {shadowPlan.timeline.length > 3 && (
                    <button
                      onClick={() => setShowAllPlan(!showAllPlan)}
                      className="text-xs text-slate-400 hover:text-white transition-all underline block mt-2"
                    >
                      {showAllPlan ? 'Show Less' : `Show ${shadowPlan.timeline.length - 3} More Slots`}
                    </button>
                  )}
                </div>

                {/* Insights banner */}
                <div className="md:col-span-12 p-3.5 bg-indigo-950/30 border border-indigo-500/20 rounded-xl">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-indigo-300 font-sans">AI Daily Recommendation</p>
                      <ul className="list-disc pl-4 text-xs text-slate-300 space-y-1">
                        {shadowPlan.insights.map((insight, idx) => (
                          <li key={idx}>{insight}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-10 bg-slate-950/40 border border-slate-800 rounded-xl">
                <Award className="h-8 w-8 text-indigo-500 mx-auto opacity-60 animate-pulse" />
                <p className="text-sm text-slate-400 mt-2">Generate tomorrow's optimal hourly routing now.</p>
                <button
                  onClick={onTriggerShadowPlan}
                  className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold font-mono"
                >
                  Generate Battle Plan
                </button>
              </div>
            )}
          </div>

          {/* 🚨 AI Smart Alerting & Automation Center */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex justify-between items-center mb-4">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-indigo-400 animate-pulse" />
                <h2 className="text-lg font-bold text-white font-sans">AI Smart Alerting & Dispatcher</h2>
              </div>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 border border-indigo-900/40 px-2.5 py-0.5 rounded-md uppercase tracking-wider font-bold">
                Automated
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed mb-4">
              Our active risk engine maps notifications to your current context. Below are the routing rules configured for your persona:
            </p>

            {/* Interactive Alert Rule Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
              <div 
                onClick={() => addToast("🔔 [TEST] Local Notification: Your task queue is looking healthy!", "low")}
                className="p-3 bg-emerald-950/20 hover:bg-emerald-950/30 border border-emerald-500/20 rounded-xl cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest">Low Risk</span>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <p className="text-xs font-bold text-white font-sans">Local Toast Notification</p>
                <p className="text-[10px] text-slate-400 leading-normal">Triggers a local in-browser alert banner immediately. Click to test.</p>
              </div>

              <div 
                onClick={() => addToast("✉️ [TEST] Email Warnings: Dispatched to tanishaghanty@gmail.com. Frequency rate: 1 mail/3 hours.", "medium")}
                className="p-3 bg-amber-950/20 hover:bg-amber-950/30 border border-amber-500/20 rounded-xl cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-amber-400 uppercase tracking-widest">Medium Risk</span>
                  <Mail className="h-3 w-3 text-amber-400" />
                </div>
                <p className="text-xs font-bold text-white font-sans">Email Warnings</p>
                <p className="text-[10px] text-slate-400 leading-normal">Sent via secure mail server. Frequency limit: 1 mail / 3 hours. Click to test.</p>
              </div>

              <div 
                onClick={() => addToast("🚨 [TEST] Emergency broadcast sent! Scope-cut rescue engine activated.", "critical")}
                className="p-3 bg-rose-950/20 hover:bg-rose-950/30 border border-rose-500/20 rounded-xl cursor-pointer transition-all space-y-1"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono font-bold text-rose-400 uppercase tracking-widest">Critical Mode</span>
                  <AlertTriangle className="h-3 w-3 text-rose-400" />
                </div>
                <p className="text-xs font-bold text-white font-sans">Emergency Mailer</p>
                <p className="text-[10px] text-slate-400 leading-normal">Instant crisis broadcast to rescue your deadlines. Click to test.</p>
              </div>
            </div>

            {/* Dispatch Form */}
            <div className="space-y-3.5 bg-slate-950/50 p-4 border border-slate-800/80 rounded-xl">
              <div className="flex flex-col sm:flex-row gap-3 items-end">
                <div className="flex-1 w-full space-y-1.5">
                  <label className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider block">
                    Recipient Alert Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                      type="email"
                      value={alertRecipientEmail}
                      onChange={(e) => setAlertRecipientEmail(e.target.value)}
                      placeholder="tanishaghanty@gmail.com"
                      className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500/50 text-xs pl-9 pr-3 py-2.5 rounded-xl text-slate-100 outline-none font-mono"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleSendEmailAlert}
                  disabled={isDispatchingAlert}
                  className="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-mono font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shrink-0"
                >
                  <Send className="h-4 w-4" />
                  <span>{isDispatchingAlert ? 'Dispatching...' : 'Dispatch Everyday Agenda'}</span>
                </button>
              </div>

              {/* Rendered HTML Output Display */}
              {dispatchResult && (
                <div className="border-t border-slate-800/80 pt-3.5 mt-2.5 space-y-2.5 animate-fadeIn">
                  <div className="flex justify-between items-center text-[10px] font-mono">
                    <span className="text-slate-400 font-bold uppercase tracking-wider">📤 DELIVERED DIGEST PREVIEW</span>
                    <span className="text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-900/40">
                      {dispatchResult.dispatchStatus}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-1 text-xs">
                    <p className="text-slate-300 font-mono"><b className="text-slate-500">To:</b> {dispatchResult.recipient}</p>
                    <p className="text-slate-300 font-mono"><b className="text-slate-500">Subject:</b> {dispatchResult.subject}</p>
                    <p className="text-indigo-400 font-mono"><b className="text-slate-500">Frequency:</b> {dispatchResult.frequency}</p>
                  </div>

                  {/* Render simulated HTML body nicely inside a safe sandbox block */}
                  <div className="border border-slate-800 rounded-xl overflow-hidden max-h-72 overflow-y-auto bg-slate-950 p-2">
                    <div 
                      className="origin-top scale-95"
                      dangerouslySetInnerHTML={{ __html: dispatchResult.htmlBody }} 
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column (4-col width on desktop) */}
        <div className="lg:col-span-4 space-y-6">
          
          {persona === 'student' ? (
            /* 3. AI Habit + Goal Tracking with Graphs */
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
                <h2 className="text-lg font-bold text-white font-sans">AI Habit Loops</h2>
              </div>

              <div className="space-y-4">
                {habits.map((habit) => {
                  const isCompletedToday = habit.completedDays.includes(todayStr);
                  const completionRate = Math.round((habit.completedDays.length / 7) * 100);

                  return (
                    <div key={habit.id} className="p-3.5 bg-slate-950/50 border border-slate-800 rounded-xl space-y-2.5">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-sm font-semibold text-slate-200">{habit.name}</h4>
                          <p className="text-xs text-slate-500 font-mono mt-0.5">
                            Weekly target: {habit.targetWeekly} days • Streak: {habit.streak}
                          </p>
                        </div>
                        <button
                          onClick={() => onToggleHabit(habit.id)}
                          className={`p-2 rounded-lg border transition-all ${
                            isCompletedToday
                              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <CheckCircle className="h-4.5 w-4.5" />
                        </button>
                      </div>

                      {/* Custom animated progress line */}
                      <div className="space-y-1">
                        <div className="flex justify-between text-[10px] font-mono text-slate-500">
                          <span>7-Day Mastery</span>
                          <span>{completionRate}%</span>
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className="bg-emerald-500 h-full transition-all duration-500"
                            style={{ width: `${Math.min(100, completionRate)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}

                {habits.length === 0 && (
                  <div className="text-center py-6 border border-slate-800 border-dashed rounded-xl">
                    <p className="text-xs text-slate-500 font-mono">No habit loops registered yet.</p>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-800/60">
                  <div className="p-3 bg-slate-950/40 rounded-xl border border-slate-850">
                    <p className="text-[11px] text-emerald-400 font-sans font-medium flex items-center gap-1.5">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>Self-Reporting Instructions</span>
                    </p>
                    <p className="text-[10px] text-slate-400 leading-normal mt-1">
                      Click the circular check icon next to any active loop to report completion. This instantly recalculates your streaks and increments your 7-Day Mastery target.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* High Priority Tasks Scheduled for Today */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-5 w-5 text-amber-400 animate-pulse" />
                    <h2 className="text-lg font-bold text-white font-sans">High Priority Today</h2>
                  </div>
                  <span className="text-[10px] font-mono text-amber-400 bg-amber-950 border border-amber-900/50 px-2.5 py-0.5 rounded-md uppercase tracking-wider font-bold">
                    Today
                  </span>
                </div>

                <div className="space-y-3">
                  {tasks.filter(t => t.priority === 'high' && t.dueDate === todayStr).map((task) => (
                    <div 
                      key={task.id} 
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                        task.completed 
                          ? 'bg-emerald-950/20 border-emerald-500/20 text-slate-400' 
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700 text-slate-200'
                      }`}
                    >
                      <div className="space-y-1">
                        <span className={`text-xs font-semibold block ${task.completed ? 'line-through text-slate-500 font-normal' : ''}`}>
                          {task.title}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500">
                          <span>Est: {task.estimatedHours} hrs</span>
                          <span>•</span>
                          <span className="text-amber-500">{task.difficulty.toUpperCase()}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => onToggleTaskComplete && onToggleTaskComplete(task.id)}
                        className={`p-2 rounded-lg border transition-all shrink-0 ${
                          task.completed
                            ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400 font-bold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                        title={task.completed ? "Mark incomplete" : "Mark complete"}
                      >
                        <Check className="h-4 w-4 stroke-[3]" />
                      </button>
                    </div>
                  ))}

                  {tasks.filter(t => t.priority === 'high' && t.dueDate === todayStr).length === 0 && (
                    <div className="text-center py-6 border border-slate-800 border-dashed rounded-xl">
                      <p className="text-xs text-slate-500 font-mono">No high priority tasks scheduled for today.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Imminent Deadlines (< 2 Days) */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-rose-400 animate-pulse" />
                    <h2 className="text-lg font-bold text-white font-sans">Imminent Deadlines</h2>
                  </div>
                  <span className="text-[10px] font-mono text-rose-400 bg-rose-950 border border-rose-900/50 px-2.5 py-0.5 rounded-md uppercase tracking-wider font-bold">
                    &lt; 2 Days
                  </span>
                </div>

                <div className="space-y-3">
                  {tasks.filter(t => {
                    if (t.completed) return false;
                    if (!t.dueDate) return false;
                    const dDate = new Date(t.dueDate);
                    const today = new Date();
                    dDate.setHours(0,0,0,0);
                    today.setHours(0,0,0,0);
                    const diffTime = dDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 && diffDays < 2;
                  }).map((task) => (
                    <div 
                      key={task.id} 
                      className="p-3.5 bg-slate-950/50 border border-rose-500/20 rounded-xl space-y-1.5 hover:border-rose-500/30 transition-all"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-200 line-clamp-1">
                          {task.title}
                        </span>
                        <span className="text-[9px] font-mono text-rose-400 bg-rose-950/40 border border-rose-900/30 px-1.5 py-0.5 rounded shrink-0">
                          {task.dueDate}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-normal font-sans">
                        Requires {task.estimatedHours}h focus. State: <b className="text-rose-400">{task.riskLevel}</b>
                      </p>
                    </div>
                  ))}

                  {tasks.filter(t => {
                    if (t.completed) return false;
                    if (!t.dueDate) return false;
                    const dDate = new Date(t.dueDate);
                    const today = new Date();
                    dDate.setHours(0,0,0,0);
                    today.setHours(0,0,0,0);
                    const diffTime = dDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    return diffDays >= 0 && diffDays < 2;
                  }).length === 0 && (
                    <div className="text-center py-6 border border-slate-800 border-dashed rounded-xl">
                      <p className="text-xs text-slate-500 font-mono">No imminent deadlines under 2 days.</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {/* 4. AI Opportunity Detector (Gmail Scanner) */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-indigo-400 animate-pulse" />
                <h2 className="text-lg font-bold text-white font-sans">Opportunity Alerts</h2>
              </div>
              <span className="text-[10px] font-mono uppercase bg-indigo-950 border border-indigo-900 text-indigo-400 px-2 py-0.5 rounded-md">
                Gmail Scanner
              </span>
            </div>

            <div className="space-y-3">
              {opportunities.filter(opp => opp.status === 'detected').map((opp) => (
                <div key={opp.id} className="p-3.5 bg-slate-950/70 border border-indigo-500/10 hover:border-indigo-500/20 rounded-xl space-y-2.5 transition-all">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-200 line-clamp-1">{opp.title}</h4>
                    {opp.dueDate && (
                      <span className="text-[9px] font-mono text-rose-400 bg-rose-950/40 border border-rose-900/30 px-1.5 py-0.5 rounded">
                        Due: {opp.dueDate}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 leading-normal">{opp.description}</p>
                  
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={() => onAddOpportunityTask(opp)}
                      className="text-[10px] font-semibold px-2.5 py-1 bg-indigo-600/90 hover:bg-indigo-600 text-white rounded-md transition-all font-mono"
                    >
                      Plan Prepare Task
                    </button>
                    <button
                      onClick={() => onDismissOpportunity(opp.id)}
                      className="text-[10px] font-semibold px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white rounded-md transition-all font-mono border border-slate-800"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}

              {opportunities.filter(opp => opp.status === 'detected').length === 0 && (
                <div className="text-center py-8 bg-slate-950/30 rounded-xl border border-slate-800/80">
                  <Mail className="h-6 w-6 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-mono">No new high-value hackathons, exams, or interview emails detected.</p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
