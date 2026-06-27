import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, RotateCcw, Send, Sparkles, Clock, AlertTriangle, 
  HelpCircle, Terminal, Coffee, Zap, Info, ShieldAlert, ArrowRight
} from 'lucide-react';
import { Task, ProcrastinationEvent } from '../types';
import { sendFocusChatMessage } from '../api';

interface FocusWorkspaceProps {
  tasks: Task[];
  onLogProcrastination: (activity: string, duration: number) => void;
  procrastinationLogs: ProcrastinationEvent[];
}

export default function FocusWorkspace({
  tasks,
  onLogProcrastination,
  procrastinationLogs
}: FocusWorkspaceProps) {
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [minutes, setMinutes] = useState(25);
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'model'; content: string }[]>([]);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  
  // Procrastination simulation state
  const [procrastinationAlert, setProcrastinationAlert] = useState<{ active: boolean; message: string; actionText?: string } | null>(null);
  const [sessionCompletedAlert, setSessionCompletedAlert] = useState<string | null>(null);

  const intervalRef = useRef<any>(null);

  const activeTask = tasks.find(t => t.id === selectedTaskId);

  // Timer logic
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        if (seconds === 0) {
          if (minutes === 0) {
            clearInterval(intervalRef.current);
            setIsActive(false);
            setSessionCompletedAlert("Focus block completed! Grab a glass of water and take a well-deserved break.");
          } else {
            setMinutes(minutes - 1);
            setSeconds(59);
          }
        } else {
          setSeconds(seconds - 1);
        }
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, minutes, seconds]);

  const handleToggleTimer = () => {
    setIsActive(!isActive);
  };

  const handleResetTimer = () => {
    setIsActive(false);
    setMinutes(25);
    setSeconds(0);
  };

  // Simulate Procrastination Drift
  const handleSimulateDrift = (app: string) => {
    // Log the drift
    onLogProcrastination(app, 5);

    // Prompt custom behavioral intervention
    let advice = "";
    if (app === 'Instagram') {
      advice = "We noticed you opened Instagram today during your slated active focus block. Behavioral AI calculates a 40% drift risk. Let's negotiate: let's start with just 10 minutes of technical work right now. No pressure, just 10 minutes.";
    } else if (app === 'YouTube') {
      advice = "Watching videos during scheduled focus windows will breach your deadline safety margin. We recommend pausing and starting with a quick 5-minute micro-task checklist.";
    } else {
      advice = "Drifting away? Focus inertia is hard to overcome. Open the Focus Copilot and let's outline the very first step together.";
    }

    setProcrastinationAlert({
      active: true,
      message: advice,
      actionText: "Agree to 10-Min Micro-Focus Negotiation"
    });
  };

  const handleAcceptNegotiation = () => {
    setProcrastinationAlert(null);
    setMinutes(10);
    setSeconds(0);
    setIsActive(true);
  };

  // Focus Copilot Chat submit
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const userMsg = chatMessage;
    setChatMessage('');
    setChatHistory(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsSendingMessage(true);

    try {
      const currentTopic = activeTask ? activeTask.title : 'General Productivity Session';
      const historyPayload = chatHistory.map(h => ({
        role: h.role,
        content: h.content
      }));

      const res = await sendFocusChatMessage(currentTopic, userMsg, historyPayload);
      
      setChatHistory(prev => [
        ...prev, 
        { 
          role: 'model', 
          content: `${res.reply}\n\n${res.codeSnippet ? `\`\`\`${res.language || 'javascript'}\n${res.codeSnippet}\n\`\`\`` : ''}\n\n*${res.progressNudge}*` 
        }
      ]);
    } catch (err) {
      console.error(err);
      setChatHistory(prev => [...prev, { role: 'model', content: "I'm having trouble processing that right now. Keep focusing on your core goals!" }]);
    } finally {
      setIsSendingMessage(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      
      {/* Left Column (5-col) - Focus Timer & Anti-procrastination */}
      <div className="lg:col-span-5 space-y-6">
        
        {/* 1. Pomodoro Timer Card */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-6 relative overflow-hidden text-center">
          <div className="absolute top-0 right-0 w-36 h-36 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="space-y-1.5">
            <h3 className="text-sm font-mono text-slate-400 uppercase tracking-wider">Deep Work Block</h3>
            
            <select
              value={selectedTaskId}
              onChange={e => setSelectedTaskId(e.target.value)}
              className="mx-auto w-full max-w-xs bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-slate-200 outline-none text-center"
            >
              <option value="">-- Choose Focus Task --</option>
              {tasks.filter(t => !t.completed).map(task => (
                <option key={task.id} value={task.id}>{task.title}</option>
              ))}
            </select>
          </div>

          {/* Time digits */}
          <div className="text-6xl font-extrabold font-mono text-white tracking-tight py-4">
            {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>

          {/* Controls */}
          <div className="flex justify-center gap-3">
            <button
              onClick={handleToggleTimer}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-1.5 ${
                isActive 
                  ? 'bg-amber-600 hover:bg-amber-500 text-white' 
                  : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-950/40'
              }`}
            >
              {isActive ? (
                <>
                  <Pause className="h-4 w-4" />
                  Hold Session
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 fill-current" />
                  Lock Focus
                </>
              )}
            </button>

            <button
              onClick={handleResetTimer}
              className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          {sessionCompletedAlert && (
            <div className="mt-4 p-3 bg-indigo-950/40 border border-indigo-500/30 rounded-xl text-xs text-indigo-300 flex items-center justify-between gap-2 text-left">
              <span>🎉 <b>Session Completed:</b> {sessionCompletedAlert}</span>
              <button 
                onClick={() => setSessionCompletedAlert(null)}
                className="text-slate-400 hover:text-white font-mono text-sm shrink-0"
              >
                &times;
              </button>
            </div>
          )}
        </div>

        {/* 2. Procrastination Alerts & Simulators */}
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <h3 className="text-md font-bold text-white font-sans">Anti-Procrastination Guard</h3>
          </div>

          <p className="text-xs text-slate-400 leading-normal">
            Productivity companion scans for frequent distractions. Test the intervention model by simulating app switching:
          </p>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              onClick={() => handleSimulateDrift('Instagram')}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-850 hover:text-rose-400 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 font-mono transition-all text-center"
            >
              Switch to Instagram
            </button>
            <button
              onClick={() => handleSimulateDrift('YouTube')}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-850 hover:text-red-400 border border-slate-800 rounded-xl text-xs font-semibold text-slate-300 font-mono transition-all text-center"
            >
              Switch to YouTube
            </button>
          </div>

          {/* District alert panel */}
          {procrastinationAlert && (
            <div className="p-4 bg-amber-950/20 border border-amber-500/20 rounded-xl space-y-3 animate-pulse-slow">
              <div className="flex gap-2.5 text-amber-400">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider">Lapse Detected</span>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">{procrastinationAlert.message}</p>
                </div>
              </div>

              {procrastinationAlert.actionText && (
                <button
                  onClick={handleAcceptNegotiation}
                  className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-slate-950 rounded-lg py-1.5 text-xs font-bold font-mono transition-all flex items-center justify-center gap-1"
                >
                  <span>{procrastinationAlert.actionText}</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          {/* Logs */}
          {procrastinationLogs.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Lapse Log history</span>
              <div className="max-h-24 overflow-y-auto space-y-1 pr-1 font-mono text-[10px] text-slate-400">
                {procrastinationLogs.map((log) => (
                  <div key={log.id} className="flex justify-between p-1.5 bg-slate-950/40 rounded border border-slate-800/40">
                    <span>Drift: {log.activity}</span>
                    <span>{new Date(log.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>

      {/* Right Column (7-col) - Focus Copilot Chat */}
      <div className="lg:col-span-7 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl flex flex-col h-[520px]">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5 text-indigo-400 animate-pulse" />
            <h3 className="text-md font-bold text-white font-sans">Gemini Focus Copilot</h3>
          </div>
          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950 border border-indigo-900 px-2 py-0.5 rounded-md">
            Copilot v3.5
          </span>
        </div>

        {/* Chat History Panel */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 mb-4">
          <div className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-xs text-slate-400 font-sans leading-relaxed">
            👋 I am your deep-session companion. If you have coding syntax questions, need logic blueprints, or want a high-level walkthrough of your active goals, type below. Let's make progress!
          </div>

          {chatHistory.map((h, i) => (
            <div 
              key={i} 
              className={`flex flex-col gap-1 ${h.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <span className="text-[9px] font-mono text-slate-500 uppercase">
                {h.role === 'user' ? 'You' : 'Focus Copilot'}
              </span>
              <div 
                className={`p-3.5 rounded-2xl text-xs max-w-[85%] whitespace-pre-wrap leading-relaxed ${
                  h.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none font-sans' 
                    : 'bg-slate-950 border border-slate-800 text-slate-300 rounded-bl-none font-sans'
                }`}
              >
                {h.content}
              </div>
            </div>
          ))}

          {isSendingMessage && (
            <div className="flex items-center gap-2 text-xs font-mono text-indigo-400 animate-pulse pl-1">
              <Sparkles className="h-4 w-4 animate-spin" />
              <span>Analyzing code and constructing logic reply...</span>
            </div>
          )}
        </div>

        {/* Input form */}
        <form onSubmit={handleSendChatMessage} className="flex gap-2 shrink-0">
          <input
            type="text"
            placeholder={activeTask ? `Ask about "${activeTask.title}"...` : "Choose a focus task or ask anything..."}
            value={chatMessage}
            onChange={e => setChatMessage(e.target.value)}
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-2.5 text-xs text-slate-200 outline-none transition-all font-sans"
            disabled={isSendingMessage}
          />
          <button
            type="submit"
            disabled={isSendingMessage || !chatMessage.trim()}
            className="p-2.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white rounded-xl transition-all disabled:opacity-40"
          >
            <Send className="h-4.5 w-4.5" />
          </button>
        </form>
      </div>

    </div>
  );
}
