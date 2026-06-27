export interface SubTask {
  id: string;
  title: string;
  estimatedMinutes: number;
  completed: boolean;
}

export interface Task {
  id: string;
  title: string;
  dueDate: string;
  estimatedHours: number;
  completedHours: number;
  difficulty: 'easy' | 'medium' | 'hard';
  priority: 'low' | 'medium' | 'high';
  subtasks: SubTask[];
  completed: boolean;
  riskScore: number; // percentage (0 - 100)
  riskLevel: 'Safe' | 'At Risk' | 'Critical';
  category: string;
  resources?: string[];
  isNonShiftable?: boolean;
  allowOverlap?: boolean;
  urgencyFactors?: {
    timeLeft: string;
    workEstimate: string;
    freeTime: string;
    calendarLoad: string;
  };
}

export interface CalendarEvent {
  id: string;
  summary: string;
  start: string; // ISO String
  end: string;   // ISO String
  isFocusBlock?: boolean;
  isLowPriority?: boolean;
  isOfficial?: boolean; // meeting, pitch, exam, official time-slotted task
  googleEventId?: string;
  alarmTriggered30?: boolean;
  alarmTriggered15?: boolean;
}

export interface Habit {
  id: string;
  name: string;
  targetWeekly: number; // e.g. 5 days/week
  completedDays: string[]; // dates formatted as YYYY-MM-DD
  streak: number;
}

export interface Opportunity {
  id: string;
  title: string;
  description: string;
  source: 'email' | 'calendar' | 'notes';
  dueDate?: string;
  status: 'detected' | 'added' | 'dismissed';
}

export interface ShadowPlan {
  date: string;
  predictedSuccessRate: number;
  timeline: {
    time: string;
    title: string;
    duration: string;
    type: 'dsa' | 'assignment' | 'project' | 'prep' | 'leisure';
  }[];
  insights: string[];
}

export interface ProcrastinationEvent {
  id: string;
  timestamp: string;
  activity: string;
  durationMinutes: number;
}

export interface AccountabilityState {
  level: 1 | 2 | 3 | 4;
  title: string;
  description: string;
  remedyAction: string;
}
