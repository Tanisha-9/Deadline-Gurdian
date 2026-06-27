import React, { useState, useEffect } from 'react';
import { 
  Zap, Calendar, BookOpen, Clock, AlertTriangle, Sparkles, LogIn, LogOut,
  Sliders, ClipboardList, Shield, Compass, ChevronRight, CheckCircle2, User,
  HelpCircle, Bell, Check, ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  initAuth, googleSignIn, logout, db, auth 
} from './firebase';
import { 
  collection, addDoc, getDocs, updateDoc, deleteDoc, doc, query, where, serverTimestamp 
} from 'firebase/firestore';
import { Task, Habit, CalendarEvent, Opportunity, ProcrastinationEvent, ShadowPlan } from './types';
import { 
  getTaskBreakdown, calculateTaskUrgency, generateShadowPlan, 
  fetchGoogleCalendarEvents, fetchRecentEmails, detectGmailOpportunities 
} from './api';

// Sub-components
import Dashboard from './components/Dashboard';
import TaskPlanner from './components/TaskPlanner';
import CalendarManager from './components/CalendarManager';
import FocusWorkspace from './components/FocusWorkspace';
import VoiceAssistant from './components/VoiceAssistant';
import FeatureGuide, { PersonaType } from './components/FeatureGuide';

// Standard error handling requested by firebase-integration skill
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error Info: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initial Mock Datasets for rich offline/non-signed-in sandbox
const initialMockTasks: Task[] = [
  {
    id: 'mock-1',
    title: 'Build Amazon Sentiment Analyzer',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 2 days
    estimatedHours: 8,
    completedHours: 1,
    difficulty: 'hard',
    priority: 'high',
    completed: false,
    riskScore: 92,
    riskLevel: 'Critical',
    category: 'Coding',
    resources: ['Vader Sentiment Docs', 'NLTK Tutorial', 'Amazon AWS NLP'],
    urgencyFactors: {
      timeLeft: '2 days remaining',
      workEstimate: '7 hours remaining',
      freeTime: 'Approx 3 hours available',
      calendarLoad: 'High (4 meetings scheduled)'
    },
    subtasks: [
      { id: 'sub-1', title: 'Dataset Collection from reviews API', estimatedMinutes: 45, completed: true },
      { id: 'sub-2', title: 'Data Cleaning & pre-processing text', estimatedMinutes: 60, completed: false },
      { id: 'sub-3', title: 'Model Training (Logistic Regression/Transformers)', estimatedMinutes: 120, completed: false },
      { id: 'sub-4', title: 'Dashboard Design with Tailwind & React', estimatedMinutes: 90, completed: false },
      { id: 'sub-5', title: 'Testing & deployment to Cloud Run', estimatedMinutes: 60, completed: false }
    ]
  },
  {
    id: 'mock-2',
    title: 'Flipkart GRiD Registration & Team formation',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 3 days
    estimatedHours: 2.5,
    completedHours: 0,
    difficulty: 'medium',
    priority: 'high',
    completed: false,
    riskScore: 55,
    riskLevel: 'At Risk',
    category: 'Career',
    resources: ['Flipkart GRiD Rules', 'Previous competitive hackathon submissions'],
    urgencyFactors: {
      timeLeft: '3 days remaining',
      workEstimate: '2.5 hours remaining',
      freeTime: '8 hours free time',
      calendarLoad: 'Light (1 event scheduled)'
    },
    subtasks: [
      { id: 'sub-6', title: 'Review contest guidelines & eligibility', estimatedMinutes: 30, completed: false },
      { id: 'sub-7', title: 'Form a 3-member team on portal', estimatedMinutes: 60, completed: false },
      { id: 'sub-8', title: 'Select core track (Robotics/Web3/Security)', estimatedMinutes: 45, completed: false }
    ]
  }
];

const initialMockHabits: Habit[] = [
  { id: 'habit-1', name: 'DSA LeetCoding Practice', targetWeekly: 5, completedDays: [], streak: 3 },
  { id: 'habit-2', name: 'Resume & Portfolio Updates', targetWeekly: 2, completedDays: [], streak: 1 },
  { id: 'habit-3', name: 'Academic Assignment Review', targetWeekly: 3, completedDays: [], streak: 2 }
];

const initialMockCalendar: CalendarEvent[] = [
  { id: 'cal-1', summary: 'Football Game Practice', start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString() },
  { id: 'cal-2', summary: 'College DSA Lecture', start: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString() },
  { id: 'cal-3', summary: 'Mock Job Interview Prep Session', start: new Date(Date.now() + 45 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 46 * 60 * 60 * 1000).toISOString() }
];

const initialMockOpportunities: Opportunity[] = [
  {
    id: 'opp-1',
    title: 'Flipkart GRiD 7.0 hackathon registration',
    description: 'Competitive coding track closing in 3 days. Prepare registration details.',
    source: 'email',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'detected'
  },
  {
    id: 'opp-2',
    title: 'Amazon SDE Interview Confirmation round',
    description: 'Upcoming technical screening scheduled in 10 days.',
    source: 'email',
    dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'detected'
  }
];

