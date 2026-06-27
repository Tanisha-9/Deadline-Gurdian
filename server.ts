import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-loaded Gemini client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY environment variable is not set. Using mock mode.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "dummy_key",
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// --- Exponential Backoff Retry Helper ---
async function generateContentWithRetry(params: {
  model: string;
  contents: string;
  config?: any;
}, retries = 3, delayMs = 1000): Promise<string> {
  const ai = getGeminiClient();
  let lastError: any = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await ai.models.generateContent(params);
      if (response.text) {
        return response.text;
      }
      throw new Error("Empty text response from Gemini");
    } catch (err: any) {
      lastError = err;
      const status = err.status || (err.error && err.error.code);
      const isTransient = status === 503 || status === 429 || 
        (err.message && (
          err.message.includes("503") || 
          err.message.includes("high demand") || 
          err.message.includes("temporary") || 
          err.message.includes("overloaded") || 
          err.message.includes("UNAVAILABLE")
        ));
      
      if (isTransient && attempt < retries) {
        console.warn(`Gemini API attempt ${attempt} failed with transient error. Retrying in ${delayMs}ms...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5; // exponential backoff
      } else {
        break; // non-transient error or max retries reached
      }
    }
  }
  throw lastError || new Error("Gemini API call failed");
}

// --- Response Schemas ---
const breakdownSchema = {
  type: Type.OBJECT,
  properties: {
    subtasks: {
      type: Type.ARRAY,
      description: "List of subtasks breaking down the high-level task in sequence.",
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Actionable title of the subtask" },
          estimatedMinutes: { type: Type.INTEGER, description: "Estimated completion time in minutes" }
        },
        required: ["title", "estimatedMinutes"]
      }
    },
    estimatedHours: { type: Type.NUMBER, description: "Total estimated hours for the task" },
    difficulty: { type: Type.STRING, description: "Overall difficulty level of the task: easy, medium, hard" },
    category: { type: Type.STRING, description: "Primary category of the task: Academic, Coding, Career, Personal, Finance" }
  },
  required: ["subtasks", "estimatedHours", "difficulty", "category"]
};

const urgencySchema = {
  type: Type.OBJECT,
  properties: {
    riskScore: { type: Type.INTEGER, description: "Calculated Deadline Risk Score from 0 to 100" },
    riskLevel: { type: Type.STRING, description: "Allowed values: Safe, At Risk, Critical" },
    urgencyFactors: {
      type: Type.OBJECT,
      properties: {
        timeLeft: { type: Type.STRING, description: "Description of time remaining until due date" },
        workEstimate: { type: Type.STRING, description: "Description of remaining work estimate hours" },
        freeTime: { type: Type.STRING, description: "Description of estimated available free time based on calendar" },
        calendarLoad: { type: Type.STRING, description: "Description of calendar events density" }
      },
      required: ["timeLeft", "workEstimate", "freeTime", "calendarLoad"]
    },
    explanation: { type: Type.STRING, description: "Brief text explaining the calculated score and risk status" }
  },
  required: ["riskScore", "riskLevel", "urgencyFactors", "explanation"]
};

const negotiatorSchema = {
  type: Type.OBJECT,
  properties: {
    suggestions: {
      type: Type.ARRAY,
      description: "Rearranged slots or new focus blocks suggestions",
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "Allowed values: reschedule, focus_block" },
          title: { type: Type.STRING, description: "Clear summary of action to take" },
          description: { type: Type.STRING, description: "Detailed explanation for user" },
          targetEventId: { type: Type.STRING, description: "Optional calendar event ID to change/reschedule, if applicable" },
          proposedBlock: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING, description: "Proposed title for the focus block" },
              start: { type: Type.STRING, description: "Proposed ISO start datetime string" },
              end: { type: Type.STRING, description: "Proposed ISO end datetime string" }
            },
            required: ["summary", "start", "end"]
          }
        },
        required: ["type", "title", "description"]
      }
    }
  },
  required: ["suggestions"]
};

const rescueSchema = {
  type: Type.OBJECT,
  properties: {
    simplifiedStrategy: { type: Type.STRING, description: "Strategy explanation on MVP and scope cutting" },
    rescueChecklist: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Skeletal micro-goal title" },
          priority: { type: Type.INTEGER, description: "Ascending priority order number" }
        },
        required: ["title", "priority"]
      }
    },
    recommendedResources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name of resource/tool" },
          url: { type: Type.STRING, description: "Search query or relative URL" },
          description: { type: Type.STRING, description: "Benefit explanation" }
        },
        required: ["name", "url", "description"]
      }
    },
    crisisNudge: { type: Type.STRING, description: "Motivator alert warning nudge text" }
  },
  required: ["simplifiedStrategy", "rescueChecklist", "recommendedResources", "crisisNudge"]
};

const focusChatSchema = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING, description: "Helpful assistant response formatted in markdown" },
    codeSnippet: { type: Type.STRING, description: "Relevant snippet of code if applicable, or empty string" },
    language: { type: Type.STRING, description: "Programming language code of snippet if applicable, or empty string" },
    progressNudge: { type: Type.STRING, description: "Actionable micro-nudging encouraging progress" }
  },
  required: ["reply", "codeSnippet", "language", "progressNudge"]
};

const voiceParseSchema = {
  type: Type.OBJECT,
  properties: {
    intent: { type: Type.STRING, description: "Detected user intent. Allowed values: create_task, schedule_prep, start_focus, general_query" },
    spokenFeedback: { type: Type.STRING, description: "Verbal assistant response narration" },
    extractedData: {
      type: Type.OBJECT,
      properties: {
        taskTitle: { type: Type.STRING, description: "Title or focus area extracted, or empty string" },
        dueDate: { type: Type.STRING, description: "Target ISO date YYYY-MM-DD, or empty string" },
        estimatedHours: { type: Type.NUMBER, description: "Estimated completion hours if mentioned, or null" },
        difficulty: { type: Type.STRING, description: "Difficulty tier: easy, medium, hard" }
      },
      required: ["taskTitle", "dueDate", "estimatedHours", "difficulty"]
    }
  },
  required: ["intent", "spokenFeedback", "extractedData"]
};

const shadowPlannerSchema = {
  type: Type.OBJECT,
  properties: {
    predictedSuccessRate: { type: Type.INTEGER, description: "Forecasted success probability percentage (0-100)" },
    timeline: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          time: { type: Type.STRING, description: "Time bracket e.g., 09:00 - 10:30" },
          title: { type: Type.STRING, description: "Slotted agenda block name" },
          duration: { type: Type.STRING, description: "Readable duration string e.g., 1.5 hrs" },
          type: { type: Type.STRING, description: "Allowed types: dsa, assignment, project, prep, leisure" }
        },
        required: ["time", "title", "duration", "type"]
      }
    },
    insights: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2 to 3 bullet points tracking study trends and behavioral coaching points"
    }
  },
  required: ["predictedSuccessRate", "timeline", "insights"]
};

const opportunitySchema = {
  type: Type.OBJECT,
  properties: {
    opportunities: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Extracted event title" },
          description: { type: Type.STRING, description: "Deadline context description and recommended task action" },
          dueDate: { type: Type.STRING, description: "Extracted ISO deadline date string" },
          source: { type: Type.STRING, description: "Constant value: email" }
        },
        required: ["title", "description", "dueDate", "source"]
      }
    }
  },
  required: ["opportunities"]
};

const alertSchema = {
  type: Type.OBJECT,
  properties: {
    subject: { type: Type.STRING, description: "Customized warning alert subject line" },
    recipient: { type: Type.STRING, description: "User email address" },
    dispatchStatus: { type: Type.STRING, description: "Delivery simulation outcome text" },
    frequency: { type: Type.STRING, description: "Assigned alert frequency text depending on active risk levels" },
    htmlBody: { type: Type.STRING, description: "Full valid styled responsive HTML email template string" }
  },
  required: ["subject", "recipient", "dispatchStatus", "frequency", "htmlBody"]
};

// --- Mock Fallback Data Providers ---
function getMockBreakdown(title: string, dueDate: string | null) {
  return {
    subtasks: [
      { title: "Define Requirements & Setup Environment", estimatedMinutes: 45 },
      { title: "Core Architecture & Design Plan", estimatedMinutes: 60 },
      { title: "Development Phase - Feature Implementation", estimatedMinutes: 120 },
      { title: "Local Testing & Bug Fixes", estimatedMinutes: 60 },
      { title: "Documentation & Completion Review", estimatedMinutes: 30 }
    ],
    estimatedHours: 5.25,
    difficulty: "medium",
    category: "Coding"
  };
}

function getMockUrgency(task: any, calendarEvents: any[], historicalCompletionRate = 85) {
  const today = new Date();
  const due = new Date(task.dueDate || today);
  const diffTime = Math.max(0, due.getTime() - today.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let score = 30;
  if (diffDays <= 2) score = 85;
  else if (diffDays <= 5) score = 55;

  const level = score >= 80 ? "Critical" : score >= 40 ? "At Risk" : "Safe";

  return {
    riskScore: score,
    riskLevel: level,
    urgencyFactors: {
      timeLeft: `${diffDays} day(s) remaining`,
      workEstimate: `${task.estimatedHours || 4} hours total`,
      freeTime: "Calculated from calendar",
      calendarLoad: `${calendarEvents?.length || 2} busy events`
    },
    explanation: `Task '${task.title}' is due in ${diffDays} day(s). The estimated workload is ${task.estimatedHours} hrs, which makes it ${level === "Critical" ? "urgent" : "manageable"}.`
  };
}

function getMockNegotiate(task: any) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const startFocus = new Date(tomorrow.setHours(10, 0, 0, 0)).toISOString();
  const endFocus = new Date(tomorrow.setHours(12, 0, 0, 0)).toISOString();

  return {
    suggestions: [
      {
        type: "reschedule",
        title: "Rearrange Leisure Activities",
        description: `We identified recreational blocks during your active hours. Moving these to the weekend unlocks 2.5 hours of focus time for "${task.title}".`,
        targetEventId: "leisure-1"
      },
      {
        type: "focus_block",
        title: `Insert Focus Block: ${task.title}`,
        description: "Block out 10:00 AM - 12:00 PM tomorrow to execute core parts with no distractions.",
        proposedBlock: {
          summary: `🚀 Focus Block: ${task.title}`,
          start: startFocus,
          end: endFocus
        }
      }
    ]
  };
}

function getMockRescue(task: any) {
  return {
    simplifiedStrategy: "Focus only on the Minimum Viable Deliverable (MVD). Cut secondary features, polish the bare bones, and document any missing parts rather than failing the core functionality.",
    rescueChecklist: [
      { title: "Define a 3-step skeletal blueprint (15m)", priority: 1 },
      { title: "Code the absolute barebones working prototype (90m)", priority: 2 },
      { title: "Test the happy-path flow once (30m)", priority: 3 },
      { title: "Write a brief 1-pager summary explaining the design (20m)", priority: 4 }
    ],
    recommendedResources: [
      { name: "Skeletal Templates", url: "https://github.com", description: "Use boilerplate projects to skip configuration." },
      { name: "MDN Quick Docs / StackOverflow", url: "https://stackoverflow.com", description: "Find pre-tested code blocks for quick integration." }
    ],
    crisisNudge: "⏰ Stop searching for perfection. A functional, simplified project submitted on time is 100x better than an incomplete masterpiece that misses the deadline. You have the skills — let's lock in!"
  };
}

function getMockFocusChat(currentTopic: string, message: string) {
  return {
    reply: `Here is a helpful recommendation for **${currentTopic || "your work"}**: Keep your functions pure and write simple modular pieces. Let me know if you need code examples for database setup, route handlers, or React hooks!`,
    codeSnippet: `// Example of a solid focus block handler\nfunction startSession() {\n  console.log("Deep focus locked!");\n}`,
    language: "javascript",
    progressNudge: "You are doing great. Keep typing and take it line-by-line."
  };
}

function getMockVoiceParse(command: string) {
  const lower = command.toLowerCase();
  let intent = "general_query";
  let title = "Voice Task";
  let date = "2026-06-29"; // next Monday
  
  if (lower.includes("interview") || lower.includes("meeting") || lower.includes("exam") || lower.includes("due") || lower.includes("schedule")) {
    intent = "create_task";
    if (lower.includes("interview")) title = "Prepare for Job Interview";
    else title = "Voice-generated Task";
  }

  return {
    intent,
    spokenFeedback: `I've created a plan for '${title}' scheduled around Monday, June 29. I've also set up a roadmap checklist for your preparation.`,
    extractedData: {
      taskTitle: title,
      dueDate: date,
      estimatedHours: 4,
      difficulty: "medium"
    }
  };
}

function getMockShadowPlanner() {
  return {
    predictedSuccessRate: 85,
    timeline: [
      { time: "09:00 - 10:30", title: "DSA Practice (Trees & Graphs)", duration: "1.5 hrs", type: "dsa" },
      { time: "11:00 - 12:30", title: "Review Resume & Update Portfolio", duration: "1.5 hrs", type: "prep" },
      { time: "14:00 - 16:00", title: "Execute Next Milestone (Coding)", duration: "2 hrs", type: "project" },
      { time: "17:00 - 18:00", title: "Gym / Habit Session", duration: "1 hr", type: "leisure" }
    ],
    insights: [
      "Completion probability increases by 83% when you tackle technical DSA tasks before noon.",
      "Allocating structured study buffers directly before deadlines safeguards against calendar overflow."
    ]
  };
}

function getMockOpportunities() {
  return {
    opportunities: [
      {
        title: "Flipkart GRiD Registration Closes",
        description: "Registrations close in 3 days. System detected high relevance based on your 'DSA Coding' habit.",
        dueDate: "2026-06-29",
        source: "email"
      },
      {
        title: "Amazon Interview Prep Session",
        description: "Confirmed upcoming interview round in 12 days. Let's build a prep checklist.",
        dueDate: "2026-07-07",
        source: "email"
      }
    ]
  };
}

function getMockTriggerEmail(tasks: any[], habits: any[], persona: string, recipientEmail: string) {
  const isStudent = persona === "student";
  const subject = isStudent 
    ? "🎓 [Proactive AI Scholar Alert] Your Optimized DSA Study Agenda & Deadline Risk Warning"
    : "💼 [Proactive AI Professional Alert] Your High-Scale Architecture Sprint & Risk Warning";

  const htmlBody = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a; color: #cbd5e1; padding: 40px 20px; border-radius: 16px; max-width: 600px; margin: auto; border: 1px solid #1e293b;">
      <div style="text-align: center; margin-bottom: 30px;">
        <div style="background-color: ${isStudent ? '#10b981' : '#4f46e5'}; color: white; display: inline-block; padding: 10px 20px; border-radius: 9999px; font-weight: bold; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em;">
          ${isStudent ? "STUDENT ROUTINE SPRINT" : "PROFESSIONAL DEEP WORK ENGINE"}
        </div>
        <h2 style="color: white; margin-top: 15px; font-size: 24px; font-weight: 800; letter-spacing: -0.025em;">Your Everyday Schedule & Risk Alert</h2>
        <p style="color: #94a3b8; font-size: 13px; margin-top: 4px;">Configured specifically for <b>${recipientEmail}</b></p>
      </div>

      <div style="background-color: #020617; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 25px;">
        <h3 style="color: white; font-size: 16px; margin-top: 0; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">📊 Risk-Based Dispatch Logs</h3>
        <ul style="list-style-type: none; padding-left: 0; margin: 10px 0 0 0; font-size: 12px; font-family: monospace; line-height: 1.6;">
          <li style="margin-bottom: 6px;"><span style="color: #10b981;">[LOW RISK ALERT]</span> Rendered as client-side push notification in web browser.</li>
          <li style="margin-bottom: 6px;"><span style="color: #f59e0b;">[MEDIUM RISK ALERT]</span> Email Dispatch active (Assigned Frequency: 1 mail every 3 hours).</li>
          <li style="margin-bottom: 6px;"><span style="color: #ef4444;">[CRITICAL RESCUE MODE]</span> Instant emergency email broadcasted with scope-cut plan.</li>
        </ul>
      </div>

      <div style="margin-bottom: 30px;">
        <h4 style="color: white; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 10px;">📋 Today's Priority Action Plan</h4>
        ${tasks.map((t: any) => `
          <div style="padding: 12px; background-color: #1e293b; border-left: 4px solid ${t.riskLevel === 'Critical' ? '#ef4444' : t.riskLevel === 'At Risk' ? '#f59e0b' : '#10b981'}; border-radius: 6px; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-weight: bold; font-size: 13px; color: white;">${t.title}</span>
              <span style="font-size: 11px; font-family: monospace; color: ${t.riskLevel === 'Critical' ? '#ef4444' : t.riskLevel === 'At Risk' ? '#f59e0b' : '#10b981'};">[${t.riskLevel}]</span>
            </div>
            <div style="font-size: 11px; color: #94a3b8; margin-top: 4px;">Est: ${t.estimatedHours} hrs | Due Date: ${t.dueDate}</div>
          </div>
        `).join('') || '<p style="font-size:12px; color:#94a3b8;">No tasks scheduled for today.</p>'}
      </div>

      <div style="background-color: #1e1b4b; border: 1px solid #4338ca; border-radius: 12px; padding: 20px;">
        <h4 style="color: #a5b4fc; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 0; margin-bottom: 8px;">🧠 AI Coach Recommendation</h4>
        <p style="font-size: 13px; line-height: 1.5; margin: 0; color: #c7d2fe;">
          ${isStudent 
            ? "Maintain your DSA study routine practicing daily. Keep registration timelines clear and complete LeetCode milestones before noon." 
            : "Optimize your system design blocks using Kubernetes architecture diagrams. Avoid high-load calendar conflicts by booking your micro-focus slots early."}
        </p>
      </div>

      <div style="text-align: center; margin-top: 30px; font-size: 11px; color: #64748b; font-family: monospace;">
        Proactive AI Alerting System &bull; Active for tanishaghanty@gmail.com
      </div>
    </div>
  `;

  return {
    subject,
    recipient: recipientEmail,
    dispatchStatus: "Success (Delivered via Simulated Mailer)",
    frequency: tasks.some((t: any) => t.riskLevel === 'At Risk') ? "Warning Frequency: 1 mail per 3 hours" : "Standard Daily Digest",
    htmlBody
  };
}

// 1. Autonomous Task Breakdown Agent
app.post("/api/gemini/breakdown", async (req, res) => {
  const { title, dueDate } = req.body;
  if (!title) {
    return res.status(400).json({ error: "Task title is required" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json(getMockBreakdown(title, dueDate));
    }

    const text = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: `You are an Autonomous Productivity Breakdown Agent.
Break down task: "${title}" due ${dueDate || "unspecified"} into detailed subtasks.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: breakdownSchema
      }
    });

    const data = JSON.parse(text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in task breakdown, falling back to mock:", error);
    res.json(getMockBreakdown(title, dueDate));
  }
});

