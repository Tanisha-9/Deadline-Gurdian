import React, { useState } from 'react';
import { 
  Calendar, Clock, AlertCircle, RefreshCw, CheckCircle, 
  Sparkles, ShieldCheck, ThumbsUp, HelpCircle, AlertTriangle,
  Lock, Unlock, Layers, CalendarDays, PlusCircle, Check, Info, Bell
} from 'lucide-react';
import { CalendarEvent, Task } from '../types';
import { getCalendarNegotiations, createGoogleCalendarEvent } from '../api';

interface CalendarManagerProps {
  accessToken: string | null;
  calendarEvents: CalendarEvent[];
  tasks: Task[];
  onRefreshCalendar: () => void;
  isLoadingCalendar: boolean;
  onAddFocusBlock: (block: CalendarEvent) => void;
  onModifyEvent: (eventId: string, updatedEvent: any) => void;
  onUpdateTaskProperties?: (taskId: string, properties: Partial<Task>) => void;
}

export default function CalendarManager({
  accessToken,
  calendarEvents,
  tasks,
  onRefreshCalendar,
  isLoadingCalendar,
  onAddFocusBlock,
  onModifyEvent,
  onUpdateTaskProperties
}: CalendarManagerProps) {
  // AI Negotiator states
  const [negotiatingTaskId, setNegotiatingTaskId] = useState<string>('');
  const [negotiationSuggestions, setNegotiationSuggestions] = useState<any[]>([]);
  const [isNegotiating, setIsNegotiating] = useState(false);
  const [negotiatedStatus, setNegotiatedStatus] = useState<string>('');

  // Selected time-slot options inside AI negotiation
  // 0 = Slot A (early proposed focus block)
  // 1 = Slot B (afternoon alternative)
  // 2 = Slot C (evening alternative)
  // 3 = Custom slot (manual date/time)
  const [selectedSlotOption, setSelectedSlotOption] = useState<number>(0);
  const [customSlotDate, setCustomSlotDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customSlotStart, setCustomSlotStart] = useState<string>('09:00');
  const [customSlotEnd, setCustomSlotEnd] = useState<string>('11:30');

  // Direct Calendar Commitment Form states
  const [directTitle, setDirectTitle] = useState('');
  const [directType, setDirectType] = useState<'meeting' | 'pitch' | 'exam' | 'official'>('meeting');
  const [directDate, setDirectDate] = useState(new Date().toISOString().split('T')[0]);
  const [directStart, setDirectStart] = useState('10:00');
  const [directEnd, setDirectEnd] = useState('11:00');
  const [directIsOfficial, setDirectIsOfficial] = useState(true);
  const [directStatus, setDirectStatus] = useState('');

  // Book Pending Task Directly states
  const [bookingTaskId, setBookingTaskId] = useState('');
  const [bookingDate, setBookingDate] = useState(new Date().toISOString().split('T')[0]);
  const [bookingStart, setBookingStart] = useState('14:00');
  const [bookingEnd, setBookingEnd] = useState('16:00');
  const [bookingStatus, setBookingStatus] = useState('');

  // Fetch current selected negotiating task object
  const currentNegotiatingTask = tasks.find(t => t.id === negotiatingTaskId);

  // Run AI Calendar Negotiation
  const handleNegotiate = async () => {
    if (!negotiatingTaskId) return;
    const task = tasks.find(t => t.id === negotiatingTaskId);
    if (!task) return;

    if (task.isNonShiftable) {
      setNegotiatedStatus('Warning: This task is locked as Non-Shiftable. Negotiation suggestions will respect the current slot constraints.');
    }

    setIsNegotiating(true);
    setNegotiatedStatus('');
    try {
      const data = await getCalendarNegotiations(calendarEvents, task);
      setNegotiationSuggestions(data.suggestions || []);
      setSelectedSlotOption(0); // reset to Slot A by default
    } catch (err) {
      console.error('Failed to negotiate:', err);
    } finally {
      setIsNegotiating(false);
    }
  };

  // Helper to construct starting and ending ISO strings based on selected slot option
  const getSelectedSlotTimes = (suggestion: any) => {
    const todayStr = new Date().toISOString().split('T')[0];
    
    // Default fallback start/end from proposal
    let startIso = suggestion.proposedBlock?.start || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    let endIso = suggestion.proposedBlock?.end || new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();

    if (selectedSlotOption === 1) {
      // Slot B: Afternoon focus slot
      startIso = new Date(`${todayStr}T14:00:00`).toISOString();
      endIso = new Date(`${todayStr}T16:30:00`).toISOString();
    } else if (selectedSlotOption === 2) {
      // Slot C: Evening / Night Owl focus slot
      startIso = new Date(`${todayStr}T19:00:00`).toISOString();
      endIso = new Date(`${todayStr}T21:30:00`).toISOString();
    } else if (selectedSlotOption === 3) {
      // Custom selected slot
      try {
        startIso = new Date(`${customSlotDate}T${customSlotStart}:00`).toISOString();
        endIso = new Date(`${customSlotDate}T${customSlotEnd}:00`).toISOString();
      } catch {
        // Fallback
      }
    }
    return { startIso, endIso };
  };

  // User approves suggestion with slot override option
  const handleApproveNegotiation = async (suggestion: any) => {
    if (suggestion.type === 'focus_block') {
      const { startIso, endIso } = getSelectedSlotTimes(suggestion);
      setNegotiatedStatus('Booking selected focus slot in your calendar...');
      
      try {
        if (accessToken) {
          // Write directly to Google Calendar!
          const bookedBlock = await createGoogleCalendarEvent(accessToken, {
            summary: suggestion.proposedBlock?.summary || suggestion.title,
            start: startIso,
            end: endIso
          });
          onAddFocusBlock(bookedBlock);
          setNegotiatedStatus('Focus slot successfully scheduled on Google Calendar!');
        } else {
          // If mock mode, insert locally
          onAddFocusBlock({
            id: 'fb-' + Date.now(),
            summary: suggestion.proposedBlock?.summary || suggestion.title,
            start: startIso,
            end: endIso,
            isFocusBlock: true
          });
          setNegotiatedStatus('Local Focus slot booked (Mock Mode)!');
        }
        
        // Remove or modify target event if reschedule is recommended and task allows shift
        const targetReschedule = negotiationSuggestions.find(s => s.type === 'reschedule');
        if (targetReschedule && targetReschedule.targetEventId && !currentNegotiatingTask?.isNonShiftable) {
          onModifyEvent(targetReschedule.targetEventId, {
            summary: `${targetReschedule.title} (AI Optimized/Rescheduled)`
          });
        }
        
        // Clear suggestions after short timeout
        setTimeout(() => {
          setNegotiationSuggestions([]);
          setNegotiatingTaskId('');
          setNegotiatedStatus('');
        }, 3000);
      } catch (err) {
        console.error('Failed to book focus block:', err);
        setNegotiatedStatus('Failed to complete booking.');
      }
    } else if (suggestion.type === 'reschedule') {
      if (currentNegotiatingTask?.isNonShiftable) {
        setNegotiatedStatus('Booking blocked: This task is locked and cannot be rescheduled.');
        return;
      }

      if (suggestion.targetEventId) {
        onModifyEvent(suggestion.targetEventId, {
          summary: `${suggestion.title} (Moved)`
        });
        setNegotiatedStatus(`Approved: ${suggestion.title}. Event rescheduled successfully.`);
        setTimeout(() => setNegotiatedStatus(''), 3000);
      }
    }
  };

  // Submit direct calendar event
  const handleAddDirectEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!directTitle.trim()) return;

    setDirectStatus('Adding commitment...');
    try {
      const startIso = new Date(`${directDate}T${directStart}:00`).toISOString();
      const endIso = new Date(`${directDate}T${directEnd}:00`).toISOString();
      const eventTitle = `${directTitle} [${directType.toUpperCase()}]`;

      if (accessToken) {
        const addedEvent = await createGoogleCalendarEvent(accessToken, {
          summary: eventTitle,
          start: startIso,
          end: endIso
        });
        // Tag as official if requested
        if (directIsOfficial) {
          addedEvent.isOfficial = true;
          addedEvent.alarmTriggered30 = false;
          addedEvent.alarmTriggered15 = false;
        }
        onAddFocusBlock(addedEvent);
        setDirectStatus('Commitment added successfully to Google Calendar!');
      } else {
        onAddFocusBlock({
          id: 'dir-' + Date.now(),
          summary: eventTitle,
          start: startIso,
          end: endIso,
          isOfficial: directIsOfficial,
          alarmTriggered30: false,
          alarmTriggered15: false
        });
        setDirectStatus('Local commitment scheduled (Mock Mode)!');
      }

      setDirectTitle('');
      setTimeout(() => setDirectStatus(''), 3500);
    } catch (err) {
      console.error(err);
      setDirectStatus('Failed to schedule commitment.');
    }
  };

  // Schedule task directly to calendar
  const handleBookTaskDirectly = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingTaskId) return;

    const task = tasks.find(t => t.id === bookingTaskId);
    if (!task) return;

    setBookingStatus('Booking task slot...');
    try {
      const startIso = new Date(`${bookingDate}T${bookingStart}:00`).toISOString();
      const endIso = new Date(`${bookingDate}T${bookingEnd}:00`).toISOString();

      if (accessToken) {
        const booked = await createGoogleCalendarEvent(accessToken, {
          summary: `Focus: ${task.title}`,
          start: startIso,
          end: endIso
        });
        onAddFocusBlock(booked);
        setBookingStatus(`"${task.title}" successfully added to Google Calendar!`);
      } else {
        onAddFocusBlock({
          id: 'tsk-' + Date.now(),
          summary: `Focus: ${task.title}`,
          start: startIso,
          end: endIso,
          isFocusBlock: true
        });
        setBookingStatus(`Local Focus Block booked for "${task.title}"!`);
      }

      setBookingTaskId('');
      setTimeout(() => setBookingStatus(''), 3500);
    } catch (err) {
      console.error(err);
      setBookingStatus('Failed to book task directly.');
    }
  };

  // Format time range helper
  const formatTimeRange = (startStr: string, endStr: string) => {
    try {
      const start = new Date(startStr);
      const end = new Date(endStr);
      const formatTime = (d: Date) => d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const formatDate = (d: Date) => d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
      return `${formatDate(start)} @ ${formatTime(start)} - ${formatTime(end)}`;
    } catch {
      return 'Time Unspecified';
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* LEFT COLUMN: Google Calendar List & direct commitment scheduling */}
      <div className="lg:col-span-7 space-y-6">
        
        {/* Calendar Commitments list */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-indigo-400" />
              <h2 className="text-lg font-bold text-white font-sans">Calendar Commitments</h2>
            </div>
            
            <button
              onClick={onRefreshCalendar}
              disabled={isLoadingCalendar}
              className="p-2 bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-white rounded-xl disabled:opacity-40 transition-all"
              title="Refresh from Google Calendar"
            >
              <RefreshCw className={`h-4.5 w-4.5 ${isLoadingCalendar ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {accessToken ? (
            <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-950/30 border border-emerald-900/30 p-2.5 rounded-xl">
              <ShieldCheck className="h-4.5 w-4.5 shrink-0" />
              <span className="font-mono">Real-time Google Calendar Active</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-amber-400 bg-amber-950/20 border border-amber-900/30 p-2.5 rounded-xl">
              <AlertCircle className="h-4.5 w-4.5 shrink-0" />
              <span className="font-sans">Using local calendar state. Sign in with Google above to sync real-time commitments.</span>
            </div>
          )}

          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            {calendarEvents.map((event) => {
              const isOfficial = event.isOfficial || 
                event.summary.toLowerCase().includes('pitch') || 
                event.summary.toLowerCase().includes('meeting') || 
                event.summary.toLowerCase().includes('exam') || 
                event.summary.toLowerCase().includes('interview');

              return (
                <div 
                  key={event.id}
                  className={`flex items-start justify-between gap-4 p-3.5 border rounded-xl transition-all ${
                    event.isFocusBlock 
                      ? 'bg-yellow-950/20 border-yellow-500/20 text-yellow-300'
                      : isOfficial
                        ? 'bg-rose-950/25 border-rose-500/30 text-rose-300 shadow-md shadow-rose-950/10'
                        : 'bg-slate-950/50 border-slate-800 text-slate-200'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      {event.isFocusBlock && <Sparkles className="h-4 w-4 text-yellow-400 animate-pulse shrink-0" />}
                      {isOfficial && <Bell className="h-4 w-4 text-rose-400 animate-pulse shrink-0" />}
                      <span className="text-xs font-semibold">{event.summary}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400 font-mono">
                      <Clock className="h-3 w-3 text-slate-500" />
                      <span>{formatTimeRange(event.start, event.end)}</span>
                    </div>
                  </div>
                  
                  {event.isFocusBlock && (
                    <span className="text-[9px] font-mono font-bold bg-yellow-950 border border-yellow-800 text-yellow-400 px-1.5 py-0.5 rounded uppercase">
                      AI Focus Block
                    </span>
                  )}
                  {isOfficial && (
                    <span className="text-[9px] font-mono font-bold bg-rose-950 border border-rose-800 text-rose-400 px-1.5 py-0.5 rounded uppercase">
                      Alarm Enabled
                    </span>
                  )}
                </div>
              );
            })}

            {calendarEvents.length === 0 && (
              <div className="text-center py-10 bg-slate-950/30 rounded-xl border border-slate-800 border-dashed">
                <Calendar className="h-8 w-8 text-slate-600 mx-auto opacity-60" />
                <p className="text-sm text-slate-500 font-mono mt-2">No upcoming calendar commitments found.</p>
              </div>
            )}
          </div>
        </div>

        {/* 1. Direct Slotted Commitment Scheduler Form (Meetings / Pitch / Exams) */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <PlusCircle className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Schedule Official Commitment</h2>
          </div>
          
          <p className="text-xs text-slate-400 leading-normal">
            Directly register meetings, sales pitches, or exams. Enabling the alarm activates dramatic overlay notifications 30 and 15 minutes prior to start.
          </p>

          <form onSubmit={handleAddDirectEvent} className="space-y-3 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              <div className="md:col-span-8">
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  value={directTitle}
                  onChange={(e) => setDirectTitle(e.target.value)}
                  placeholder="e.g., Sequoia Seed Fund Pitch Meeting"
                  className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-600 outline-none"
                />
              </div>

              <div className="md:col-span-4">
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Type</label>
                <select
                  value={directType}
                  onChange={(e: any) => setDirectType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-300 outline-none font-sans"
                >
                  <option value="meeting">👥 Meeting</option>
                  <option value="pitch">🚀 Sales Pitch</option>
                  <option value="exam">📝 Exam Goal</option>
                  <option value="official">🏢 Official Slotted</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={directDate}
                  onChange={(e) => setDirectDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-300 outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={directStart}
                  onChange={(e) => setDirectStart(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-300 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">End Time</label>
                <input
                  type="time"
                  required
                  value={directEnd}
                  onChange={(e) => setDirectEnd(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-300 outline-none font-mono"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-950/40 p-3 rounded-xl border border-slate-850">
              <input
                id="directIsOfficial"
                type="checkbox"
                checked={directIsOfficial}
                onChange={(e) => setDirectIsOfficial(e.target.checked)}
                className="w-4.5 h-4.5 rounded border-slate-800 text-indigo-600 focus:ring-0 bg-slate-950 cursor-pointer"
              />
              <label htmlFor="directIsOfficial" className="text-xs text-slate-300 select-none cursor-pointer">
                <b>Enable Warning Alarms</b> (Reminds you at 30 min and 15 min with snooze/accept triggers)
              </label>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-semibold font-mono rounded-xl py-2.5 text-xs transition-all flex items-center justify-center gap-1.5"
            >
              <CalendarDays className="h-4 w-4" />
              Schedule Official Commitment
            </button>

            {directStatus && (
              <p className="text-xs text-indigo-400 font-mono text-center pt-1 animate-pulse">{directStatus}</p>
            )}
          </form>
        </div>
      </div>

      {/* RIGHT COLUMN: AI Calendar Negotiator with custom features */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* 2. AI Calendar Negotiator with Lock/Overlap & Time Slot Selector */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-36 h-36 bg-yellow-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-400 animate-pulse" />
            <h2 className="text-lg font-bold text-white font-sans">AI Calendar Negotiator</h2>
          </div>

          <p className="text-xs text-slate-400 leading-normal">
            Select a high-priority task. Toggle locks to keep times immutable, or allow dual-task scheduling overrides during AI slot calculations.
          </p>

          <div className="space-y-4">
            {/* Task selector */}
            <div>
              <label className="block text-xs font-mono uppercase text-slate-400 mb-1.5">Target Task</label>
              <select
                value={negotiatingTaskId}
                onChange={e => {
                  setNegotiatingTaskId(e.target.value);
                  setNegotiationSuggestions([]);
                }}
                className="w-full bg-slate-950 border border-slate-800 focus:border-yellow-500 rounded-xl px-4 py-2.5 text-sm text-slate-200 outline-none transition-all font-sans"
              >
                <option value="">-- Choose High Priority Task --</option>
                {tasks.filter(t => !t.completed).map(task => (
                  <option key={task.id} value={task.id}>
                    {task.title} {task.isNonShiftable ? '🔒' : ''} {task.allowOverlap ? '👥' : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Task specific settings (Lock, Overlap) */}
            {currentNegotiatingTask && (
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3.5">
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider font-bold">
                  ⚡ SLOT NEGOTIATION POLICY FOR THIS TASK
                </p>
                
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      {currentNegotiatingTask.isNonShiftable ? <Lock className="h-3.5 w-3.5 text-rose-400" /> : <Unlock className="h-3.5 w-3.5 text-slate-500" />}
                      Lock Slot Time (Non-Shiftable)
                    </p>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Prevents AI negotiation from shifting this event's allocated calendar hour.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateTaskProperties && onUpdateTaskProperties(currentNegotiatingTask.id, { isNonShiftable: !currentNegotiatingTask.isNonShiftable })}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                      currentNegotiatingTask.isNonShiftable
                        ? 'bg-rose-950/50 border-rose-500/40 text-rose-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {currentNegotiatingTask.isNonShiftable ? 'LOCKED' : 'SHIFT KEY'}
                  </button>
                </div>

                <div className="flex items-start justify-between gap-2 border-t border-slate-900 pt-3">
                  <div className="space-y-0.5">
                    <p className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                      <Layers className="h-3.5 w-3.5 text-indigo-400" />
                      Allow Same-Slot Overlaps
                    </p>
                    <p className="text-[10px] text-slate-500 leading-normal">
                      Permits booking this focus task directly alongside another event in the same time block.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onUpdateTaskProperties && onUpdateTaskProperties(currentNegotiatingTask.id, { allowOverlap: !currentNegotiatingTask.allowOverlap })}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold border transition-all ${
                      currentNegotiatingTask.allowOverlap
                        ? 'bg-indigo-950 border-indigo-500/40 text-indigo-400'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {currentNegotiatingTask.allowOverlap ? 'OVERLAP OK' : 'EXCLUSIVE'}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleNegotiate}
              disabled={isNegotiating || !negotiatingTaskId}
              className="w-full bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-700 text-slate-950 rounded-xl py-2.5 text-sm font-bold transition-all flex items-center justify-center gap-1.5 font-mono disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isNegotiating ? (
                <>
                  <Clock className="h-4.5 w-4.5 animate-spin" />
                  Negotiating Optimal Slots...
                </>
              ) : (
                'Initiate AI Negotiation'
              )}
            </button>

            {/* Status info */}
            {negotiatedStatus && (
              <div className="p-3.5 bg-slate-950 border border-yellow-500/20 rounded-xl text-xs text-yellow-400 font-mono leading-normal">
                {negotiatedStatus}
              </div>
            )}

            {/* AI Optimization Suggestions with SLOT SELECTION after negotiation */}
            {negotiationSuggestions.length > 0 && (
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-mono uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  AI Optimization Proposal
                </h4>

                {negotiationSuggestions.map((suggestion, idx) => (
                  <div key={idx} className="p-3.5 bg-slate-950/80 border border-yellow-500/15 rounded-xl space-y-3 hover:border-yellow-500/25 transition-all">
                    <div>
                      <span className={`text-[9px] font-mono uppercase tracking-wider font-bold px-1.5 py-0.5 rounded ${
                        suggestion.type === 'focus_block' ? 'bg-yellow-950 text-yellow-400' : 'bg-rose-950 text-rose-400'
                      }`}>
                        {suggestion.type === 'focus_block' ? 'Suggested Focus Block' : 'Reschedule Recommendation'}
                      </span>
                      <h5 className="text-xs font-bold text-slate-200 mt-1">{suggestion.title}</h5>
                      <p className="text-[11px] text-slate-400 leading-normal mt-0.5">{suggestion.description}</p>
                    </div>

                    {/* INTERACTIVE SLOT SELECTOR OPTIONS */}
                    {suggestion.type === 'focus_block' && (
                      <div className="space-y-2 border-t border-slate-900 pt-3">
                        <p className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wide">
                          Select Preferred Time Slot:
                        </p>
                        
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2.5 p-2 bg-slate-900 rounded-lg border border-slate-850 cursor-pointer hover:bg-slate-850/50">
                            <input 
                              type="radio" 
                              name="slotOption" 
                              checked={selectedSlotOption === 0} 
                              onChange={() => setSelectedSlotOption(0)}
                              className="text-yellow-500 focus:ring-0 bg-slate-950 border-slate-800"
                            />
                            <div className="text-left">
                              <p className="text-xs text-slate-200 font-sans font-medium">Early Focus Slot (AI Proposed)</p>
                              <p className="text-[10px] font-mono text-slate-500">{formatTimeRange(suggestion.proposedBlock?.start, suggestion.proposedBlock?.end)}</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-2.5 p-2 bg-slate-900 rounded-lg border border-slate-850 cursor-pointer hover:bg-slate-850/50">
                            <input 
                              type="radio" 
                              name="slotOption" 
                              checked={selectedSlotOption === 1} 
                              onChange={() => setSelectedSlotOption(1)}
                              className="text-yellow-500 focus:ring-0 bg-slate-950 border-slate-800"
                            />
                            <div className="text-left">
                              <p className="text-xs text-slate-200 font-sans font-medium">Afternoon Focus Block</p>
                              <p className="text-[10px] font-mono text-slate-500">Today @ 2:00 PM - 4:30 PM</p>
                            </div>
                          </label>

                          <label className="flex items-center gap-2.5 p-2 bg-slate-900 rounded-lg border border-slate-850 cursor-pointer hover:bg-slate-850/50">
                            <input 
                              type="radio" 
                              name="slotOption" 
                              checked={selectedSlotOption === 2} 
                              onChange={() => setSelectedSlotOption(2)}
                              className="text-yellow-500 focus:ring-0 bg-slate-950 border-slate-800"
                            />
                            <div className="text-left">
                              <p className="text-xs text-slate-200 font-sans font-medium">Night Owl Deep Focus</p>
                              <p className="text-[10px] font-mono text-slate-500">Today @ 7:00 PM - 9:30 PM</p>
                            </div>
                          </label>

                          <label className="flex flex-col gap-2 p-2 bg-slate-900 rounded-lg border border-slate-850 cursor-pointer">
                            <div className="flex items-center gap-2.5">
                              <input 
                                type="radio" 
                                name="slotOption" 
                                checked={selectedSlotOption === 3} 
                                onChange={() => setSelectedSlotOption(3)}
                                className="text-yellow-500 focus:ring-0 bg-slate-950 border-slate-800"
                              />
                              <p className="text-xs text-slate-200 font-sans font-medium">Custom Specified Slot</p>
                            </div>
                            
                            {selectedSlotOption === 3 && (
                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 pt-1">
                                <input 
                                  type="date"
                                  value={customSlotDate}
                                  onChange={e => setCustomSlotDate(e.target.value)}
                                  className="bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-white"
                                />
                                <input 
                                  type="time"
                                  value={customSlotStart}
                                  onChange={e => setCustomSlotStart(e.target.value)}
                                  className="bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-white font-mono"
                                />
                                <input 
                                  type="time"
                                  value={customSlotEnd}
                                  onChange={e => setCustomSlotEnd(e.target.value)}
                                  className="bg-slate-950 border border-slate-800 rounded p-1 text-[10px] text-white font-mono"
                                />
                              </div>
                            )}
                          </label>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={() => handleApproveNegotiation(suggestion)}
                      className="w-full bg-slate-900 hover:bg-slate-850 text-yellow-400 hover:text-yellow-300 rounded-xl py-2 text-xs font-bold font-mono border border-slate-800 flex items-center justify-center gap-1.5"
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                      Approve & Book Selected Slot
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 3. OPTION TO ADD TASK DIRECTLY TO GOOGLE/LOCAL CALENDAR FROM HERE */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-400" />
            <h2 className="text-sm font-bold text-white font-mono uppercase tracking-wider">Book Task Slot Directly</h2>
          </div>
          
          <p className="text-xs text-slate-400 leading-normal">
            Directly block out dedicated calendar hours for any of your pending milestones from here instantly.
          </p>

          <form onSubmit={handleBookTaskDirectly} className="space-y-3 pt-1">
            <div>
              <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Select Pending Task</label>
              <select
                required
                value={bookingTaskId}
                onChange={e => setBookingTaskId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none"
              >
                <option value="">-- Select Milestone Task --</option>
                {tasks.filter(t => !t.completed).map(task => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={bookingDate}
                  onChange={(e) => setBookingDate(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">Start Time</label>
                <input
                  type="time"
                  required
                  value={bookingStart}
                  onChange={(e) => setBookingStart(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">End Time</label>
                <input
                  type="time"
                  required
                  value={bookingEnd}
                  onChange={(e) => setBookingEnd(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-850 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-300 outline-none font-mono"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={!bookingTaskId}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold font-mono rounded-xl py-2.5 text-xs transition-all flex items-center justify-center gap-1"
            >
              <Check className="h-4 w-4" />
              Schedule Focus Block Now
            </button>

            {bookingStatus && (
              <p className="text-xs text-emerald-400 font-mono text-center pt-1 animate-pulse">{bookingStatus}</p>
            )}
          </form>
        </div>

      </div>

    </div>
  );
}