// Professional Mock Datasets
const initialMockTasksPro: Task[] = [
  {
    id: 'mock-p1',
    title: 'System Design: Scale Core Microservices',
    dueDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    estimatedHours: 12,
    completedHours: 3,
    difficulty: 'hard',
    priority: 'high',
    completed: false,
    riskScore: 78,
    riskLevel: 'At Risk',
    category: 'Career',
    resources: ['Designing Data-Intensive Applications', 'Scaling Microservices on Kubernetes', 'Redis Caching Patterns'],
    urgencyFactors: {
      timeLeft: '2 days remaining',
      workEstimate: '9 hours remaining',
      freeTime: 'Approx 4 hours available',
      calendarLoad: 'Medium (3 team syncs)'
    },
    subtasks: [
      { id: 'sub-p1', title: 'Read Chapter 4 of DDIA (Encoding & Evolution)', estimatedMinutes: 90, completed: true },
      { id: 'sub-p2', title: 'Draw high-level caching architecture diagram', estimatedMinutes: 60, completed: false },
      { id: 'sub-p3', title: 'Review database partitioning & replication strategies', estimatedMinutes: 120, completed: false },
      { id: 'sub-p4', title: 'Write technical spec draft for core services', estimatedMinutes: 90, completed: false }
    ]
  },
  {
    id: 'mock-p2',
    title: 'AWS Certified Solutions Architect Exam prep',
    dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    estimatedHours: 4,
    completedHours: 0,
    difficulty: 'medium',
    priority: 'high',
    completed: false,
    riskScore: 40,
    riskLevel: 'Safe',
    category: 'Career',
    resources: ['AWS S3 Security Best Practices', 'AWS VPC Peering & Transit Gateway'],
    urgencyFactors: {
      timeLeft: '4 days remaining',
      workEstimate: '4 hours remaining',
      freeTime: 'Approx 12 hours free',
      calendarLoad: 'Light (no conflicts)'
    },
    subtasks: [
      { id: 'sub-p5', title: 'Complete 65-question practice test on Udemy', estimatedMinutes: 130, completed: false },
      { id: 'sub-p6', title: 'Review incorrect answers on VPC networking', estimatedMinutes: 60, completed: false }
    ]
  }
];

const initialMockHabitsPro: Habit[] = [
  { id: 'habit-p1', name: 'Deep Focus Coding Block', targetWeekly: 5, completedDays: [], streak: 4 },
  { id: 'habit-p2', name: 'Refactor Technical Debt', targetWeekly: 2, completedDays: [], streak: 2 },
  { id: 'habit-p3', name: 'Industry Tech Newsletter Reading', targetWeekly: 3, completedDays: [], streak: 1 }
];

const initialMockCalendarPro: CalendarEvent[] = [
  { id: 'cal-p1', summary: 'Daily Engineering Standup', start: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 11 * 60 * 60 * 1000).toISOString() },
  { id: 'cal-p2', summary: 'Sprint Retrospective & Demo', start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString() },
  { id: 'cal-p3', summary: '1-on-1 Tech Lead Check-in', start: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 49 * 60 * 60 * 1000).toISOString() }
];

const initialMockOpportunitiesPro: Opportunity[] = [
  {
    id: 'opp-p1',
    title: 'AWS Summit Speaker Submission open',
    description: 'Submit abstract about serverless scaling optimization. Deadline in 5 days.',
    source: 'email',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'detected'
  },
  {
    id: 'opp-p2',
    title: 'Lead Architect Inbound Opportunity',
    description: 'Recruiter at Stripe reached out regarding scaling team lead position.',
    source: 'email',
    status: 'detected'
  }
];

// Entrepreneur Mock Datasets
const initialMockTasksEnt: Task[] = [
  {
    id: 'mock-e1',
    title: 'Refine Seed Round Pitch Deck & projections',
    dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    estimatedHours: 15,
    completedHours: 5,
    difficulty: 'hard',
    priority: 'high',
    completed: false,
    riskScore: 85,
    riskLevel: 'Critical',
    category: 'Finance',
    resources: ['Sequoia Pitch Deck Template', 'Startup Financial Model Excel Builder'],
    urgencyFactors: {
      timeLeft: '3 days remaining',
      workEstimate: '10 hours remaining',
      freeTime: 'Approx 5 hours free',
      calendarLoad: 'High (4 investor chats)'
    },
    subtasks: [
      { id: 'sub-e1', title: 'Complete TAM, SAM, and SOM sizing calculations', estimatedMinutes: 120, completed: true },
      { id: 'sub-e2', title: 'Flesh out 3-year cash flow & hiring plan projections', estimatedMinutes: 180, completed: false },
      { id: 'sub-e3', title: 'Refine slide on go-to-market (GTM) strategy', estimatedMinutes: 120, completed: false },
      { id: 'sub-e4', title: 'Practice 5-minute elevator pitch and Q&A prep', estimatedMinutes: 120, completed: false }
    ]
  },
  {
    id: 'mock-e2',
    title: 'Draft B2B Beta Client Agreements',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    estimatedHours: 5,
    completedHours: 1,
    difficulty: 'medium',
    priority: 'medium',
    completed: false,
    riskScore: 35,
    riskLevel: 'Safe',
    category: 'Finance',
    resources: ['Standard SaaS Beta Agreement Template', 'GDPR Compliance Checklists'],
    urgencyFactors: {
      timeLeft: '5 days remaining',
      workEstimate: '4 hours remaining',
      freeTime: 'Approx 15 hours free',
      calendarLoad: 'Light'
    },
    subtasks: [
      { id: 'sub-e5', title: 'Draft SLA limitations and liabilities section', estimatedMinutes: 90, completed: true },
      { id: 'sub-e6', title: 'Review IP protection clauses with mock legal builder', estimatedMinutes: 120, completed: false }
    ]
  }
];