// 2. AI Urgency Engine (Deadline Risk Score)
app.post("/api/gemini/urgency", async (req, res) => {
  const { task, calendarEvents, historicalCompletionRate = 85 } = req.body;
  if (!task) {
    return res.status(400).json({ error: "Task is required" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json(getMockUrgency(task, calendarEvents, historicalCompletionRate));
    }

    const prompt = `You are the AI Urgency Engine. Calculate a Deadline Risk Score (0-100%) for this task.
Inputs:
- Task: ${task.title}
- Due Date: ${task.dueDate}
- Difficulty: ${task.difficulty || "medium"}
- Est. Work Hours: ${task.estimatedHours || 5}
- User Completion Rate: ${historicalCompletionRate}%
- Calendar Load (Number of events currently scheduled around due date): ${calendarEvents?.length || 0}
- Subtasks Completed: ${task.subtasks?.filter((s: any) => s.completed).length || 0} of ${task.subtasks?.length || 0}

Determine if the deadline is at risk. Output a risk level: "Safe" (score < 40), "At Risk" (score 40-79), or "Critical" (score >= 80).
Provide specific text explaining why you calculated this score (risk factors) and what needs attention.`;

    const text = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: urgencySchema
      }
    });

    const data = JSON.parse(text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in urgency engine, falling back to mock:", error);
    res.json(getMockUrgency(task, calendarEvents, historicalCompletionRate));
  }
});

