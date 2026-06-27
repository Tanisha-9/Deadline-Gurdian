import { Task, Habit, CalendarEvent, ShadowPlan, Opportunity } from './types';

// Helper for backend requests
async function postBackend<T>(endpoint: string, body: any): Promise<T> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server returned ${response.status}`);
  }
  return response.json();
}

// 1. Task Breakdown Agent
export async function getTaskBreakdown(title: string, dueDate?: string) {
  return postBackend<{
    subtasks: { title: string; estimatedMinutes: number }[];
    estimatedHours: number;
    difficulty: 'easy' | 'medium' | 'hard';
    category: string;
  }>('/api/gemini/breakdown', { title, dueDate });
}

// 2. AI Urgency Engine (Calculates Risk Score)
export async function calculateTaskUrgency(task: Task, calendarEvents: CalendarEvent[]) {
  return postBackend<{
    riskScore: number;
    riskLevel: 'Safe' | 'At Risk' | 'Critical';
    urgencyFactors: {
      timeLeft: string;
      workEstimate: string;
      freeTime: string;
      calendarLoad: string;
    };
    explanation: string;
  }>('/api/gemini/urgency', { task, calendarEvents });
}

// 3. Calendar Negotiator
export async function getCalendarNegotiations(calendarEvents: CalendarEvent[], task: Task) {
  return postBackend<{
    suggestions: {
      type: 'reschedule' | 'focus_block';
      title: string;
      description: string;
      targetEventId?: string;
      proposedBlock?: {
        summary: string;
        start: string;
        end: string;
      };
    }[];
  }>('/api/gemini/negotiate', { calendarEvents, task });
}

// 4. Last-Minute Rescue Plan
export async function getRescuePlan(task: Task) {
  return postBackend<{
    simplifiedStrategy: string;
    rescueChecklist: { title: string; priority: number }[];
    recommendedResources: { name: string; url: string; description: string }[];
    crisisNudge: string;
  }>('/api/gemini/rescue', { task });
}

// 5. Focus Copilot Chat
export async function sendFocusChatMessage(currentTopic: string, message: string, history: { role: 'user' | 'model'; content: string }[]) {
  return postBackend<{
    reply: string;
    codeSnippet?: string;
    language?: string;
    progressNudge: string;
  }>('/api/gemini/focus-chat', { currentTopic, message, history });
}

// 6. Voice Command Parsing
export async function parseVoiceCommand(command: string) {
  return postBackend<{
    intent: 'create_task' | 'schedule_prep' | 'start_focus' | 'general_query';
    spokenFeedback: string;
    extractedData?: {
      taskTitle?: string;
      dueDate?: string;
      estimatedHours?: number;
      difficulty?: 'easy' | 'medium' | 'hard';
    };
  }>('/api/gemini/voice-parse', { command });
}

// 7. AI Shadow Planner (Battle Plan)
export async function generateShadowPlan(tasks: Task[], habits: Habit[], calendarEvents: CalendarEvent[]) {
  return postBackend<ShadowPlan>('/api/gemini/shadow-planner', { tasks, habits, calendarEvents });
}

// 8. Detect Opportunities from Gmail
export async function detectGmailOpportunities(emails: any[]) {
  return postBackend<{ opportunities: Opportunity[] }>('/api/gemini/detect-opportunities', { emails });
}

// 9. Dispatch Email Alert Simulator
export async function dispatchEmailAlert(tasks: Task[], habits: Habit[], persona: string, recipientEmail: string) {
  return postBackend<{
    subject: string;
    recipient: string;
    dispatchStatus: string;
    frequency: string;
    htmlBody: string;
  }>('/api/alerts/trigger-email', { tasks, habits, persona, recipientEmail });
}


// --- GOOGLE WORKSPACE CLIENT-SIDE API HELPER FUNCTIONS ---

// Google Calendar: List Events for the next 7 days
export async function fetchGoogleCalendarEvents(accessToken: string): Promise<CalendarEvent[]> {
  const now = new Date();
  const timeMin = now.toISOString();
  const oneWeekLater = new Date();
  oneWeekLater.setDate(now.getDate() + 7);
  const timeMax = oneWeekLater.toISOString();

  try {
    const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Google Calendar API returned status ${res.status}`);
    }

    const data = await res.json();
    return (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || 'Busy Block',
      start: item.start.dateTime || item.start.date,
      end: item.end.dateTime || item.end.date,
      googleEventId: item.id
    }));
  } catch (error) {
    console.error('Failed to fetch calendar from Google API:', error);
    throw error;
  }
}

// Google Calendar: Insert Focus Block
export async function createGoogleCalendarEvent(
  accessToken: string,
  event: { summary: string; start: string; end: string }
): Promise<CalendarEvent> {
  try {
    const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: event.summary,
        description: 'Scheduled by your Deadline Guardian Focus Agent',
        start: { dateTime: event.start },
        end: { dateTime: event.end },
        colorId: '5' // Banana yellow or similar striking color
      }),
    });

    if (!res.ok) {
      throw new Error(`Google Calendar API failed to create event: ${res.status}`);
    }

    const item = await res.json();
    return {
      id: item.id,
      summary: item.summary,
      start: item.start.dateTime || item.start.date,
      end: item.end.dateTime || item.end.date,
      isFocusBlock: true,
      googleEventId: item.id
    };
  } catch (error) {
    console.error('Failed to create calendar event:', error);
    throw error;
  }
}

// Gmail API: Scan for recent deadline/alert emails
export async function fetchRecentEmails(accessToken: string): Promise<any[]> {
  try {
    // Search query for important opportunities/deadlines
    const query = 'subject:(interview OR deadline OR registration OR hackathon OR competitive OR exam OR application OR closing)';
    const listUrl = `https://www.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!listRes.ok) {
      throw new Error(`Gmail List API returned status ${listRes.status}`);
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];
    const detailedEmails = [];

    for (const msg of messages) {
      const getUrl = `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
      const getRes = await fetch(getUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (getRes.ok) {
        const detail = await getRes.json();
        const headers = detail.payload?.headers || [];
        const subject = headers.find((h: any) => h.name.toLowerCase() === 'subject')?.value || 'No Subject';
        const snippet = detail.snippet || '';
        detailedEmails.push({ id: msg.id, subject, snippet });
      }
    }

    return detailedEmails;
  } catch (error) {
    console.error('Failed to fetch emails from Gmail API:', error);
    throw error;
  }
}