const initialMockHabitsEnt: Habit[] = [
  { id: 'habit-e1', name: 'Cold Sales Outreach & Calls', targetWeekly: 5, completedDays: [], streak: 6 },
  { id: 'habit-e2', name: 'Active Pitch Deck Review & Edits', targetWeekly: 3, completedDays: [], streak: 2 },
  { id: 'habit-e3', name: 'Product Demo Refinement', targetWeekly: 4, completedDays: [], streak: 3 }
];

const initialMockCalendarEnt: CalendarEvent[] = [
  { id: 'cal-e1', summary: 'Pitch Meeting: Sequoia Capital Partner', start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString() },
  { id: 'cal-e2', summary: 'Acme Corp Enterprise Intro Call', start: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString() },
  { id: 'cal-e3', summary: 'Team Sync & Product Demo Review', start: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(), end: new Date(Date.now() + 31 * 60 * 60 * 1000).toISOString() }
];

const initialMockOpportunitiesEnt: Opportunity[] = [
  {
    id: 'opp-e1',
    title: 'Y Combinator W27 application open',
    description: 'Submit draft application. Deadline in 4 days.',
    source: 'email',
    dueDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    status: 'detected'
  },
  {
    id: 'opp-e2',
    title: 'Inbound Pilot Offer: TechCorp Inc',
    description: 'Email inquiry regarding potential SaaS deployment for 200 seats.',
    source: 'email',
    status: 'detected'
  }
];

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active Persona State
  const [persona, setPersona] = useState<PersonaType>(() => {
    const saved = localStorage.getItem('user_persona');
    return (saved as PersonaType) || 'student';
  });

  // Tour Overlay State
  const [showTour, setShowTour] = useState(() => {
    const hasCompleted = localStorage.getItem('has_completed_tour');
    return !hasCompleted;
  });

  // App core state
  const [tasks, setTasks] = useState<Task[]>(() => {
    const saved = localStorage.getItem('user_persona') as PersonaType;
    if (saved === 'professional') return initialMockTasksPro;
    if (saved === 'entrepreneur') return initialMockTasksEnt;
    return initialMockTasks;
  });
  const [habits, setHabits] = useState<Habit[]>(() => {
    const saved = localStorage.getItem('user_persona') as PersonaType;
    if (saved === 'professional') return initialMockHabitsPro;
    if (saved === 'entrepreneur') return initialMockHabitsEnt;
    return initialMockHabits;
  });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>(() => {
    const saved = localStorage.getItem('user_persona') as PersonaType;
    if (saved === 'professional') return initialMockCalendarPro;
    if (saved === 'entrepreneur') return initialMockCalendarEnt;
    return initialMockCalendar;
  });
  const [opportunities, setOpportunities] = useState<Opportunity[]>(() => {
    const saved = localStorage.getItem('user_persona') as PersonaType;
    if (saved === 'professional') return initialMockOpportunitiesPro;
    if (saved === 'entrepreneur') return initialMockOpportunitiesEnt;
    return initialMockOpportunities;
  });
  const [procrastinationLogs, setProcrastinationLogs] = useState<ProcrastinationEvent[]>([]);
  const [shadowPlan, setShadowPlan] = useState<ShadowPlan | null>(null);

  // Load persona-specific mock datasets
  const handleLoadPersonaMockData = (selectedPersona: PersonaType) => {
    localStorage.setItem('user_persona', selectedPersona);
    if (selectedPersona === 'student') {
      setTasks(initialMockTasks);
      setHabits(initialMockHabits);
      setCalendarEvents(initialMockCalendar);
      setOpportunities(initialMockOpportunities);
    } else if (selectedPersona === 'professional') {
      setTasks(initialMockTasksPro);
      setHabits(initialMockHabitsPro);
      setCalendarEvents(initialMockCalendarPro);
      setOpportunities(initialMockOpportunitiesPro);
    } else if (selectedPersona === 'entrepreneur') {
      setTasks(initialMockTasksEnt);
      setHabits(initialMockHabitsEnt);
      setCalendarEvents(initialMockCalendarEnt);
      setOpportunities(initialMockOpportunitiesEnt);
    }
  };

  // Loaders
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [activeRescueTaskId, setActiveRescueTaskId] = useState<string | null>(null);
  const [activeRescuePlan, setActiveRescuePlan] = useState<any | null>(null);

  // Alarm states for meetings, pitch, exams, etc.
  const [activeAlarm, setActiveAlarm] = useState<{
    eventId: string;
    summary: string;
    minutesRemaining: number;
    type: '30' | '15';
  } | null>(null);
  const [snoozedAlarms, setSnoozedAlarms] = useState<{ [eventId: string]: number }>({});

  // Active navigation tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'planner' | 'calendar' | 'focus' | 'voice'>('dashboard');

  // Real-time alarm background monitor
  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date();
      calendarEvents.forEach(event => {
        // Only run alarms for official commitments (marked as isOfficial, or keywords)
        const isEventOfficial = event.isOfficial || 
          event.summary.toLowerCase().includes('pitch') || 
          event.summary.toLowerCase().includes('meeting') || 
          event.summary.toLowerCase().includes('exam') || 
          event.summary.toLowerCase().includes('interview');
          
        if (!isEventOfficial) return;

        const startTime = new Date(event.start);
        const diffMs = startTime.getTime() - now.getTime();
        const diffMins = Math.ceil(diffMs / (1000 * 60));

        // Check if snooze is active for this event
        const snoozeExpiry = snoozedAlarms[event.id];
        if (snoozeExpiry && now.getTime() < snoozeExpiry) {
          return; // Skip, currently snoozed
        }

        // Trigger 30-min alarm
        if (diffMins > 15 && diffMins <= 30) {
          if (!event.alarmTriggered30) {
            setActiveAlarm({
              eventId: event.id,
              summary: event.summary,
              minutesRemaining: diffMins,
              type: '30'
            });
          }
        }
        // Trigger 15-min alarm
        else if (diffMins > 0 && diffMins <= 15) {
          if (!event.alarmTriggered15) {
            setActiveAlarm({
              eventId: event.id,
              summary: event.summary,
              minutesRemaining: diffMins,
              type: '15'
            });
          }
        }
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [calendarEvents, snoozedAlarms]);

  const handleAcceptAlarm = (eventId: string, type: '30' | '15') => {
    setCalendarEvents(prev => prev.map(e => {
      if (e.id === eventId) {
        return type === '30' 
          ? { ...e, alarmTriggered30: true }
          : { ...e, alarmTriggered15: true };
      }
      return e;
    }));
    setActiveAlarm(null);
  };

  const handleSnoozeAlarm = (eventId: string) => {
    // Snooze for 5 minutes
    setSnoozedAlarms(prev => ({
      ...prev,
      [eventId]: Date.now() + 5 * 60 * 1000
    }));
    setActiveAlarm(null);
  };

  // Trigger Firebase/OAuth setup state
  useEffect(() => {
    initAuth(
      (currentUser, cachedToken) => {
        setUser(currentUser);
        setToken(cachedToken);
        loadUserFirestoreData(currentUser.uid, cachedToken);
      },
      () => {
        // Fallback to mock state if no auth or logged out
        setUser(null);
        setToken(null);
      }
    );
  }, []);

  // Fetch from Firestore + Google APIs once logged in
  const loadUserFirestoreData = async (userId: string, accessToken: string) => {
    try {
      // 1. Fetch tasks
      const tPath = 'tasks';
      let loadedTasks: Task[] = [];
      try {
        const qTasks = query(collection(db, tPath), where('userId', '==', userId));
        const querySnapshot = await getDocs(qTasks);
        querySnapshot.forEach((docItem) => {
          loadedTasks.push({ id: docItem.id, ...docItem.data() } as Task);
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, tPath);
      }
      if (loadedTasks.length > 0) setTasks(loadedTasks);

      // 2. Fetch habits
      const hPath = 'habits';
      let loadedHabits: Habit[] = [];
      try {
        const qHabits = query(collection(db, hPath), where('userId', '==', userId));
        const habitsSnapshot = await getDocs(qHabits);
        habitsSnapshot.forEach((docItem) => {
          loadedHabits.push({ id: docItem.id, ...docItem.data() } as Habit);
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, hPath);
      }
      if (loadedHabits.length > 0) setHabits(loadedHabits);

      // 3. Fetch opportunities
      const oppPath = 'opportunities';
      let loadedOpps: Opportunity[] = [];
      try {
        const qOpp = query(collection(db, oppPath), where('userId', '==', userId));
        const oppSnapshot = await getDocs(qOpp);
        oppSnapshot.forEach((docItem) => {
          loadedOpps.push({ id: docItem.id, ...docItem.data() } as Opportunity);
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.LIST, oppPath);
      }
      if (loadedOpps.length > 0) setOpportunities(loadedOpps);

      // 4. Load Google Calendar and Gmail
      syncWithGoogleWorkspace(accessToken);

    } catch (error) {
      console.error('Failed to load user firestore data:', error);
    }
  };

  const syncWithGoogleWorkspace = async (accessToken: string) => {
    setIsLoadingCalendar(true);
    try {
      // Google Calendar fetch
      const events = await fetchGoogleCalendarEvents(accessToken);
      if (events && events.length > 0) {
        setCalendarEvents(events);
      }

      // Gmail scans & Opportunities detection
      const recentEmails = await fetchRecentEmails(accessToken);
      if (recentEmails && recentEmails.length > 0) {
        const detectRes = await detectGmailOpportunities(recentEmails);
        if (detectRes && detectRes.opportunities) {
          setOpportunities(prev => {
            // merge opportunities uniquely
            const existingTitles = new Set(prev.map(p => p.title));
            const newOpps = detectRes.opportunities.filter(o => !existingTitles.has(o.title));
            return [...newOpps, ...prev];
          });
        }
      }
    } catch (err) {
      console.warn('Google Workspace sync failed. Fallback to offline assets.', err);
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  // Google sign in click
  const handleLoginClick = async () => {
    setIsLoggingIn(true);
    try {
      const result = await googleSignIn();
      if (result) {
        setUser(result.user);
        setToken(result.accessToken);
        await loadUserFirestoreData(result.user.uid, result.accessToken);
      }
    } catch (err) {
      console.error('Google Sign-In failed:', err);
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout click
  const handleLogoutClick = async () => {
    const confirmed = window.confirm('Are you sure you want to sign out?');
    if (!confirmed) return;
    await logout();
    setUser(null);
    setToken(null);
    setTasks(initialMockTasks);
    setHabits(initialMockHabits);
    setCalendarEvents(initialMockCalendar);
    setOpportunities(initialMockOpportunities);
    setProcrastinationLogs([]);
    setShadowPlan(null);
  };

  // Centralized Task Addition with Autonomous Breakdown
  const handleAddTask = async (taskData: { title: string; dueDate: string; priority: 'low' | 'medium' | 'high' }) => {
    setIsAddingTask(true);
    try {
      // 1. Trigger Gemini Autonomous Task Breakdown
      const breakdown = await getTaskBreakdown(taskData.title, taskData.dueDate);
      
      // Form structured task object
      const subtasks = (breakdown.subtasks || []).map((sub, idx) => ({
        id: `sub-${Date.now()}-${idx}`,
        title: sub.title,
        estimatedMinutes: sub.estimatedMinutes,
        completed: false
      }));

      const newTaskObj: Omit<Task, 'id'> = {
        title: taskData.title,
        dueDate: taskData.dueDate,
        estimatedHours: breakdown.estimatedHours || 4,
        completedHours: 0,
        difficulty: breakdown.difficulty || 'medium',
        priority: taskData.priority,
        completed: false,
        category: breakdown.category || 'Productivity',
        subtasks,
        riskScore: 35, // starting risk, will be recalculated
        riskLevel: 'Safe'
      };

      // 2. Trigger Urgency score calculation
      const urgencyResult = await calculateTaskUrgency(newTaskObj as Task, calendarEvents);
      
      newTaskObj.riskScore = urgencyResult.riskScore;
      newTaskObj.riskLevel = urgencyResult.riskLevel;
      newTaskObj.urgencyFactors = urgencyResult.urgencyFactors;

      // 3. Write to Firestore if authenticated, else save in local state
      if (user) {
        const pathForWrite = 'tasks';
        const docRef = await addDoc(collection(db, pathForWrite), {
          ...newTaskObj,
          userId: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.CREATE, pathForWrite));
        
        if (docRef) {
          setTasks(prev => [{ id: docRef.id, ...newTaskObj } as Task, ...prev]);
        }
      } else {
        // sandbox mode
        const offlineTask = { id: `task-${Date.now()}`, ...newTaskObj } as Task;
        setTasks(prev => [offlineTask, ...prev]);
      }

    } catch (err) {
      console.error('Failed to analyze task:', err);
    } finally {
      setIsAddingTask(false);
    }
  };

  // Toggle general task completion
  const handleToggleTaskComplete = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    // Mutate state
    const updatedComplete = !task.completed;
    const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, completed: updatedComplete } : t);
    setTasks(updatedTasks);

    if (user && !taskId.startsWith('mock-')) {
      const pathForUpdate = `tasks/${taskId}`;
      await updateDoc(doc(db, 'tasks', taskId), {
        completed: updatedComplete,
        updatedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, pathForUpdate));
    }
  };

  // Complete task deletion
  const handleDeleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    
    if (activeRescueTaskId === taskId) {
      setActiveRescueTaskId(null);
      setActiveRescuePlan(null);
    }

    if (user && !taskId.startsWith('mock-')) {
      const pathForDelete = `tasks/${taskId}`;
      await deleteDoc(doc(db, 'tasks', taskId))
        .catch(err => handleFirestoreError(err, OperationType.DELETE, pathForDelete));
    }
  };

  // Toggle subtask completion (Recalculates risk in real-time)
  const handleToggleSubtaskComplete = async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const updatedSubtasks = task.subtasks.map(s => s.id === subtaskId ? { ...s, completed: !s.completed } : s);
    const completedCount = updatedSubtasks.filter(s => s.completed).length;
    
    // Auto recalculate estimated remaining hours
    const compHours = Math.round((completedCount / updatedSubtasks.length) * task.estimatedHours * 10) / 10;

    let updatedTask = { 
      ...task, 
      subtasks: updatedSubtasks,
      completedHours: compHours
    };

    // Calculate updated urgency score based on progress
    try {
      const urgency = await calculateTaskUrgency(updatedTask, calendarEvents);
      updatedTask.riskScore = urgency.riskScore;
      updatedTask.riskLevel = urgency.riskLevel;
      updatedTask.urgencyFactors = urgency.urgencyFactors;
    } catch (err) {
      console.warn('Real-time urgency update failed.', err);
    }

    setTasks(prev => prev.map(t => t.id === taskId ? updatedTask : t));

    if (user && !taskId.startsWith('mock-')) {
      const pathForUpdate = `tasks/${taskId}`;
      await updateDoc(doc(db, 'tasks', taskId), {
        subtasks: updatedSubtasks,
        completedHours: compHours,
        riskScore: updatedTask.riskScore,
        riskLevel: updatedTask.riskLevel,
        urgencyFactors: updatedTask.urgencyFactors,
        updatedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, pathForUpdate));
    }
  };

  const handleUpdateTaskUrgency = async (taskId: string, urgencyData: any) => {
    setTasks(prev => prev.map(t => t.id === taskId ? {
      ...t,
      riskScore: urgencyData.riskScore,
      riskLevel: urgencyData.riskLevel,
      urgencyFactors: urgencyData.urgencyFactors
    } : t));

    if (user && !taskId.startsWith('mock-')) {
      const pathForUpdate = `tasks/${taskId}`;
      await updateDoc(doc(db, 'tasks', taskId), {
        riskScore: urgencyData.riskScore,
        riskLevel: urgencyData.riskLevel,
        urgencyFactors: urgencyData.urgencyFactors,
        updatedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, pathForUpdate));
    }
  };

  // Update task subparts array (add/edit/delete subtasks and update estimated hours)
  const handleUpdateTaskSubtasks = async (taskId: string, updatedSubtasks: any[], updatedEstHours: number) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return {
          ...t,
          subtasks: updatedSubtasks,
          estimatedHours: updatedEstHours
        };
      }
      return t;
    }));

    if (user && !taskId.startsWith('mock-')) {
      const pathForUpdate = `tasks/${taskId}`;
      await updateDoc(doc(db, 'tasks', taskId), {
        subtasks: updatedSubtasks,
        estimatedHours: updatedEstHours,
        updatedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, pathForUpdate));
    }
  };

  // Update task custom properties (like lock, overlap, alarms)
  const handleUpdateTaskProperties = async (taskId: string, properties: Partial<Task>) => {
    setTasks(prev => prev.map(t => {
      if (t.id === taskId) {
        return { ...t, ...properties };
      }
      return t;
    }));

    if (user && !taskId.startsWith('mock-')) {
      const pathForUpdate = `tasks/${taskId}`;
      await updateDoc(doc(db, 'tasks', taskId), {
        ...properties,
        updatedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, pathForUpdate));
    }
  };

  // Habit loop completion click
  const handleToggleHabit = async (habitId: string) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const isCompleted = habit.completedDays.includes(todayStr);

    let updatedCompletedDays = [...habit.completedDays];
    let updatedStreak = habit.streak;

    if (isCompleted) {
      updatedCompletedDays = updatedCompletedDays.filter(d => d !== todayStr);
      updatedStreak = Math.max(0, habit.streak - 1);
    } else {
      updatedCompletedDays.push(todayStr);
      updatedStreak += 1;
    }

    setHabits(prev => prev.map(h => h.id === habitId ? {
      ...h,
      completedDays: updatedCompletedDays,
      streak: updatedStreak
    } : h));

    if (user && !habitId.startsWith('mock-')) {
      const pathForUpdate = `habits/${habitId}`;
      await updateDoc(doc(db, 'habits', habitId), {
        completedDays: updatedCompletedDays,
        streak: updatedStreak,
        updatedAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, pathForUpdate));
    }
  };

  // Add detected email opportunity as planned prepare task
  const handleAddOpportunityTask = async (opp: Opportunity) => {
    // Call add task pipeline - triggers autonomous subtasks breakdown
    await handleAddTask({
      title: `Prepare: ${opp.title}`,
      dueDate: opp.dueDate || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      priority: 'high'
    });

    // Automatically book a focus block on the calendar for tomorrow morning
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const startIso = new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString();
    const endIso = new Date(tomorrow.setHours(12, 0, 0, 0)).toISOString();

    const calendarBlock: CalendarEvent = {
      id: `cal-opp-${Date.now()}`,
      summary: `🚀 Focus: Prepare: ${opp.title}`,
      start: startIso,
      end: endIso,
      isOfficial: true, // triggers alarms
      alarmTriggered30: false,
      alarmTriggered15: false
    };

    setCalendarEvents(prev => [calendarBlock, ...prev]);

    // Mark opportunity as added
    setOpportunities(prev => prev.map(o => o.id === opp.id ? { ...o, status: 'added' } : o));

    if (user && !opp.id.startsWith('mock-')) {
      const pathForUpdate = `opportunities/${opp.id}`;
      await updateDoc(doc(db, 'opportunities', opp.id), {
        status: 'added',
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, pathForUpdate));
    }
  };

  const handleDismissOpportunity = async (oppId: string) => {
    setOpportunities(prev => prev.map(o => o.id === oppId ? { ...o, status: 'dismissed' } : o));
    
    if (user && !oppId.startsWith('mock-')) {
      const pathForUpdate = `opportunities/${oppId}`;
      await updateDoc(doc(db, 'opportunities', oppId), {
        status: 'dismissed',
      }).catch(err => handleFirestoreError(err, OperationType.UPDATE, pathForUpdate));
    }
  };

  // Log procrastination event
  const handleLogProcrastination = async (activity: string, duration: number) => {
    const newLog: ProcrastinationEvent = {
      id: `prog-${Date.now()}`,
      timestamp: new Date().toISOString(),
      activity,
      durationMinutes: duration
    };

    setProcrastinationLogs(prev => [newLog, ...prev]);

    if (user) {
      const pathForWrite = 'procrastinationLogs';
      await addDoc(collection(db, pathForWrite), {
        ...newLog,
        userId: user.uid,
        createdAt: serverTimestamp()
      }).catch(err => handleFirestoreError(err, OperationType.CREATE, pathForWrite));
    }
  };

  // Generate shadow Battle Plan routine
  const handleTriggerShadowPlan = async () => {
    setIsGeneratingPlan(true);
    try {
      const plan = await generateShadowPlan(tasks, habits, calendarEvents);
      setShadowPlan(plan);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      {/* Top ambient glow background lines */}
      <div className={`absolute top-0 left-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-1000 ${
        persona === 'student' ? 'bg-emerald-500/10' : persona === 'professional' ? 'bg-indigo-500/10' : 'bg-amber-500/10'
      }`} />
      <div className={`absolute top-10 right-1/4 w-96 h-96 rounded-full blur-3xl pointer-events-none transition-all duration-1000 ${
        persona === 'student' ? 'bg-teal-500/5' : persona === 'professional' ? 'bg-sky-500/5' : 'bg-orange-500/5'
      }`} />

      {/* Global Navigation Header */}
      <header className="border-b border-slate-900/80 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center gap-4">
          
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shadow-lg border transition-all ${
              persona === 'student' 
                ? 'bg-emerald-600 shadow-emerald-950/50 border-emerald-500/30' 
                : persona === 'professional' 
                  ? 'bg-indigo-600 shadow-indigo-950/50 border-indigo-500/30' 
                  : 'bg-amber-600 shadow-amber-950/50 border-amber-500/30'
            }`}>
              <Zap className="h-5 w-5 text-yellow-300 animate-pulse fill-current" />
            </div>
            <div>
              <h1 className="text-sm sm:text-md font-bold tracking-tight text-white font-sans">Deadline Guardian</h1>
              <span className="text-[9px] sm:text-[10px] font-mono font-medium text-slate-500 uppercase tracking-widest block -mt-0.5">Gemini Coach & Planner</span>
            </div>
          </div>

          {/* Persona Switcher Block */}
          <div className="flex items-center gap-2">
            {/* Desktop Selector */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-900/90 border border-slate-800/80 p-1 rounded-xl">
              <button
                onClick={() => {
                  setPersona('student');
                  handleLoadPersonaMockData('student');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  persona === 'student' ? 'bg-emerald-950/40 border border-emerald-500/30 text-emerald-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🎓 Student
              </button>
              <button
                onClick={() => {
                  setPersona('professional');
                  handleLoadPersonaMockData('professional');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  persona === 'professional' ? 'bg-indigo-950/40 border border-indigo-500/30 text-indigo-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                💼 Professional
              </button>
              <button
                onClick={() => {
                  setPersona('entrepreneur');
                  handleLoadPersonaMockData('entrepreneur');
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all ${
                  persona === 'entrepreneur' ? 'bg-amber-950/40 border border-amber-500/30 text-amber-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                🚀 Entrepreneur
              </button>
            </div>

            {/* Mobile Selector */}
            <div className="lg:hidden">
              <select
                value={persona}
                onChange={(e) => {
                  const val = e.target.value as PersonaType;
                  setPersona(val);
                  handleLoadPersonaMockData(val);
                }}
                className={`bg-slate-900 border border-slate-800 text-xs font-mono font-semibold p-2 rounded-xl outline-none focus:border-indigo-500 ${
                  persona === 'student' ? 'text-emerald-400' : persona === 'professional' ? 'text-indigo-400' : 'text-amber-400'
                }`}
              >
                <option value="student">🎓 Student</option>
                <option value="professional">💼 Professional</option>
                <option value="entrepreneur">🚀 Entrepreneur</option>
              </select>
            </div>

            {/* Replay Onboarding Guide */}
            <button
              onClick={() => {
                localStorage.removeItem('has_completed_tour');
                setShowTour(true);
              }}
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all flex items-center gap-1.5 text-xs font-mono font-bold shrink-0"
              title="Restart Tutorial Guide"
            >
              <HelpCircle className="h-4.5 w-4.5 text-indigo-400 animate-pulse" />
              <span className="hidden md:inline">Tour Guide</span>
            </button>
          </div>

          <div className="flex items-center gap-4">
            {/* Real google login panel */}
            {user ? (
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end">
                  <span className="text-xs font-semibold text-slate-200">{user.displayName}</span>
                  <span className="text-[10px] font-mono text-emerald-400">Authenticated</span>
                </div>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-700 referrerPolicy='no-referrer'" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center border border-slate-700">
                    <User className="h-4 w-4 text-slate-400" />
                  </div>
                )}
                
                <button
                  onClick={handleLogoutClick}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white rounded-xl transition-all"
                  title="Sign Out"
                >
                  <LogOut className="h-4.5 w-4.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleLoginClick}
                disabled={isLoggingIn}
                className="gsi-material-button relative"
                style={{
                  background: '#131314',
                  border: '1px solid #747775',
                  borderRadius: '12px',
                  boxSizing: 'border-box',
                  color: '#e3e3e3',
                  cursor: 'pointer',
                  fontFamily: 'Roboto, arial, sans-serif',
                  fontSize: '14px',
                  fontWeight: '500',
                  height: '40px',
                  letterSpacing: '0.25px',
                  padding: '0 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  transition: 'background-color 0.2s ease',
                }}
              >
                <div className="gsi-material-button-icon" style={{ display: 'flex', alignItems: 'center' }}>
                  <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" style={{ display: 'block', width: '20px', height: '20px' }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                </div>
                <span>{isLoggingIn ? 'Connecting...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>

        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 w-full shrink-0">
        <div className="flex border-b border-slate-900 overflow-x-auto gap-4 py-1.5 scrollbar-none">
          <button
            id="nav-dashboard"
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold font-mono rounded-xl transition-all ${
              activeTab === 'dashboard' 
                ? 'bg-slate-900 border border-slate-800 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="h-4 w-4" />
            <span>Dashboard</span>
          </button>

          <button
            id="nav-planner"
            onClick={() => setActiveTab('planner')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold font-mono rounded-xl transition-all ${
              activeTab === 'planner' 
                ? 'bg-slate-900 border border-slate-800 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ClipboardList className="h-4 w-4" />
            <span>Tasks & Breakdown</span>
          </button>

          <button
            id="nav-calendar"
            onClick={() => setActiveTab('calendar')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold font-mono rounded-xl transition-all ${
              activeTab === 'calendar' 
                ? 'bg-slate-900 border border-slate-800 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Calendar Negotiator</span>
          </button>

          <button
            id="nav-focus"
            onClick={() => setActiveTab('focus')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold font-mono rounded-xl transition-all ${
              activeTab === 'focus' 
                ? 'bg-slate-900 border border-slate-800 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Focus Workspace</span>
          </button>

          <button
            id="nav-voice"
            onClick={() => setActiveTab('voice')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold font-mono rounded-xl transition-all ${
              activeTab === 'voice' 
                ? 'bg-slate-900 border border-slate-800 text-white' 
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4" />
            <span>Voice Assistant</span>
          </button>
        </div>
      </nav>

      {/* Main Container Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === 'dashboard' && (
              <Dashboard
                user={user}
                tasks={tasks}
                habits={habits}
                opportunities={opportunities}
                shadowPlan={shadowPlan}
                onAddOpportunityTask={handleAddOpportunityTask}
                onDismissOpportunity={handleDismissOpportunity}
                onToggleHabit={handleToggleHabit}
                onTriggerShadowPlan={handleTriggerShadowPlan}
                isGeneratingPlan={isGeneratingPlan}
                procrastinationLogs={procrastinationLogs}
                persona={persona}
                onToggleTaskComplete={handleToggleTaskComplete}
                onStartTour={() => {
                  localStorage.removeItem('has_completed_tour');
                  setShowTour(true);
                }}
              />
            )}

            {activeTab === 'planner' && (
              <TaskPlanner
                tasks={tasks}
                onAddTask={handleAddTask}
                onToggleTaskComplete={handleToggleTaskComplete}
                onToggleSubtaskComplete={handleToggleSubtaskComplete}
                onUpdateTaskUrgency={handleUpdateTaskUrgency}
                onDeleteTask={handleDeleteTask}
                onUpdateTaskSubtasks={handleUpdateTaskSubtasks}
                isAddingTask={isAddingTask}
                onActivateRescueMode={(taskId, rescuePlan) => {
                  setActiveRescueTaskId(taskId);
                  setActiveRescuePlan(rescuePlan);
                }}
                activeRescueTaskId={activeRescueTaskId}
                activeRescuePlan={activeRescuePlan}
              />
            )}

            {activeTab === 'calendar' && (
              <CalendarManager
                accessToken={token}
                calendarEvents={calendarEvents}
                tasks={tasks}
                onRefreshCalendar={() => token && syncWithGoogleWorkspace(token)}
                isLoadingCalendar={isLoadingCalendar}
                onAddFocusBlock={(block) => {
                  setCalendarEvents(prev => [block, ...prev]);
                }}
                onModifyEvent={(eventId, updatedFields) => {
                  setCalendarEvents(prev => prev.map(e => e.id === eventId ? { ...e, ...updatedFields } : e));
                }}
                onUpdateTaskProperties={handleUpdateTaskProperties}
              />
            )}

            {activeTab === 'focus' && (
              <FocusWorkspace
                tasks={tasks}
                onLogProcrastination={handleLogProcrastination}
                procrastinationLogs={procrastinationLogs}
              />
            )}

            {activeTab === 'voice' && (
              <VoiceAssistant
                onAddTaskFromVoice={handleAddTask}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Onboarding Tour Guide Overlay */}
      <FeatureGuide
        isOpen={showTour}
        onClose={() => {
          setShowTour(false);
          localStorage.setItem('has_completed_tour', 'true');
        }}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        persona={persona}
        setPersona={setPersona}
        onLoadPersonaMockData={handleLoadPersonaMockData}
      />

      {/* Real-time Alarm Alert Modal */}
      <AnimatePresence>
        {activeAlarm && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-rose-500/40 max-w-md w-full rounded-2xl p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-1.5 bg-rose-500 animate-pulse" />
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 rounded-full bg-rose-950/50 border border-rose-500/30 flex items-center justify-center text-rose-500 animate-bounce">
                  <Bell className="h-8 w-8 stroke-[2.5]" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold tracking-widest text-rose-400 uppercase bg-rose-950/40 border border-rose-900/30 px-2.5 py-1 rounded">
                    🚨 OFFICIAL COMMITMENT ALARM
                  </span>
                  <h3 className="text-lg font-bold text-white mt-3 leading-snug">{activeAlarm.summary}</h3>
                  <p className="text-sm text-slate-400 mt-2 font-sans">
                    Starts in <span className="text-rose-400 font-bold font-mono text-base">{activeAlarm.minutesRemaining}</span> minutes! Please accept or snooze this reminder.
                  </p>
                </div>
                
                <div className="flex gap-3 w-full pt-2">
                  <button
                    onClick={() => handleSnoozeAlarm(activeAlarm.eventId)}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 rounded-xl font-mono text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-1.5"
                  >
                    <Clock className="h-4 w-4" />
                    Snooze (5m)
                  </button>
                  <button
                    onClick={() => handleAcceptAlarm(activeAlarm.eventId, activeAlarm.type)}
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <Check className="h-4 w-4 stroke-[3]" />
                    Accept
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Decorative ambient footer */}
      <footer className="border-t border-slate-900/60 py-6 text-center text-xs text-slate-500 font-mono">
        <div>Deadline Guardian &copy; 2026. Powered by Google Gemini-3.5.</div>
      </footer>
    </div>
  );
}