// 3. AI Calendar Negotiator
app.post("/api/gemini/negotiate", async (req, res) => {
  const { calendarEvents, task } = req.body;
  if (!task) {
    return res.status(400).json({ error: "Task is required" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json(getMockNegotiate(task));
    }

    const prompt = `You are the AI Calendar Negotiator. The user has an urgent task: "${task.title}" (Estimated time: ${task.estimatedHours} hours) due by ${task.dueDate}.
They have a busy calendar schedule. Scan their current events:
${JSON.stringify(calendarEvents || [])}

Find empty slots or suggest rescheduling low-priority/leisure events (like football, social gaming, long breaks, watching shows) to create focused focus blocks.
Identify at least 1-2 events to rearrange and suggest 2 dedicated Focus Blocks.`;

    const text = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: negotiatorSchema
      }
    });

    const data = JSON.parse(text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in calendar negotiator, falling back to mock:", error);
    res.json(getMockNegotiate(task));
  }
});

// 4. Last-Minute Rescue Plan Generator
app.post("/api/gemini/rescue", async (req, res) => {
  const { task } = req.body;
  if (!task) {
    return res.status(400).json({ error: "Task is required" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json(getMockRescue(task));
    }

    const prompt = `You are the Last-Minute Rescue Crisis Manager. The user has an extremely critical task: "${task.title}" and is in emergency mode (Deadline risk > 80%).
Generate a high-intensity, simplified completion strategy to salvage this task under tight pressure.
1. Create a rapid action checklist of 4-5 items.
2. Generate 3 useful specific developer/academic resource suggestions (name and estimated link or search query) that can help them directly.
3. Provide a high-energy "crisis coaching" nudge.`;

    const text = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: rescueSchema
      }
    });

    const data = JSON.parse(text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in rescue generator, falling back to mock:", error);
    res.json(getMockRescue(task));
  }
});

