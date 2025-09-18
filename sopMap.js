const difflib = require('difflib');
const normalize = (text) => text.toLowerCase().replace(/[^a-z0-9\s]/g, '');

const sopDefinitions = {
    "Next-Day Schedule SOP": ["next-day", "schedule", "submission", "daily schedule"],
    "Warranty Trigger SOP": ["warranty", "job complete", "completion trigger"],
    "Trade Assignment SOP": ["trade", "assignment", "job phase", "assign trades"],
    "Daily Log Submission SOP": ["daily log", "submission", "progress", "log entry"],
    "Job Completion Workflow SOP": ["job completion", "workflow", "warranty", "status update"],
    "Weekly Job Bulletin SOP": ["weekly bulletin", "job status", "updates", "friday report"],
    "Compliance Tracking SOP": ["compliance", "tracking", "alerts", "non-compliance"],
    "New Job Scheduled": ["job", "schedule", "automation", "new job"],
    "Create New Job in Slack": ["slack", "job creation", "form", "initiate job"],
    "Jobs Past Due Alert": ["jobs", "past due", "alert", "overdue"],
    "Jobs Past Due Completion button": ["completion", "past due", "button", "mark complete"],
    "Log Completed Jobs": ["log", "completed jobs", "tracking", "history"],
    "Purchase Orders Approved": ["purchase orders", "approval", "tracking", "po status"],
    "Financial Command Center": ["financial", "dashboard", "metrics", "budget"],
    "Financial Command Center - Alerts": ["financial", "alerts", "anomalies", "notifications"],
    "Weekly Email Report": ["weekly report", "email", "job status", "summary"],
    "Daily Job Report": ["daily report", "job progress", "updates", "tasks"],
    "Canna Care Order Form": ["canna care", "order form", "submission", "product order"],
    "Canna Care Amazon Order Form": ["amazon", "canna care", "order form", "purchase"],
    "Assign Trades 2 weeks ahead": ["assign trades", "scheduling", "advance", "job phase"],
    "Activate Trades": ["activate trades", "job readiness", "notification"],
    "Open House / Marketing Calendar": ["open house", "marketing", "calendar", "events"],
    "Trigger Follow up Tasks": ["follow-up", "tasks", "automation", "job events"],
    "Compliance Dashboard for SOP": ["compliance", "dashboard", "SOP", "missed submissions"],
    "KayaPush Gap Analysis": ["kayapush", "gap analysis", "data", "missing entries"],
    "Inspection Reminder SOP": ["inspection", "reminder", "permitting", "upcoming inspection"],
    "Material Delivery Tracker SOP": ["material", "delivery", "tracking", "delays"],
    "Job Site Safety Checklist SOP": ["safety", "checklist", "job site", "compliance"],
    "Subcontractor Check-In SOP": ["subcontractor", "check-in", "job site", "arrival"],
    "Weather Delay SOP": ["weather", "delay", "timeline", "adjustment"],
    "Permit Status Tracker SOP": ["permit", "status", "expiration", "approval"],
    "Client Communication Log SOP": ["client", "communication", "log", "calls"],
    "Invoice & Payment Tracker SOP": ["invoice", "payment", "tracking", "balance"],
    "Change Order Approval SOP": ["change order", "approval", "tracking", "modification"],
    "Document Upload SOP": ["document", "upload", "buildertrend", "plans"],
    "Timeline Forecasting SOP": ["timeline", "forecasting", "progress", "completion"],
    "Budget Variance Alert SOP": ["budget", "variance", "alert", "cost"],
    "Phase Completion Tracker SOP": ["phase", "completion", "workflow", "job phase"],
    "Team Performance Dashboard SOP": ["performance", "dashboard", "metrics", "team"],
    "Job Risk Assessment SOP": ["risk", "assessment", "delay", "budget"]
};

function matchSOP(query) {
    const normalizedQuery = normalize(query);
    let bestMatch = null;
    let highestScore = 0;

    for (const [sop, keywords] of Object.entries(sopDefinitions)) {
        for (const keyword of keywords) {
            const score = difflib.SequenceMatcher(null, normalizedQuery, normalize(keyword)).ratio();
            if (score > highestScore) {
                highestScore = score;
                bestMatch = sop;
            }
        }
    }

    return highestScore > 0.5 ? bestMatch : null;
}

module.exports = { matchSOP };
