import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================
// Realistic feedback data for a fictional B2B
// project management tool called "TaskFlow"
// ============================================

const SOURCES = [
  { name: 'Intercom Export Q4 2024', type: 'csv', filename: 'intercom-q4-2024.csv' },
  { name: 'User Interviews Batch 3', type: 'csv', filename: 'interviews-batch3.csv' },
  { name: 'NPS Survey Dec 2024', type: 'csv', filename: 'nps-dec-2024.csv' },
  { name: 'Slack #product-feedback', type: 'api', filename: null },
  { name: 'App Store Reviews', type: 'csv', filename: 'appstore-reviews.csv' },
];

const NAMES = [
  'Sarah Chen',
  'Marcus Williams',
  'Emily Rodriguez',
  'James Kim',
  'Priya Patel',
  "Michael O'Brien",
  'Lisa Zhang',
  'David Nakamura',
  'Rachel Foster',
  'Alex Thompson',
  'Fatima Al-Rashid',
  'Christopher Lee',
  'Maria Garcia',
  'Daniel Park',
  'Jessica Wright',
  'Kevin Nguyen',
  'Amanda Johnson',
  'Robert Taylor',
  'Nicole Adams',
  'Brian Mitchell',
  'Sophia Hernandez',
  'Andrew Clark',
  'Megan Lewis',
  'Thomas Moore',
  'Laura White',
  'Jason Brown',
  'Hannah Wilson',
  'Ryan Davis',
  'Olivia Martinez',
  'Nathan Scott',
  null,
  null,
  null,
  null,
  null, // Some anonymous feedback
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(): Date {
  const now = new Date();
  const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  return new Date(
    threeMonthsAgo.getTime() + Math.random() * (now.getTime() - threeMonthsAgo.getTime()),
  );
}

function makeEmail(name: string | null): string | null {
  if (!name || Math.random() < 0.3) return null;
  const domain = randomFrom(['gmail.com', 'company.co', 'outlook.com', 'work.io', 'example.com']);
  return `${name
    .toLowerCase()
    .replace(/[^a-z]/g, '')
    .slice(0, 12)}@${domain}`;
}

// ============================================
// THEME 1: Bulk Export Functionality (~30)
// ============================================
const bulkExport = [
  {
    content:
      'We desperately need bulk export. Right now I can only export 100 rows at a time which is completely impractical for our quarterly reports. We have over 5,000 tasks.',
    channel: 'support_ticket',
  },
  {
    content:
      "Is there any way to export all project data to CSV? I've been manually copying data for our board meetings and it's incredibly frustrating.",
    channel: 'support_ticket',
  },
  {
    content:
      'The export limitation is a deal-breaker for us. We need to pull data into our BI tool (Looker) and the 100-row limit makes this impossible.',
    channel: 'support_ticket',
  },
  {
    content:
      "Please add CSV export for the entire project. Not just 100 rows. The current limitation wastes hours of my team's time every week.",
    channel: 'survey',
  },
  {
    content:
      'Need Excel export with all columns. The current export misses custom fields entirely.',
    channel: 'support_ticket',
  },
  {
    content:
      "Can you add a way to export filtered views? I want to export just the overdue tasks but there's no option for that.",
    channel: 'support_ticket',
  },
  {
    content:
      'Export feature is severely limited. Cannot export more than one page of results. This is basic functionality that should have been there from day one.',
    channel: 'app_review',
  },
  {
    content:
      "I just need a simple 'Export All' button. Why is this so hard? Every other PM tool has this.",
    channel: 'slack',
  },
  {
    content:
      'Our compliance team requires monthly data exports. The row limit on exports means we have to do 50+ manual exports each month. Please fix this.',
    channel: 'support_ticket',
  },
  {
    content:
      'Would love PDF export for sharing project summaries with clients who dont have TaskFlow access.',
    channel: 'survey',
  },
  {
    content:
      "The export to Google Sheets integration would be amazing. Right now I'm copying rows by hand like it's 2005.",
    channel: 'slack',
  },
  {
    content:
      'Hi team, any timeline on unlimited exports? This was promised in the Q2 roadmap call but still not delivered. Losing faith here.',
    channel: 'support_ticket',
  },
  {
    content:
      "Tried exporting my sprint data for a retrospective. Got 100 rows out of 347. That's not an export, that's a sample.",
    channel: 'slack',
  },
  {
    content:
      'Bulk export would save me 3-4 hours per week. Not exaggerating. I have to manually compile reports from multiple export batches.',
    channel: 'interview',
  },
  {
    content:
      'The JSON export option crashes when selecting more than 200 tasks. Getting a 504 timeout every single time.',
    channel: 'support_ticket',
  },
  {
    content:
      'We need export scheduling — automatic weekly CSV dumps to our S3 bucket. Manual export is not scalable for a team of 200.',
    channel: 'interview',
  },
  {
    content:
      "Can't believe there's no way to export with attachments. We need the full task data including files for our audit trail.",
    channel: 'support_ticket',
  },
  {
    content:
      "Just wanted to say the new export button looks nice, but it still has the 100-row cap. Cosmetic improvements don't help when the core feature is broken.",
    channel: 'slack',
  },
  {
    content:
      'Export all tasks as CSV including subtasks. Currently only parent tasks appear in exports which defeats the purpose.',
    channel: 'survey',
  },
  {
    content:
      'Would it be possible to get an API endpoint for bulk data export? We want to automate pulling data into our data warehouse nightly.',
    channel: 'support_ticket',
  },
  {
    content:
      'We evaluated three PM tools. TaskFlow was our top choice but the export limitation is the one thing holding us back from committing.',
    channel: 'interview',
  },
  {
    content:
      "Team leads need to export their team's tasks monthly for resource planning. The current limit makes this a multi-hour ordeal.",
    channel: 'support_ticket',
  },
  {
    content:
      'Exporting tasks with comments and history would be incredibly valuable for our audit requirements in healthcare.',
    channel: 'interview',
  },
  {
    content:
      'Suggested improvement: add column selection to the export dialog so users can choose which fields to include in the CSV.',
    channel: 'survey',
  },
  {
    content:
      'Is bulk export on the roadmap? We renewed our annual plan assuming it was coming. Please update.',
    channel: 'support_ticket',
  },
  {
    content:
      'Why can I import thousands of rows but only export 100? This inconsistency makes no sense.',
    channel: 'slack',
  },
  {
    content:
      "Love the product overall but the export cap is genuinely impacting our workflow. We've had to build a hacky workaround with the API.",
    channel: 'survey',
  },
  {
    content:
      'Export should support custom date ranges. I only need Q4 data, not everything since we started using TaskFlow two years ago.',
    channel: 'support_ticket',
  },
  {
    content:
      "From a data ownership perspective, it feels wrong that we can't easily get our own data out. Full export is table stakes.",
    channel: 'interview',
  },
  {
    content:
      'Need to export Gantt chart data to share with contractors. They use MS Project and need the dependencies included.',
    channel: 'support_ticket',
  },
];

// ============================================
// THEME 2: Real-Time Notifications (~25)
// ============================================
const notifications = [
  {
    content:
      "I never know when a task is updated. There's no notification system. I have to constantly refresh the page to see changes.",
    channel: 'support_ticket',
  },
  {
    content:
      'We need push notifications badly. My team misses deadlines because nobody gets alerted when tasks are reassigned.',
    channel: 'support_ticket',
  },
  {
    content:
      'Please add email notifications for task status changes. I find out about blockers days after they happen.',
    channel: 'survey',
  },
  {
    content:
      "Is there a way to get notified when someone comments on my tasks? I'm missing critical context because I don't see replies until it's too late.",
    channel: 'support_ticket',
  },
  {
    content:
      'Slack integration for notifications would be perfect. We live in Slack and having task updates there would save so much context switching.',
    channel: 'slack',
  },
  {
    content:
      'Real-time updates please! When my teammate moves a task to Done, I should see it instantly without refreshing.',
    channel: 'slack',
  },
  {
    content:
      'The notification bell icon exists but it shows nothing. Is this feature actually implemented? Feels like a placeholder.',
    channel: 'support_ticket',
  },
  {
    content:
      'As a project manager, I need to know when tasks go overdue. Right now I manually check every morning. There should be automatic alerts.',
    channel: 'interview',
  },
  {
    content:
      "Can we get @mention notifications? I tag people in comments but they don't get notified, which makes the whole comment system useless.",
    channel: 'support_ticket',
  },
  {
    content:
      'Desktop notifications when tasks are due in the next hour would prevent so many missed deadlines for our team.',
    channel: 'survey',
  },
  {
    content:
      'Webhook support for notifications would let us build custom alerting. We want to pipe task events into our PagerDuty.',
    channel: 'interview',
  },
  {
    content:
      "My team of 15 all say the same thing: we need notifications. It's the #1 feature request in our internal survey about tools.",
    channel: 'interview',
  },
  {
    content:
      'Activity feed is nice but I need to be actively in the app to see it. Push notifications to my phone would be game-changing.',
    channel: 'survey',
  },
  {
    content:
      'We had a critical blocker sit unnoticed for 3 days because nobody was notified. This directly cost us a client deliverable.',
    channel: 'support_ticket',
  },
  {
    content:
      "Notification preferences would be great — let me choose what I get alerted about. I don't need every minor edit, just status changes and mentions.",
    channel: 'support_ticket',
  },
  {
    content:
      'Would love daily digest emails summarizing what changed in my projects. Even a simple email would be better than nothing.',
    channel: 'survey',
  },
  {
    content:
      'The mobile app should vibrate when I get a task assignment. Currently zero notification support on iOS.',
    channel: 'app_review',
  },
  {
    content:
      'Microsoft Teams integration for notifications? Most enterprise customers use Teams, not Slack.',
    channel: 'interview',
  },
  {
    content:
      "When someone changes a due date on a task I'm watching, I should know about it. Silent due date changes have caused three scheduling conflicts this quarter.",
    channel: 'support_ticket',
  },
  {
    content:
      'Browser notifications would be a quick win. Just use the Web Push API — most modern tools have this.',
    channel: 'slack',
  },
  {
    content:
      'We need configurable notification rules. Like: notify me when any task in Project X moves to "In Review".',
    channel: 'interview',
  },
  {
    content:
      'No notifications = no accountability. People can change things and nobody knows. This is a serious product gap.',
    channel: 'survey',
  },
  {
    content:
      "Batch notifications please. I don't want 50 individual emails, but a summary every 2 hours would be perfect.",
    channel: 'support_ticket',
  },
  {
    content:
      'The RSS feed for project activity would be a lightweight alternative to full notifications. Some of us use RSS readers.',
    channel: 'slack',
  },
  {
    content:
      'When a subtask is completed, the parent task owner should be notified. This would close a huge communication gap.',
    channel: 'support_ticket',
  },
];

// ============================================
// THEME 3: Mobile App Performance (~25)
// ============================================
const mobilePerformance = [
  {
    content:
      'The mobile app crashes every time I try to open a project with more than 50 tasks. Android 14, Pixel 8.',
    channel: 'app_review',
  },
  {
    content:
      'App takes 15 seconds to load on my iPhone 13. This is way too slow for a task management app I use throughout the day.',
    channel: 'app_review',
  },
  {
    content:
      'Loading spinner appears and never goes away when switching between boards on mobile. Have to force-close and reopen.',
    channel: 'app_review',
  },
  {
    content:
      "The iOS app drains my battery like crazy. Lost 30% battery in an hour of light use. Something's running in the background.",
    channel: 'support_ticket',
  },
  {
    content:
      "Scrolling through task lists on mobile is incredibly laggy. Every swipe feels like I'm fighting the app.",
    channel: 'app_review',
  },
  {
    content:
      "Can't upload photos from mobile. The attach button does nothing on Android 13. Worked fine two updates ago.",
    channel: 'support_ticket',
  },
  {
    content:
      'The mobile app is basically unusable offline. Even viewing cached tasks fails with a network error. Need proper offline mode.',
    channel: 'app_review',
  },
  {
    content:
      'App size is 180MB?! For a task manager? Please optimize. My phone is running out of storage because of apps like this.',
    channel: 'app_review',
  },
  {
    content:
      'Images in task descriptions render at full resolution on mobile, causing major performance issues. Please add lazy loading or thumbnails.',
    channel: 'support_ticket',
  },
  {
    content:
      'The search feature on mobile is painfully slow. Takes 5-10 seconds to return results for simple queries.',
    channel: 'app_review',
  },
  {
    content:
      'Mobile web version is actually faster than the native app. That tells me something is very wrong with the app.',
    channel: 'slack',
  },
  {
    content:
      "Keyboard randomly covers the task description input on iOS. Can't see what I'm typing half the time.",
    channel: 'app_review',
  },
  {
    content:
      'Memory usage is insane. The app uses 500MB+ RAM on my Android. Gets killed by the OS constantly and I lose draft comments.',
    channel: 'support_ticket',
  },
  {
    content:
      "Push to refresh doesn't work consistently. Sometimes it refreshes, sometimes nothing happens. Very frustrating UX.",
    channel: 'app_review',
  },
  {
    content:
      'Dark mode on mobile has unreadable text in several places. White text on light gray backgrounds.',
    channel: 'support_ticket',
  },
  {
    content:
      'The app crashes when trying to view Gantt charts on mobile. Can we get a simplified mobile view for timelines?',
    channel: 'app_review',
  },
  {
    content:
      "Notifications from the mobile app are delayed by 10-30 minutes. By the time I see them, someone's already pinged me on Slack.",
    channel: 'support_ticket',
  },
  {
    content:
      "Switching between projects takes 8+ seconds on mobile. On desktop it's instant. What's different about the mobile data loading?",
    channel: 'support_ticket',
  },
  {
    content:
      'The tablet layout is just a stretched phone layout. Please make proper use of the screen real estate on iPad.',
    channel: 'app_review',
  },
  {
    content:
      "Video attachments don't play on the mobile app. Just shows a broken thumbnail. Have to open in browser to watch.",
    channel: 'support_ticket',
  },
  {
    content:
      'Would love haptic feedback when completing tasks on mobile. Small touch but it makes checking things off satisfying.',
    channel: 'survey',
  },
  {
    content:
      'App freezes for 2-3 seconds every time I open it. Then works fine. Something heavy is happening on startup.',
    channel: 'app_review',
  },
  {
    content:
      'Calendar view is completely broken on mobile Safari. Events overlap and the date picker is invisible.',
    channel: 'support_ticket',
  },
  {
    content:
      'My team has stopped using the mobile app and just uses the mobile website instead. Native app needs serious work.',
    channel: 'interview',
  },
  {
    content:
      'Please add widgets for iOS home screen. Want to see my due-today tasks without opening the full app.',
    channel: 'survey',
  },
];

// ============================================
// THEME 4: Custom Dashboard Widgets (~25)
// ============================================
const dashboardWidgets = [
  {
    content:
      'The dashboard is too rigid. I want to add my own charts and KPIs. A drag-and-drop widget system would be amazing.',
    channel: 'survey',
  },
  {
    content:
      "Can we customize what appears on the dashboard? The default cards aren't relevant to how our team works.",
    channel: 'support_ticket',
  },
  {
    content:
      "I need a velocity chart on my dashboard but there's no way to add one. Only the default widgets are available.",
    channel: 'support_ticket',
  },
  {
    content:
      'A sprint burndown widget would save me from opening Jira just for that one chart. Please add customizable dashboards.',
    channel: 'interview',
  },
  {
    content:
      'Want to add a widget showing tasks by assignee. The current dashboard only shows totals which is useless for team leads.',
    channel: 'support_ticket',
  },
  {
    content:
      'Dashboard should support different views for different roles. PMs need different widgets than developers.',
    channel: 'interview',
  },
  {
    content:
      "The reporting dashboard hasn't been updated in months. It still shows the same 4 charts. We need flexibility.",
    channel: 'survey',
  },
  {
    content:
      'Can I embed a third-party chart (like from Grafana) on my TaskFlow dashboard? We track some metrics externally.',
    channel: 'support_ticket',
  },
  {
    content:
      'Would love to save multiple dashboard layouts. One for my daily standup view and another for weekly planning.',
    channel: 'survey',
  },
  {
    content:
      "A simple task completion trends widget (last 7/30/90 days) should be built-in. It's the most basic project health metric.",
    channel: 'interview',
  },
  {
    content:
      'The dashboard loads all widgets at once causing a 6-second delay. Lazy loading each widget would help massively.',
    channel: 'support_ticket',
  },
  {
    content:
      'Team utilization widget showing hours logged vs. capacity would help our resource planning enormously.',
    channel: 'interview',
  },
  {
    content:
      'I removed the default widgets hoping to add my own, but now my dashboard is just empty with no way to add anything back.',
    channel: 'support_ticket',
  },
  {
    content:
      'Please add a widget for upcoming deadlines (next 7 days). The current due date display is buried in the task list.',
    channel: 'survey',
  },
  {
    content:
      'Our CEO wants a single-page view of all project statuses. A customizable executive dashboard would win us enterprise deals.',
    channel: 'interview',
  },
  {
    content:
      "Can we get pie/donut charts for task distribution by label? The bar charts currently available don't work well for our data.",
    channel: 'support_ticket',
  },
  {
    content:
      'Dashboard sharing between team members would be great. I set up a nice view and want my team to see the same thing.',
    channel: 'survey',
  },
  {
    content:
      'The dashboard API endpoint is slow. Takes 4 seconds to load the dashboard data. This should be cacheable.',
    channel: 'support_ticket',
  },
  {
    content:
      'We need a heatmap widget for activity patterns. When are tasks being completed? Are there bottleneck days?',
    channel: 'interview',
  },
  {
    content:
      'Adding custom SQL or formula-based widgets would be a power-user feature that distinguishes TaskFlow from simpler tools.',
    channel: 'survey',
  },
  {
    content:
      'Simple number widgets (total tasks, overdue tasks, completed this week) with configurable thresholds for red/yellow/green.',
    channel: 'support_ticket',
  },
  {
    content:
      'The existing dashboard is view-only. Would love interactive widgets where I can click through to the underlying tasks.',
    channel: 'support_ticket',
  },
  {
    content:
      'Please make the dashboard the landing page. Currently it dumps me into my last-viewed project, but I want overview first.',
    channel: 'survey',
  },
  {
    content:
      'A Markdown/notes widget on the dashboard would be handy for pinning team announcements or sprint goals.',
    channel: 'slack',
  },
  {
    content:
      'Dashboard export to PDF for management reports. We screenshot the dashboard every Friday which feels ridiculous.',
    channel: 'interview',
  },
];

// ============================================
// THEME 5: API Rate Limiting Issues (~20)
// ============================================
const rateLimiting = [
  {
    content:
      'Getting 429 errors constantly when syncing with our internal tools. The rate limit of 60 req/min is way too low for any real integration.',
    channel: 'support_ticket',
  },
  {
    content:
      'Our Zapier integration breaks every day because of rate limits. We have 500 tasks updating hourly and the API cant keep up.',
    channel: 'support_ticket',
  },
  {
    content:
      'Rate limit documentation is wrong. Docs say 100 req/min but we get throttled at 60. Please update or increase.',
    channel: 'support_ticket',
  },
  {
    content:
      'Can we get rate limit headers in API responses? I need X-RateLimit-Remaining to build proper backoff logic.',
    channel: 'support_ticket',
  },
  {
    content:
      'The webhook delivery fails silently when we hit rate limits. At least give us a 429 response so we know to retry.',
    channel: 'support_ticket',
  },
  {
    content:
      'Bulk API endpoints would reduce our API call volume by 10x. One call to update 50 tasks instead of 50 individual calls.',
    channel: 'interview',
  },
  {
    content:
      'API rate limits make it impossible to do initial data migration. We have 10,000 tasks to import and it would take 3 hours at current limits.',
    channel: 'support_ticket',
  },
  {
    content:
      'Our automation platform (n8n) keeps hitting rate limits during business hours. Can limits be higher for paid plans?',
    channel: 'support_ticket',
  },
  {
    content:
      "Rate limit resets should be per-endpoint, not global. A bulk read shouldn't count against my write limit.",
    channel: 'interview',
  },
  {
    content:
      'Getting rate-limited on the search API after just 10 requests in a minute. Search should have higher limits.',
    channel: 'support_ticket',
  },
  {
    content:
      "We're building a custom dashboard that polls the API every 30 seconds. With 20 widgets, that's 40 req/min just for one user. Rate limit makes this impossible.",
    channel: 'support_ticket',
  },
  {
    content:
      "Enterprise plan should include higher API limits. We're paying $50k/year and getting the same limits as free tier.",
    channel: 'interview',
  },
  {
    content:
      'GraphQL endpoint would solve our rate limit issues. One query for everything instead of 15 REST calls.',
    channel: 'interview',
  },
  {
    content:
      'Please implement exponential backoff guidance in the API docs. Most developers are doing naive retries which makes things worse.',
    channel: 'support_ticket',
  },
  {
    content:
      'The batch endpoints (/tasks/batch) would solve most rate limit complaints. Is this on the roadmap?',
    channel: 'support_ticket',
  },
  {
    content:
      'API keys should have configurable rate limits. Let us set higher limits for our CI/CD pipeline which runs during off-peak hours.',
    channel: 'interview',
  },
  {
    content:
      'Webhook delivery retries seem to count against our rate limit. This means a single failed webhook cascades into a rate limit for everything.',
    channel: 'support_ticket',
  },
  {
    content:
      'We switched from real-time sync to hourly batch sync because of rate limits. This makes our integration feel stale and unreliable.',
    channel: 'support_ticket',
  },
  {
    content:
      'Can we get a streaming/SSE endpoint for real-time updates instead of polling? Would eliminate 90% of our API calls.',
    channel: 'interview',
  },
  {
    content:
      'The rate limiter seems to count 304 responses. Cached/unchanged responses shouldnt consume rate limit quota.',
    channel: 'support_ticket',
  },
];

// ============================================
// THEME 6: Onboarding Flow Confusion (~25)
// ============================================
const onboarding = [
  {
    content:
      'Just signed up and I have no idea where to start. The empty dashboard with no guidance is intimidating.',
    channel: 'survey',
  },
  {
    content:
      'The setup wizard skips the project creation step entirely. I finished onboarding with no project and no idea what to do next.',
    channel: 'support_ticket',
  },
  {
    content:
      'Can you add a getting started guide or checklist? I spent 20 minutes just figuring out how to create my first task.',
    channel: 'survey',
  },
  {
    content:
      "Invited my team but they don't see any projects. The permissions model during onboarding is confusing — who has access to what?",
    channel: 'support_ticket',
  },
  {
    content:
      "The 'Import from Jira' option in onboarding failed silently. No error message, just returned to the empty dashboard.",
    channel: 'support_ticket',
  },
  {
    content:
      "First-time user experience needs work. I'm an experienced PM and even I was confused by the terminology (Spaces vs Projects vs Boards).",
    channel: 'survey',
  },
  {
    content:
      'Sample project or template would help enormously during onboarding. Let me see what a well-organized project looks like.',
    channel: 'interview',
  },
  {
    content:
      'The video tutorial link in the onboarding email goes to a 404 page. Not a great first impression.',
    channel: 'support_ticket',
  },
  {
    content:
      "It took our team 2 weeks to properly set up TaskFlow because the onboarding didn't explain the workspace hierarchy.",
    channel: 'interview',
  },
  {
    content:
      "Interactive tooltips or guided tours would help new users. The current approach of 'here's the app, figure it out' doesn't work.",
    channel: 'survey',
  },
  {
    content:
      "We lost 3 trial users because they couldn't figure out how to invite teammates. The invite flow is buried under Settings > Team > Members.",
    channel: 'interview',
  },
  {
    content:
      'Onboarding should ask what role I am (PM, developer, designer) and customize the initial view accordingly.',
    channel: 'survey',
  },
  {
    content:
      "I completed the onboarding tour but it didn't actually teach me anything useful. It just showed where buttons are, not workflows.",
    channel: 'support_ticket',
  },
  {
    content:
      'The mobile onboarding is even worse than desktop. Just dumps you into an empty screen with no direction.',
    channel: 'app_review',
  },
  {
    content:
      "Please add a 'Quick Start' template that creates a sample project with realistic tasks so new users can explore.",
    channel: 'survey',
  },
  {
    content:
      'Keyboard shortcuts are never mentioned during onboarding. I discovered Cmd+K search bar by accident after a month.',
    channel: 'slack',
  },
  {
    content:
      "The email drip campaign after signup is helpful but the timing is off. I get the 'advanced features' email before I've even created a task.",
    channel: 'support_ticket',
  },
  {
    content:
      'Our team spent a full day trying to set up workflows. The onboarding should have a workflow builder tutorial.',
    channel: 'interview',
  },
  {
    content:
      'Admin onboarding is completely separate from user onboarding. As the admin, I set everything up but my team members had zero guidance.',
    channel: 'support_ticket',
  },
  {
    content:
      'Would be nice if onboarding adapted based on team size. A solo user needs a different setup than a 50-person team.',
    channel: 'interview',
  },
  {
    content:
      "The progress bar in onboarding says I'm 80% done after just entering my name. Then the remaining 20% takes 30 minutes.",
    channel: 'survey',
  },
  {
    content:
      "Connecting integrations during onboarding would streamline setup. Currently it's: sign up, then go to settings, then integrations. Too many steps.",
    channel: 'support_ticket',
  },
  {
    content:
      'I tried the product tour 3 times and it got stuck on step 4 every time. Chrome 120 on Mac.',
    channel: 'support_ticket',
  },
  {
    content:
      'A short (<2 min) video overview embedded in the app during first login would be way more effective than the current text-based walkthrough.',
    channel: 'survey',
  },
  {
    content:
      "The onboarding checklist disappeared after I closed it. How do I get it back? I wasn't finished with the setup steps.",
    channel: 'support_ticket',
  },
];

// ============================================
// THEME 7: Pricing Tier Complaints (~25)
// ============================================
const pricing = [
  {
    content:
      "The Pro plan at $25/user/month is too expensive for small teams. We're a 5-person startup and can't justify $125/month for a PM tool.",
    channel: 'survey',
  },
  {
    content:
      'Custom fields are locked behind the Enterprise plan? Every competitor includes this in their mid-tier. Feels like price gouging.',
    channel: 'support_ticket',
  },
  {
    content:
      "The free tier is useless — 3 projects max? We can't even properly trial the product with that limitation.",
    channel: 'app_review',
  },
  {
    content:
      'Guest access (for clients) should not require a paid seat. We just need them to view, not edit.',
    channel: 'support_ticket',
  },
  {
    content:
      "Timeline view being a paid feature is bizarre. That's a basic PM feature, not a premium add-on.",
    channel: 'survey',
  },
  {
    content:
      "We're on the Pro plan and still can't access the API. API access requires Business plan at $40/user/month. That's a huge jump.",
    channel: 'support_ticket',
  },
  {
    content:
      'Annual pricing discount is only 10%. Most SaaS tools offer 20-30% for annual commitment. Not compelling enough to lock in.',
    channel: 'survey',
  },
  {
    content:
      'The storage limit on the free plan (100MB) fills up after one week of normal use. Feels like a forced upgrade.',
    channel: 'app_review',
  },
  {
    content:
      'We moved from Asana where we paid $13/user. TaskFlow is almost double for similar features. Need to justify this to my CFO.',
    channel: 'interview',
  },
  {
    content:
      'Hidden costs everywhere. Integrations pack is $5/user extra, advanced reporting is $8/user extra. Just include them in the plan.',
    channel: 'survey',
  },
  {
    content:
      'Non-profit pricing would be appreciated. We do important work and cant afford business-tier pricing for 30 volunteers.',
    channel: 'support_ticket',
  },
  {
    content:
      "Education discount? We're a university research lab using this for project coordination. Academic pricing would help.",
    channel: 'support_ticket',
  },
  {
    content:
      'Pricing page is confusing. Took me 15 minutes to figure out which plan includes time tracking. Use a simple feature comparison table.',
    channel: 'survey',
  },
  {
    content:
      "We don't need all Pro features but the free plan is too limited. A $10/user/month mid-tier would be perfect for us.",
    channel: 'interview',
  },
  {
    content:
      "The per-seat model doesn't work for our use case. We have 100 stakeholders who need view access but only 10 active users.",
    channel: 'interview',
  },
  {
    content:
      "After our trial expired, all our data was locked. Couldn't even export it without upgrading. That felt hostile.",
    channel: 'support_ticket',
  },
  {
    content:
      'Please add a startup program. YC companies get discounts from most dev tools. Would love the same here.',
    channel: 'support_ticket',
  },
  {
    content:
      "SSO/SAML being enterprise-only is a security anti-pattern. Every plan should have SSO. Don't charge extra for security.",
    channel: 'interview',
  },
  {
    content:
      'Our team grew from 5 to 25 in 6 months. The bill went from $125 to $625/month with no volume discount. Need tiered pricing.',
    channel: 'support_ticket',
  },
  {
    content:
      'Competitors offer unlimited projects on free tier. Three project limit drives people away before they can evaluate properly.',
    channel: 'survey',
  },
  {
    content:
      "Audit logs shouldn't be an enterprise feature. Knowing who changed what is basic accountability, not a luxury.",
    channel: 'interview',
  },
  {
    content:
      'The monthly to annual plan switch loses your customizations. Had to reconfigure everything. Nobody mentioned this before switching.',
    channel: 'support_ticket',
  },
  {
    content:
      'Task dependencies are only on Business plan and above? Dependencies are fundamental to project management, not an advanced feature.',
    channel: 'app_review',
  },
  {
    content:
      "I'd pay more for a plan with higher API limits rather than more PM features. Your pricing tiers don't match developer needs.",
    channel: 'interview',
  },
  {
    content:
      'Free plan should at least let you try all features for 30 days. Current trial is 14 days which isnt enough for a team to evaluate properly.',
    channel: 'survey',
  },
];

// ============================================
// THEME 8: Dark Mode Request (~25)
// ============================================
const darkMode = [
  {
    content:
      'Please add dark mode. I work late hours and the bright white interface is painful. This is 2024, dark mode should be standard.',
    channel: 'survey',
  },
  {
    content:
      'My eyes hurt after using TaskFlow for more than 2 hours. Dark mode would make a huge difference for daily use.',
    channel: 'support_ticket',
  },
  {
    content:
      "Every other tool I use (VS Code, Slack, Notion) has dark mode. TaskFlow's bright interface breaks my flow completely.",
    channel: 'slack',
  },
  {
    content:
      'Dark mode PLEASE. I have a medical condition (photophobia) that makes bright screens extremely uncomfortable.',
    channel: 'support_ticket',
  },
  {
    content:
      'Using browser extensions to force dark mode on TaskFlow and it looks terrible — broken layouts, invisible text. Native support needed.',
    channel: 'slack',
  },
  {
    content:
      'Dark mode + OLED black option would be amazing for mobile use. Saves battery and looks great on modern phones.',
    channel: 'app_review',
  },
  {
    content:
      'I set my OS to dark mode but TaskFlow ignores the system preference. At minimum, respect the OS setting.',
    channel: 'support_ticket',
  },
  {
    content:
      'Added dark mode to our internal feature request board and it has 47 votes. More than any other request.',
    channel: 'interview',
  },
  {
    content: "Please, I'm begging. Dark mode. I'll pay extra for it. Seriously.",
    channel: 'slack',
  },
  {
    content:
      "Working on a dual monitor setup — VS Code dark on one screen, blinding white TaskFlow on the other. It's not great.",
    channel: 'survey',
  },
  {
    content:
      "Not just dark mode, but a proper dark theme. Don't just invert colors — design it intentionally with proper contrast ratios.",
    channel: 'support_ticket',
  },
  {
    content:
      'Dark mode would improve accessibility for users with light sensitivity. This is an accessibility issue, not just aesthetics.',
    channel: 'interview',
  },
  {
    content:
      'The competitors all have dark mode. Linear, Notion, Jira, Asana. We look outdated without it.',
    channel: 'interview',
  },
  {
    content:
      'I switch to Notion for notes at night specifically because it has dark mode. TaskFlow loses my screen time after 6pm.',
    channel: 'survey',
  },
  {
    content:
      "Even a simple CSS toggle between light/dark themes would work. Doesn't need to be fancy, just functional.",
    channel: 'slack',
  },
  {
    content:
      'Our design team refuses to use TaskFlow because it clashes with their dark-themed design tools. They use Linear instead.',
    channel: 'interview',
  },
  {
    content:
      'Dark mode support should include syntax highlighting in code blocks too. We paste code snippets in task descriptions.',
    channel: 'support_ticket',
  },
  {
    content:
      "When's dark mode coming? It's been in the 'planned' status on your public roadmap for 8 months now.",
    channel: 'support_ticket',
  },
  {
    content:
      'Automatic dark mode based on time of day would be a nice touch. Light during work hours, dark in the evening.',
    channel: 'survey',
  },
  {
    content:
      'I wrote a Tampermonkey script for dark mode that 200+ users are using. Happy to share our color palette if it helps your team.',
    channel: 'slack',
  },
  {
    content:
      'Dark mode with customizable accent colors would be incredible. Let users personalize beyond just light/dark.',
    channel: 'survey',
  },
  {
    content:
      'Night shift workers are a real user segment. We operate 24/7 and dark mode is essential, not nice-to-have.',
    channel: 'interview',
  },
  {
    content:
      'Projecting TaskFlow on a conference room screen in a dimly lit room is awful. Dark mode would make presentations much better.',
    channel: 'support_ticket',
  },
  {
    content:
      "Can we at least get a 'reduce brightness' option while waiting for full dark mode? Even dimming the whites to light gray would help.",
    channel: 'support_ticket',
  },
  {
    content:
      'Uninstalling the mobile app because the white screen at night is blinding. Will reinstall when dark mode is added.',
    channel: 'app_review',
  },
];

// ============================================
// MAIN SEED FUNCTION
// ============================================

async function main() {
  console.log('Seeding ShipScope development database...');

  // Clean existing data
  await prisma.$transaction([
    prisma.proposalEvidence.deleteMany(),
    prisma.spec.deleteMany(),
    prisma.proposal.deleteMany(),
    prisma.feedbackThemeLink.deleteMany(),
    prisma.theme.deleteMany(),
    prisma.feedbackItem.deleteMany(),
    prisma.feedbackSource.deleteMany(),
  ]);

  // Create sources
  const createdSources = await Promise.all(
    SOURCES.map((s) =>
      prisma.feedbackSource.create({
        data: {
          name: s.name,
          type: s.type,
          filename: s.filename,
          rowCount: 0,
          metadata: {},
        },
      }),
    ),
  );

  // Distribute feedback across sources
  const sourceDistribution = [
    { source: createdSources[0], count: 80 }, // Intercom
    { source: createdSources[1], count: 40 }, // Interviews
    { source: createdSources[2], count: 30 }, // NPS Survey
    { source: createdSources[3], count: 30 }, // Slack
    { source: createdSources[4], count: 20 }, // App Store
  ];

  // Combine all feedback themes
  const allFeedback = [
    ...bulkExport,
    ...notifications,
    ...mobilePerformance,
    ...dashboardWidgets,
    ...rateLimiting,
    ...onboarding,
    ...pricing,
    ...darkMode,
  ];

  // Shuffle feedback
  for (let i = allFeedback.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allFeedback[i], allFeedback[j]] = [allFeedback[j], allFeedback[i]];
  }

  // Assign feedback to sources
  let feedbackIndex = 0;
  for (const { source, count } of sourceDistribution) {
    const feedbackForSource = allFeedback.slice(feedbackIndex, feedbackIndex + count);
    feedbackIndex += count;

    for (const fb of feedbackForSource) {
      const authorName = randomFrom(NAMES);
      await prisma.feedbackItem.create({
        data: {
          content: fb.content,
          channel: fb.channel,
          sourceId: source.id,
          author: authorName,
          email: makeEmail(authorName),
          metadata: {},
          createdAt: randomDate(),
        },
      });
    }

    // Update source row count
    await prisma.feedbackSource.update({
      where: { id: source.id },
      data: { rowCount: feedbackForSource.length },
    });
  }

  const totalItems = await prisma.feedbackItem.count();
  const totalSources = await prisma.feedbackSource.count();

  console.log(`Created ${totalSources} sources with ${totalItems} feedback items`);
  console.log('Seed complete!');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