// 5. Focus Copilot Chat
app.post("/api/gemini/focus-chat", async (req, res) => {
  const { currentTopic, message, history = [] } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json(getMockFocusChat(currentTopic, message));
    }

    const formattedHistory = history.map((h: any) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n");
    const prompt = `You are the Focus Copilot, a helpful project assistant during a deep work session.
The user is currently focusing on: "${currentTopic || "Productivity Management"}"
They need quick, direct, helpful support.
Provide concise code snippets, explain complex concepts simply, answer questions, or give them motivation to stay on track. Avoid rambling.

Recent Chat History:
${formattedHistory}

New User Message:
"${message}"`;

    const text = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: focusChatSchema
      }
    });

    const data = JSON.parse(text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in Focus Copilot, falling back to mock:", error);
    res.json(getMockFocusChat(currentTopic, message));
  }
});

// 6. Voice Productivity Assistant (Parse voice or manual text input)
app.post("/api/gemini/voice-parse", async (req, res) => {
  const { command } = req.body;
  if (!command) {
    return res.status(400).json({ error: "Command string is required" });
  }

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json(getMockVoiceParse(command));
    }

    const prompt = `You are a Smart Voice Assistant. Parse the following spoken voice/text command into a structured productivity action.
Command: "${command}"

Map it to one of these intents:
1. "create_task": User wants to schedule or create a task (e.g. "I have an interview next Monday" or "Create a project due Thursday").
2. "schedule_prep": User specifically wants preparation, scheduling, or roadmap generation.
3. "start_focus": User wants to start a focus/study timer.
4. "general_query": Conversational query.`;

    const text = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: voiceParseSchema
      }
    });

    const data = JSON.parse(text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in Voice Assistant, falling back to mock:", error);
    res.json(getMockVoiceParse(command));
  }
});

