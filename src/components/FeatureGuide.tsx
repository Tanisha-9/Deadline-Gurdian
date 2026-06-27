import React from 'react';
import { 
  X, ChevronRight, ChevronLeft, Sparkles, ClipboardList, 
  Calendar, Clock, CheckCircle2, Trash2, HelpCircle, 
  GraduationCap, Briefcase, TrendingUp, Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type PersonaType = 'student' | 'professional' | 'entrepreneur';

interface FeatureGuideProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  persona: PersonaType;
  setPersona: (persona: PersonaType) => void;
  onLoadPersonaMockData: (persona: PersonaType) => void;
}

interface TourStep {
  selector?: string;
  title: string;
  description: string;
  tab?: string;
  icon: React.ReactNode;
}

export default function FeatureGuide({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  persona,
  setPersona,
  onLoadPersonaMockData
}: FeatureGuideProps) {
  const [step, setStep] = React.useState(1);
  const [rect, setRect] = React.useState<DOMRect | null>(null);

  const steps: TourStep[] = [
    {
      title: "Workspace Customization",
      description: "Select your active persona. We customize the AI workspace suggestions, styles, and data models to fit your specific workflow.",
      icon: <Sparkles className="h-5 w-5 text-yellow-400" />
    },
    {
      selector: "#nav-dashboard",
      title: "Tactical AI Dashboard",
      description: "This is your control command. View your customized greeting, habit logs, tomorrow's battle plans, and the Proactive Procrastination Coach tracking status.",
      tab: "dashboard",
      icon: <Info className="h-5 w-5 text-sky-400" />
    },
    {
      selector: "#nav-planner",
      title: "Tasks & Breakdown Tab",
      description: "Manage and explore your task list. This view supports complete task breakdown, technical resources, risk calculations, and emergency rescue setups.",
      tab: "planner",
      icon: <ClipboardList className="h-5 w-5 text-indigo-400" />
    },
    {
      selector: "#task-planner-form",
      title: "Autonomous Task Creator",
      description: "Type any high-level objective (e.g. 'Build portfolio website') and select its priority. Click 'Analyze', and Gemini will generate a detailed milestone checklist instantly.",
      tab: "planner",
      icon: <Sparkles className="h-5 w-5 text-emerald-400" />
    },
    {
      selector: "#first-task-card",
      title: "Interactive Task Cards",
      description: "Check off milestones to update progress in real-time. To delete a task and keep your board clean, click the Trash Bin icon on the top-right of any card.",
      tab: "planner",
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />
    },
    {
      selector: "#nav-calendar",
      title: "Calendar Negotiator",
      description: "Analyze your Google Calendar schedule, find conflict-free deep-work slots, and negotiate dedicated focus time in one tap.",
      tab: "calendar",
      icon: <Calendar className="h-5 w-5 text-amber-400" />
    },
    {
      selector: "#nav-focus",
      title: "Focus Workspace",
      description: "Activate Pomodoro countdown sprints, log distractions, and receive coaching interventions if the AI detects procrastination patterns.",
      tab: "focus",
      icon: <Clock className="h-5 w-5 text-rose-400" />
    },
    {
      selector: "#nav-voice",
      title: "Voice Assistant Planner",
      description: "No time to type? Speak naturally using high-accuracy speech transcription. Confirm and have Gemini break down your verbal goals instantly.",
      tab: "voice",
      icon: <Sparkles className="h-5 w-5 text-purple-400" />
    }
  ];

  const currentStepData = steps[step - 1];

  // Auto-switch tabs to align with step targets
  React.useEffect(() => {
    if (!isOpen) return;
    if (currentStepData?.tab && activeTab !== currentStepData.tab) {
      setActiveTab(currentStepData.tab);
    }
  }, [step, isOpen, setActiveTab, currentStepData, activeTab]);

  // Real-time animation frame polling to track highlighted element's position
  React.useEffect(() => {
    if (!isOpen || step === 1 || !currentStepData?.selector) {
      setRect(null);
      return;
    }

    let rafId: number;
    let scrollTimeout: NodeJS.Timeout;

    const measure = () => {
      const el = document.querySelector(currentStepData.selector!);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect(prev => {
          const isSame = prev && 
            prev.top === r.top && 
            prev.left === r.left && 
            prev.width === r.width && 
            prev.height === r.height;
          
          if (!isSame) {
            // Smoothly scroll the highlighted element into view
            scrollTimeout = setTimeout(() => {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
            return r;
          }
          return prev;
        });
      } else {
        setRect(null);
      }
      rafId = requestAnimationFrame(measure);
    };

    measure();

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(scrollTimeout);
    };
  }, [step, isOpen, currentStepData]);

  if (!isOpen) return null;

  const handleNext = () => {
    if (step < steps.length) {
      setStep(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(prev => prev - 1);
    }
  };

  const selectPersona = (p: PersonaType) => {
    setPersona(p);
    onLoadPersonaMockData(p);
  };

  // Accent colors based on selected persona
  const accentColorClass = {
    student: 'from-emerald-500 to-teal-500 text-emerald-400 border-emerald-500/30 ring-emerald-500/20',
    professional: 'from-indigo-500 to-sky-500 text-indigo-400 border-indigo-500/30 ring-indigo-500/20',
    entrepreneur: 'from-amber-500 to-orange-500 text-amber-400 border-amber-500/30 ring-amber-500/20'
  }[persona];

  const buttonColorClass = {
    student: 'bg-emerald-600 hover:bg-emerald-500 ring-emerald-500/25',
    professional: 'bg-indigo-600 hover:bg-indigo-500 ring-indigo-500/25',
    entrepreneur: 'bg-amber-600 hover:bg-amber-500 ring-amber-500/25'
  }[persona];

  // Compute tooltip location
  const getTooltipStyle = () => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const tooltipWidth = Math.min(380, viewportWidth - 32);

    if (step === 1 || !rect) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 50,
        width: `${tooltipWidth}px`,
        maxHeight: 'calc(100vh - 40px)',
      };
    }

    // On mobile devices (width < 768px), keep the card centered exactly like the start tour card to avoid any bottom/top cutoffs
    if (viewportWidth < 768) {
      return {
        position: 'fixed' as const,
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: `${tooltipWidth}px`,
        maxHeight: 'calc(100vh - 40px)',
        zIndex: 50,
      };
    }

    // X placement: Centered on target, clamped within screen margins
    let left = rect.left + rect.width / 2 - tooltipWidth / 2;
    if (left < 16) left = 16;
    if (left + tooltipWidth > viewportWidth - 16) {
      left = viewportWidth - tooltipWidth - 16;
    }

    // Y placement: Check if we have enough space below or above
    const spaceBelow = viewportHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow >= 240 || spaceBelow > spaceAbove) {
      // Place BELOW the element
      const top = rect.bottom + 12;
      return {
        position: 'fixed' as const,
        top: `${top}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
        maxHeight: `${Math.max(200, viewportHeight - top - 16)}px`,
        zIndex: 50,
      };
    } else {
      // Place ABOVE the element using bottom positioning to grow upward and prevent height mismatch issues
      const bottom = viewportHeight - rect.top + 12;
      return {
        position: 'fixed' as const,
        bottom: `${bottom}px`,
        left: `${left}px`,
        width: `${tooltipWidth}px`,
        maxHeight: `${Math.max(200, rect.top - 16)}px`,
        zIndex: 50,
      };
    }
  };

  const tooltipStyle = getTooltipStyle();

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 overflow-hidden">
        
        {/* SVG Highlight Cutout Overlay */}
        {rect && step > 1 && (
          <svg className="fixed inset-0 w-full h-full pointer-events-none z-40">
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {/* Spotlight hole */}
                <rect
                  x={rect.left - 6}
                  y={rect.top - 6}
                  width={rect.width + 12}
                  height={rect.height + 12}
                  rx={12}
                  ry={12}
                  fill="black"
                />
              </mask>
            </defs>
            <rect 
              x="0" 
              y="0" 
              width="100%" 
              height="100%" 
              fill="rgba(2, 6, 23, 0.82)" 
              mask="url(#spotlight-mask)" 
              className="pointer-events-auto transition-all duration-300"
            />
          </svg>
        )}

        {/* Dark dim cover if step is 1 (centered introduction modal) */}
        {step === 1 && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xs z-40" />
        )}

        {/* Pulsing neon frame outlining the highlighted element */}
        {rect && step > 1 && (
          <div 
            style={{
              position: 'fixed',
              top: `${rect.top - 6}px`,
              left: `${rect.left - 6}px`,
              width: `${rect.width + 12}px`,
              height: `${rect.height + 12}px`,
              borderRadius: '12px',
            }}
            className={`pointer-events-none z-40 border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)] animate-pulse transition-all duration-300 ${
              persona === 'student' 
                ? 'border-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.5)]' 
                : persona === 'professional' 
                  ? 'border-indigo-400 shadow-[0_0_15px_rgba(129,140,248,0.5)]' 
                  : 'border-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.5)]'
            }`}
          />
        )}

        {/* Floating Tooltip / Onboarding Card */}
        {step === 1 ? (
          <div className="fixed inset-0 flex items-center justify-center p-4 z-50 pointer-events-none">
            <motion.div
              key="step-1"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              style={{
                width: `${Math.min(380, window.innerWidth - 32)}px`,
                maxHeight: 'calc(100vh - 40px)',
              }}
              className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-5 md:p-6 overflow-hidden flex flex-col relative pointer-events-auto z-50"
            >
              {/* Top colored accent line */}
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accentColorClass}`} />
              
              <button
                onClick={onClose}
                className="absolute top-4.5 right-4.5 text-slate-500 hover:text-slate-300 transition-all p-1"
                title="Skip Onboarding Tour"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Main scrollable body area to prevent cutoff on smaller viewports */}
              <div className="flex-1 overflow-y-auto pr-1 min-h-0 space-y-4">
                <div className="space-y-4 pt-1">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4.5 w-4.5 text-yellow-400 animate-pulse" />
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">Workspace Onboarding</span>
                    </div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Select Productivity Persona</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Choose a workflow style. We configure template datasets and accent styling to align perfectly with your daily targets:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {/* Student Persona Card */}
                    <button
                      onClick={() => selectPersona('student')}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-3 relative overflow-hidden group ${
                        persona === 'student'
                          ? 'bg-emerald-950/20 border-emerald-500 text-white shadow-lg ring-1 ring-emerald-500/30'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-950/60'
                      }`}
                    >
                      <GraduationCap className={`h-5 w-5 shrink-0 ${persona === 'student' ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="font-semibold text-xs text-white">Student</div>
                        <div className="text-[10px] text-slate-400">DSA study milestones, mock exams, and focus sprints.</div>
                      </div>
                    </button>

                    {/* Professional Persona Card */}
                    <button
                      onClick={() => selectPersona('professional')}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-3 relative overflow-hidden group ${
                        persona === 'professional'
                          ? 'bg-indigo-950/20 border-indigo-500 text-white shadow-lg ring-1 ring-indigo-500/30'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-950/60'
                      }`}
                    >
                      <Briefcase className={`h-5 w-5 shrink-0 ${persona === 'professional' ? 'text-indigo-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="font-semibold text-xs text-white">Professional</div>
                        <div className="text-[10px] text-slate-400">Deep-work, certified cloud pathing, and architectural scaling.</div>
                      </div>
                    </button>

                    {/* Entrepreneur Persona Card */}
                    <button
                      onClick={() => selectPersona('entrepreneur')}
                      className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-3 relative overflow-hidden group ${
                        persona === 'entrepreneur'
                          ? 'bg-amber-950/20 border-amber-500 text-white shadow-lg ring-1 ring-amber-500/30'
                          : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700 hover:bg-slate-950/60'
                      }`}
                    >
                      <TrendingUp className={`h-5 w-5 shrink-0 ${persona === 'entrepreneur' ? 'text-amber-400' : 'text-slate-500'}`} />
                      <div>
                        <div className="font-semibold text-xs text-white">Entrepreneur</div>
                        <div className="text-[10px] text-slate-400">Pitch rounds, product-market scans, and strategic deals.</div>
                      </div>
                    </button>
                  </div>

                  <p className="text-[10px] text-slate-500 leading-normal font-mono">
                    Click "Start Tour" to begin the guided highlight onboarding.
                  </p>
                </div>
              </div>

              {/* Stepper Footer actions - always pinned at the bottom */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 mt-4 shrink-0">
                <button
                  onClick={handleBack}
                  disabled={step === 1}
                  className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-500 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent transition-all"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Back
                </button>

                {/* Step bubbles */}
                <div className="hidden sm:flex gap-1.5">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i + 1)}
                      className={`h-1 rounded-full transition-all ${
                        i + 1 === step 
                          ? 'w-3 ' + (persona === 'student' ? 'bg-emerald-500' : persona === 'professional' ? 'bg-indigo-500' : 'bg-amber-500') 
                          : 'w-1 bg-slate-800 hover:bg-slate-700'
                      }`}
                    />
                  ))}
                </div>

                {/* Mobile page indicator */}
                <span className="sm:hidden text-[10px] font-mono text-slate-500 font-semibold select-none">
                  {step}/{steps.length}
                </span>

                <button
                  onClick={handleNext}
                  className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold font-mono text-white rounded-xl transition-all shadow-lg ring-2 ${buttonColorClass}`}
                >
                  Start Tour
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          </div>
        ) : (
          <motion.div
            key={step}
            initial={{ opacity: 0, scale: 0.95, y: 0 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            style={tooltipStyle}
            className={`bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-4 sm:p-5 md:p-6 overflow-hidden flex flex-col`}
          >
            {/* Top colored accent line */}
            <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${accentColorClass}`} />
            
            <button
              onClick={onClose}
              className="absolute top-4.5 right-4.5 text-slate-500 hover:text-slate-300 transition-all p-1"
              title="Skip Onboarding Tour"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Main scrollable body area to prevent cutoff on smaller viewports */}
            <div className="flex-1 overflow-y-auto pr-1 min-h-0 space-y-4">
              {/* Tour Steps layout showing glowing headers and spotlight info */}
              <div className="space-y-3 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {currentStepData.icon}
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                      Step {step} of {steps.length}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-white tracking-tight">{currentStepData.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{currentStepData.description}</p>
                </div>
              </div>
            </div>

            {/* Stepper Footer actions - always pinned at the bottom */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-800/80 mt-4 shrink-0">
              <button
                onClick={handleBack}
                disabled={step === 1}
                className="flex items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-xs font-mono text-slate-500 hover:text-white disabled:opacity-20 disabled:hover:bg-transparent transition-all"
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              {/* Step bubbles */}
              <div className="hidden sm:flex gap-1.5">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setStep(i + 1)}
                    className={`h-1 rounded-full transition-all ${
                      i + 1 === step 
                        ? 'w-3 ' + (persona === 'student' ? 'bg-emerald-500' : persona === 'professional' ? 'bg-indigo-500' : 'bg-amber-500') 
                        : 'w-1 bg-slate-800 hover:bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              {/* Mobile page indicator */}
              <span className="sm:hidden text-[10px] font-mono text-slate-500 font-semibold select-none">
                {step}/{steps.length}
              </span>

              <button
                onClick={handleNext}
                className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold font-mono text-white rounded-xl transition-all shadow-lg ring-2 ${buttonColorClass}`}
              >
                {step === steps.length ? 'Done' : 'Next'}
                {step < steps.length && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>
          </motion.div>
        )}

      </div>
    </AnimatePresence>
  );
}