// 7. AI Shadow Planner (Nightly battle plan)
app.post("/api/gemini/shadow-planner", async (req, res) => {
  const { tasks = [], habits = [], calendarEvents = [] } = req.body;

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json(getMockShadowPlanner());
    }

    const prompt = `You are the AI Shadow Planner. Review the user's pending tasks, habits, and Google Calendar commitments to construct "Tomorrow's Battle Plan".
Tasks list:
${JSON.stringify(tasks)}

Habits list:
${JSON.stringify(habits)}

Google Calendar load for tomorrow:
${JSON.stringify(calendarEvents)}

Synthesize tomorrow's absolute best daily routine into hourly slots.
Provide a Predicted Success Rate (0-100%) based on task volumes, historical completion rates, and busy calendar blocks.
Provide 2-3 behavioral insights.`;

    const text = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: shadowPlannerSchema
      }
    });

    const data = JSON.parse(text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in Shadow Planner, falling back to mock:", error);
    res.json(getMockShadowPlanner());
  }
});

// 8. Gmail Email Scanner (Opportunity Detector)
app.post("/api/gemini/detect-opportunities", async (req, res) => {
  const { emails = [] } = req.body;

  try {
    if (!process.env.GEMINI_API_KEY || emails.length === 0) {
      return res.json(getMockOpportunities());
    }

    const prompt = `You are the AI Opportunity Detector. Scan the following user emails (fetched from Gmail) and extract high-value professional or academic opportunities.
Look for:
- Deadline alerts (hackathons, exams, class registrations)
- Job interview confirmations
- Coding contests (e.g. Flipkart GRiD, Google HashCode)
- Course signups or scholarship closing dates

Emails list:
${JSON.stringify(emails)}`;

    const text = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: opportunitySchema
      }
    });

    const data = JSON.parse(text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in Opportunity Detector, falling back to mock:", error);
    res.json(getMockOpportunities());
  }
});

// 9. AI Smart Alert Trigger (Simulate scheduling / sending everyday plan & risk warnings to user email)
app.post("/api/alerts/trigger-email", async (req, res) => {
  const { tasks = [], habits = [], persona = "student", recipientEmail = "tanishaghanty@gmail.com" } = req.body;

  try {
    if (!process.env.GEMINI_API_KEY) {
      return res.json(getMockTriggerEmail(tasks, habits, persona, recipientEmail));
    }

    const activeTasksStr = tasks.map((t: any) => `- [${t.riskLevel} Risk] ${t.title} (Est: ${t.estimatedHours}h, Due: ${t.dueDate})`).join("\n");
    const activeHabitsStr = habits.map((h: any) => `- ${h.name} (Streak: ${h.streak}d, Target: ${h.targetWeekly}w)`).join("\n");

    const prompt = `You are the AI Smart Alert Dispatcher. Draft a highly professional, visually clean, and personalized "Everyday Schedule & Deadline Risk Warning" digest email for a user with the role/persona "${persona}".
The email must include:
1. An encouraging, professional opening personalized to their daily agenda.
2. A list of active commitments & tasks, highlighting any "At Risk" or "Critical" items with risk indicators.
3. A synthesized 3-hour frequency reminder schedule if medium-risk items exist, or an immediate Emergency Rescue plan if critical items are present.
4. Actionable tips tailored specifically to their persona ("student" should get DSA study, competitive registrations like Flipkart GRiD; "professional" should get system design scale, AWS certifications).

Recipient: ${recipientEmail}
Tasks list:
${activeTasksStr || "No active tasks."}

Habits active:
${activeHabitsStr || "No habits registered."}`;

    const text = await generateContentWithRetry({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: alertSchema
      }
    });

    const data = JSON.parse(text || "{}");
    res.json(data);
  } catch (error: any) {
    console.error("Error in Alert Dispatcher, falling back to mock:", error);
    res.json(getMockTriggerEmail(tasks, habits, persona, recipientEmail));
  }
});


// Vite middleware for development / Static assets for production
if (process.env.NODE_ENV !== "production") {
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const distPath = path.join(process.cwd(), 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
