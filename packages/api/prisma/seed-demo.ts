import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// DEMO SEED DATA
// Story: Fictional B2B project management tool "TaskFlow"
// with ~1,200 users generating realistic feedback
// ============================================================

async function main() {
  const existingCount = await prisma.feedbackSource.count();
  if (existingCount > 0) {
    console.log('Demo data already exists, skipping seed.');
    return;
  }

  console.log('Seeding demo data...');

  // ── 1. FEEDBACK SOURCES ──────────────────────────────────
  const sources = await Promise.all([
    prisma.feedbackSource.create({
      data: {
        name: 'Intercom Support',
        type: 'intercom',
        rowCount: 80,
        metadata: { integration: 'intercom', workspace: 'taskflow-prod' },
      },
    }),
    prisma.feedbackSource.create({
      data: {
        name: 'User Interviews Q1 2026',
        type: 'interview',
        rowCount: 40,
        metadata: { interviewer: 'Product Team', quarter: 'Q1 2026' },
      },
    }),
    prisma.feedbackSource.create({
      data: {
        name: 'NPS Survey Feb 2026',
        type: 'survey',
        rowCount: 30,
        metadata: { tool: 'Typeform', npsScore: 42 },
      },
    }),
    prisma.feedbackSource.create({
      data: {
        name: '#product-feedback Slack',
        type: 'slack',
        rowCount: 30,
        metadata: { channel: '#product-feedback', workspace: 'taskflow' },
      },
    }),
    prisma.feedbackSource.create({
      data: {
        name: 'G2 Reviews',
        type: 'review',
        rowCount: 20,
        metadata: { platform: 'G2', averageRating: 4.1 },
      },
    }),
  ]);

  const [intercom, interviews, surveys, slack, g2] = sources;

  // ── 2. FEEDBACK ITEMS (200) ──────────────────────────────
  // Theme 1: Slow Page Load Times (45 items)
  const slowLoadFeedback = [
    {
      content:
        'The dashboard takes 8+ seconds to load when I have more than 10K tasks. This is completely unusable for our team.',
      author: 'Marcus Chen',
      email: 'm.chen@acmecorp.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.82,
      urgency: 0.95,
    },
    {
      content:
        "Page loads are getting worse every week. Our PM just goes back to spreadsheets because she can't wait for the app.",
      author: 'Sarah Kim',
      email: 'sarah.k@startupxyz.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.75,
      urgency: 0.88,
    },
    {
      content: 'Loading spinner for 12 seconds on the task list. Timed it. Come on.',
      author: 'Jake Morrison',
      email: 'jake@buildit.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.91,
      urgency: 0.92,
    },
    {
      content:
        "Every time I switch between projects, I have to wait 5-7 seconds. It's killing my flow. I'm context-switching between 4 projects daily.",
      author: 'Priya Patel',
      email: 'priya@designhub.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.68,
      urgency: 0.85,
    },
    {
      content:
        "Our team of 50 people has basically stopped using TaskFlow because of performance. We're considering moving to Asana.",
      author: 'Tom Richards',
      email: 't.richards@bigco.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.88,
      urgency: 0.97,
    },
    {
      content:
        'The board view is the worst. I can barely drag cards because the page freezes while loading.',
      author: 'Lisa Wang',
      email: 'lwang@creativeagency.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.72,
      urgency: 0.79,
    },
    {
      content: 'Timeouts on large queries. Getting 504 errors at least twice a day now.',
      author: 'Dev Sharma',
      email: 'dev.s@techstart.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.85,
      urgency: 0.93,
    },
    {
      content:
        'We have 15,000 tasks and the app is barely functional. Filtering takes forever. Search is unusable.',
      author: 'Rachel Torres',
      email: 'rtorres@enterprise.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.79,
      urgency: 0.91,
    },
    {
      content:
        "My team is losing 20+ minutes per day just waiting for TaskFlow to load. That's real productivity loss we can measure.",
      author: "James O'Brien",
      email: 'jobrien@consultfirm.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.65,
      urgency: 0.82,
    },
    {
      content:
        'The reports page is the slowest. I need to pull weekly reports for standup and it takes so long I just screenshot the board instead.',
      author: 'Nina Kozlova',
      email: 'nina@remoteops.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.58,
      urgency: 0.76,
    },
    {
      content:
        'Honestly the performance has gotten notably worse since the last update. Before December it was fine, now every page takes ages.',
      author: 'Chris Dunlap',
      email: 'cdunlap@midsize.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.61,
      urgency: 0.8,
    },
    {
      content:
        "When I talked to the team about what's most frustrating, the number one answer was load times. Even our least technical people notice it. They'll open TaskFlow, then go make coffee, and it's still loading when they come back.",
      author: 'Amanda Foster',
      email: 'afoster@retailco.com',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.55,
      urgency: 0.87,
    },
    {
      content:
        "We actually did a time study. The average page load in TaskFlow is 6.2 seconds for our team. Our threshold for internal tools is 2 seconds. It's not even close. We've escalated this to our VP who's questioning the renewal.",
      author: 'Michael Zhang',
      email: 'mzhang@datadriven.io',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.71,
      urgency: 0.94,
    },
    {
      content:
        'I love the feature set, I really do. But the speed issue is making it hard for me to champion the tool internally. People complain to me about it every week.',
      author: 'Karen Brooks',
      email: 'kbrooks@growthco.com',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.42,
      urgency: 0.78,
    },
    {
      content:
        "The performance on our 8,000-task workspace makes me dread opening the app each morning. I've started managing smaller projects in Notion just to avoid the wait.",
      author: 'Daniel Lee',
      email: 'dlee@saasplatform.io',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.63,
      urgency: 0.83,
    },
    {
      content:
        'Performance improvements would be the single most impactful thing you could ship. Everything else is secondary when the app feels broken.',
      author: 'Stephanie Martin',
      email: 'smartin@agencygroup.com',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.38,
      urgency: 0.89,
    },
    {
      content: 'Slow. Just slow.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.8,
      urgency: 0.7,
    },
    {
      content: 'NPS: 3. Reason: Performance is unacceptable for a paid tool.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.9,
      urgency: 0.85,
    },
    {
      content: "Would rate higher but the speed issues are a dealbreaker. Fix that and I'd be a 9.",
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.35,
      urgency: 0.8,
    },
    {
      content: 'Love the product, hate the load times. NPS: 5',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.4,
      urgency: 0.75,
    },
    {
      content:
        'The app is practically unusable after you hit a certain number of tasks. Needs serious optimization.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.72,
      urgency: 0.88,
    },
    {
      content:
        'anyone else noticing taskflow getting slower? our board takes like 10sec to load now',
      author: 'alex_pm',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.55,
      urgency: 0.75,
    },
    {
      content:
        "^ yes! thought it was my internet but nope. it's the app. super frustrating during standups",
      author: 'jenny_dev',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.62,
      urgency: 0.78,
    },
    {
      content: 'just timed it: 14 seconds to load our main project board. thats... not great',
      author: 'mike_eng',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.58,
      urgency: 0.82,
    },
    {
      content:
        "we're seriously considering switching tools because of performance. anyone tried linear?",
      author: 'sarah_lead',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.7,
      urgency: 0.9,
    },
    {
      content: 'dashboard froze again during our sprint planning. had to refresh 3 times',
      author: 'ravi_scrum',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.75,
      urgency: 0.85,
    },
    {
      content:
        'Pros: Great feature set, good integrations. Cons: Performance is terrible with large datasets. We have ~12,000 items and the app crawls. Considering downgrading our plan.',
      author: 'Enterprise User',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.45,
      urgency: 0.8,
    },
    {
      content:
        'Would be 5 stars if not for the speed. The app does everything we need but takes forever to do it. 3/5.',
      author: 'Mid-Market PM',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.35,
      urgency: 0.72,
    },
    {
      content:
        'Performance has degraded significantly over the past 3 months. What used to load in 1-2 seconds now takes 8+. Losing confidence in the platform.',
      author: 'IT Director',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.6,
      urgency: 0.86,
    },
    // Additional items to reach 45
    {
      content:
        'The Gantt chart view is completely broken for large projects. It hangs for 20+ seconds and sometimes the browser crashes.',
      author: 'Robert Huang',
      email: 'rhuang@pmgroup.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.88,
      urgency: 0.94,
    },
    {
      content:
        "We upgraded to the Enterprise plan expecting better performance. Disappointed to find it's the same. Where are our dollars going?",
      author: 'Catherine Mills',
      email: 'cmills@finservco.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.72,
      urgency: 0.86,
    },
    {
      content:
        "Can you please tell me if there's a performance fix on the roadmap? My team lead is asking me to evaluate alternatives.",
      author: 'Yuki Tanaka',
      email: 'ytanaka@globaltech.jp',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.48,
      urgency: 0.8,
    },
    {
      content:
        'The search functionality times out every single time I try to find older tasks. I have to scroll manually through hundreds of items.',
      author: 'Brian Cooper',
      email: 'bcooper@logisticsplus.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.66,
      urgency: 0.77,
    },
    {
      content:
        "Switching between views (board/list/calendar) triggers a full reload. Why isn't this cached?",
      author: 'Elena Vasquez',
      email: 'evasquez@designstudio.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.52,
      urgency: 0.73,
    },
    {
      content:
        'Load times make the daily standup awkward. We just stare at a spinner while the PM tries to pull up the sprint board.',
      author: 'David Park',
      email: 'dpark@devshop.io',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.59,
      urgency: 0.81,
    },
    {
      content:
        'I measured it systematically over a week. Average initial load: 7.3 seconds. Average navigation between sections: 3.8 seconds. These numbers are unacceptable for a modern SaaS tool.',
      author: 'Jennifer Walsh',
      email: 'jwalsh@analyticsco.com',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.54,
      urgency: 0.88,
    },
    {
      content:
        'Performance gets worse as the day goes on. Morning is okay-ish, afternoon is terrible. Memory leak maybe?',
      author: 'Omar Hassan',
      email: 'ohassan@webdev.agency',
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.5,
      urgency: 0.74,
    },
    {
      content:
        'Is there a way to archive old tasks to make the app faster? genuinely asking, not being snarky',
      author: 'lisa_ops',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.3,
      urgency: 0.65,
    },
    {
      content: "NPS: 2. The app is unusable. Fix performance or I'm gone.",
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.92,
      urgency: 0.95,
    },
    {
      content:
        "I want to love this tool but opening it feels like a chore because I know I'll be waiting. NPS: 4",
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.48,
      urgency: 0.72,
    },
    {
      content:
        '2/5. Performance issues make it hard to justify the cost. Our team could be using free tools that load instantly.',
      author: 'Startup CTO',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.65,
      urgency: 0.78,
    },
    {
      content:
        'Everything loads slowly. Dashboard, tasks, reports, settings. All of it. No part of the app feels fast.',
      author: 'Sandra Phillips',
      email: 'sphillips@manufact.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.7,
      urgency: 0.83,
    },
    {
      content:
        "We're on a 200-person team and the app basically doesn't function. Multiple people have reported timeouts daily.",
      author: 'Kevin Wright',
      email: 'kwright@largecorp.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.8,
      urgency: 0.96,
    },
    {
      content:
        'just lost 20min of work because the page froze while I was editing a task description and I had to force refresh. please fix this',
      author: 'tina_eng',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.85,
      urgency: 0.9,
    },
    {
      content: 'Pagination would solve so many problems. Why are you loading 10,000 tasks at once?',
      author: 'Alex Rivera',
      email: 'arivera@techops.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.45,
      urgency: 0.8,
    },
  ];

  // Theme 2: Data Export Capabilities (35 items)
  const exportFeedback = [
    {
      content:
        "We need to export our task data to CSV for quarterly board reports. Right now I'm manually copy-pasting from tables.",
      author: 'Patricia Nguyen',
      email: 'pnguyen@corpstrategy.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.15,
      urgency: 0.72,
    },
    {
      content: 'Any plans for a JSON API export? We want to build custom dashboards in Looker.',
      author: 'Ryan Mitchell',
      email: 'rmitchell@dataeng.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.4,
      urgency: 0.65,
    },
    {
      content:
        'Please add CSV export. This is a basic feature that every project management tool has. We need it for compliance reporting.',
      author: 'Alice Foster',
      email: 'afoster@regulatedco.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.05,
      urgency: 0.78,
    },
    {
      content:
        "Exporting data for quarterly reviews shouldn't require me to screenshot tables and paste them into PowerPoint. Can we get a proper export?",
      author: 'George Santos',
      email: 'gsantos@consulting.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.2,
      urgency: 0.7,
    },
    {
      content:
        "We need bulk data export for our annual audit. Currently there's no way to get our data out of TaskFlow in a structured format.",
      author: 'Margaret Wilson',
      email: 'mwilson@auditfirm.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.1,
      urgency: 0.8,
    },
    {
      content:
        "I'd love to export feedback data so I can run my own analysis in Python. The built-in charts are nice but I need more flexibility.",
      author: 'Chris Lee',
      email: 'clee@mlstartup.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.55,
      urgency: 0.55,
    },
    {
      content:
        'Can we export the activity log? Our SOC 2 auditor is asking for proof of user actions and I have no way to provide it.',
      author: 'Diana Cruz',
      email: 'dcruz@securityfirst.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.08,
      urgency: 0.85,
    },
    {
      content:
        "PDF export for specs would be amazing. I need to share PRDs with stakeholders who don't have TaskFlow access.",
      author: 'Sam Taylor',
      email: 'staylor@productco.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.6,
      urgency: 0.5,
    },
    {
      content:
        'The lack of export is actually a deal-breaker for our compliance team. We need to be able to extract all data within 30 days of a request under GDPR.',
      author: 'Hans Mueller',
      email: 'hmueller@eurocorp.de',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.0,
      urgency: 0.9,
    },
    {
      content:
        'When we talked about data portability, it was the second most requested feature after performance. People feel locked in without export capabilities. They want CSV at minimum, but JSON and PDF would also be valuable.',
      author: 'Laura Chen',
      email: 'lchen@productresearch.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.35,
      urgency: 0.75,
    },
    {
      content:
        "I spend about 2 hours every Friday manually compiling reports from TaskFlow because there's no export. That's 100+ hours a year of wasted time.",
      author: 'Mark Robinson',
      email: 'mrobinson@opsmanager.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.25,
      urgency: 0.73,
    },
    {
      content:
        "Our BI team keeps asking me for data from TaskFlow and I have to tell them there's no API export. It's embarrassing.",
      author: 'Jessica Park',
      email: 'jpark@analytics.team',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.3,
      urgency: 0.68,
    },
    {
      content:
        "Data export would make TaskFlow enterprise-ready for us. Right now it's a black hole where data goes in but never comes out.",
      author: 'Robert Okafor',
      email: 'rokafor@enterprise.ng',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.42,
      urgency: 0.77,
    },
    {
      content: 'Export please! Even just tasks to CSV would be huge.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.5,
      urgency: 0.6,
    },
    {
      content: "Need data export for compliance. This is not a nice-to-have, it's a requirement.",
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.1,
      urgency: 0.85,
    },
    {
      content: 'Would love to export reports to PDF for client presentations.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.65,
      urgency: 0.45,
    },
    {
      content: 'I just need to get my data out. CSV, JSON, whatever. Just let me export it.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.2,
      urgency: 0.7,
    },
    {
      content: 'any way to export task data from taskflow? need it for a board presentation',
      author: 'diana_pm',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.35,
      urgency: 0.65,
    },
    {
      content: "nope, no export. I just screenshot everything lol. it's painful",
      author: 'tom_lead',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.15,
      urgency: 0.6,
    },
    {
      content:
        'bumping this again - we really need CSV export. our finance team is on my case about it',
      author: 'rachel_ops',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.25,
      urgency: 0.75,
    },
    {
      content:
        "Great tool for day-to-day PM work. Major gap: no data export at all. Can't create reports outside the app. Needs CSV and API access.",
      author: 'PM Director',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: 0.45,
      urgency: 0.65,
    },
    {
      content:
        "Almost perfect. Add export and it's a 5-star product. Without it, we can't meet our reporting requirements.",
      author: 'Enterprise PM',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: 0.5,
      urgency: 0.7,
    },
    {
      content:
        'No way to get data out of the platform. This is a significant risk for us. What if we want to switch tools?',
      author: 'CTO Review',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: 0.15,
      urgency: 0.8,
    },
    {
      content:
        "We tried the API but there's no bulk export endpoint. Rate limits mean it would take days to export our dataset.",
      author: 'Andrew Kim',
      email: 'akim@devteam.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.3,
      urgency: 0.68,
    },
    {
      content:
        'Feature request: allow exporting the Gantt chart as PDF or image. Need it for project status updates to leadership.',
      author: 'Maria Santos',
      email: 'msantos@projectoffice.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.55,
      urgency: 0.48,
    },
    {
      content: 'Scheduled exports would be ideal. Automatic weekly CSV dump to S3 or email.',
      author: 'Doug Peters',
      email: 'dpeters@automation.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.6,
      urgency: 0.55,
    },
    {
      content:
        "Even a 'Copy as Markdown' button on specs would help. I'm manually reformatting everything for Confluence.",
      author: 'Nadia Petrov',
      email: 'npetrov@docteam.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.45,
      urgency: 0.52,
    },
    {
      content:
        "Our security team requires data export for incident response procedures. Without it, they won't approve the tool for sensitive projects.",
      author: 'Craig Thompson',
      email: 'cthompson@infosec.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.2,
      urgency: 0.82,
    },
    {
      content:
        'can someone build a chrome extension to scrape taskflow data? lol thats how desperate we are for export',
      author: 'kevin_dev',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.1,
      urgency: 0.58,
    },
    {
      content:
        "The API has read endpoints but they're paginated at 50 items and rate limited. Exporting 10K tasks would take forever.",
      author: 'Alex Turner',
      email: 'aturner@integrations.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.22,
      urgency: 0.62,
    },
    {
      content:
        'We need export for CCPA compliance. Users request their data and we literally cannot provide it from TaskFlow.',
      author: 'Legal Dept',
      email: 'legal@westcoastco.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.1,
      urgency: 0.92,
    },
    {
      content:
        'just discovered theres no export... how is this possible for a tool at this price point',
      author: 'new_user_pete',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.0,
      urgency: 0.65,
    },
    {
      content: 'Would pay extra for a proper export module. Seriously.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.55,
      urgency: 0.6,
    },
    {
      content:
        "Can we at least get a database dump? I'd even take a postgres backup at this point.",
      author: 'Steve Nakamura',
      email: 'snakamura@selfhost.dev',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.18,
      urgency: 0.72,
    },
    {
      content:
        'Data portability should be a right, not a feature request. Please prioritize export capabilities.',
      author: 'Open Source Advocate',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: 0.3,
      urgency: 0.75,
    },
  ];

  // Theme 3: Mobile UX Issues (30 items)
  const mobileFeedback = [
    {
      content:
        "The sidebar completely overlaps the main content on iPhone. Can't use the app on mobile at all.",
      author: 'Kelly Park',
      email: 'kpark@mobileteam.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.72,
      urgency: 0.82,
    },
    {
      content:
        'Touch targets on the task cards are way too small. I keep clicking the wrong thing.',
      author: 'Andre Williams',
      email: 'awilliams@fieldops.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.55,
      urgency: 0.7,
    },
    {
      content:
        'The mobile experience is practically unusable. Text is tiny, buttons overlap, and the sidebar takes up the whole screen.',
      author: 'Maya Johnson',
      email: 'mjohnson@remotefirst.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.68,
      urgency: 0.78,
    },
    {
      content:
        'Tried to check tasks on my phone during commute. Had to give up. Nothing is responsive.',
      author: 'Luis Garcia',
      email: 'lgarcia@commuter.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.6,
      urgency: 0.65,
    },
    {
      content:
        "The drag-and-drop on the board view doesn't work on mobile at all. Cards just don't move.",
      author: 'Emily Watson',
      email: 'ewatson@uxdesign.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.5,
      urgency: 0.72,
    },
    {
      content:
        'Can you please make the app work on tablets? We use iPads in our warehouse for task management.',
      author: 'Frank Nelson',
      email: 'fnelson@warehouse.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.35,
      urgency: 0.75,
    },
    {
      content: "Horizontal scrolling on mobile is broken. Can't see the right half of any table.",
      author: 'Rosa Martinez',
      email: 'rmartinez@support.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.62,
      urgency: 0.68,
    },
    {
      content:
        "Our field team needs mobile access badly. They're in the field all day and can't sit at a desktop. The current mobile experience is a non-starter.",
      author: "Tim O'Connor",
      email: 'toconnor@fieldservice.com',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.4,
      urgency: 0.8,
    },
    {
      content:
        'I showed TaskFlow to my team on an iPad during a meeting and it was embarrassing. Everything was broken. The layout was completely wrong.',
      author: 'Sophie Laurent',
      email: 'slaurent@agency.fr',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.55,
      urgency: 0.72,
    },
    {
      content:
        'The mobile web app is the main thing holding us back from full adoption. About 30% of our workforce is mobile-first.',
      author: 'Nathan Brooks',
      email: 'nbrooks@hybridwork.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.38,
      urgency: 0.82,
    },
    {
      content: "Mobile is terrible. Can't even read task descriptions without zooming.",
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.65,
      urgency: 0.7,
    },
    {
      content: 'NPS: 4. Desktop is great, mobile is broken. I need to use this on the go.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.3,
      urgency: 0.68,
    },
    {
      content:
        "Fix mobile please. I'm a PM on the move and I need to check tasks between meetings.",
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.42,
      urgency: 0.75,
    },
    {
      content: 'has anyone gotten taskflow to work properly on android? its a mess on my pixel',
      author: 'carlos_mobile',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.5,
      urgency: 0.65,
    },
    {
      content:
        'mobile web is unusable. just tried to update a task status and accidentally archived the whole project',
      author: 'oops_sarah',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.72,
      urgency: 0.8,
    },
    {
      content:
        'would love a dedicated mobile app but at this point just making the web responsive would be a huge win',
      author: 'hopeful_pm',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.2,
      urgency: 0.6,
    },
    {
      content:
        'Desktop app: 4/5. Mobile: 1/5. The responsive design is nonexistent. Please invest in mobile.',
      author: 'Mobile PM',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.4,
      urgency: 0.72,
    },
    {
      content:
        "Can't recommend to teams with field workers. Mobile experience needs a complete rebuild.",
      author: 'Field Ops Manager',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.45,
      urgency: 0.75,
    },
    {
      content:
        "Dropdown menus on mobile don't close properly. Have to refresh the page to dismiss them.",
      author: 'Jackie Turner',
      email: 'jturner@mobileqa.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.48,
      urgency: 0.62,
    },
    {
      content:
        'The comment box on mobile is so small I can barely type. And the keyboard covers the submit button.',
      author: 'Pete Dawson',
      email: 'pdawson@remotepm.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.52,
      urgency: 0.66,
    },
    {
      content:
        'Please add responsive design. Even basic mobile-friendly layouts would be a massive improvement.',
      author: 'Monica Reeves',
      email: 'mreeves@startuplife.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.28,
      urgency: 0.68,
    },
    {
      content:
        "The settings page on mobile is completely broken. Radio buttons and toggles don't align.",
      author: 'Greg Stevens',
      email: 'gstevens@techfix.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.55,
      urgency: 0.55,
    },
    {
      content:
        'I use TaskFlow on my iPad Pro and the experience is surprisingly bad for a modern web app.',
      author: 'Creative Director',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.42,
      urgency: 0.7,
    },
    {
      content:
        "Calendar view is completely unusable on mobile. Events overlap and you can't scroll to different weeks.",
      author: 'Amy Zhao',
      email: 'azhao@eventops.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.58,
      urgency: 0.72,
    },
    {
      content:
        "Spent 15 minutes trying to create a task on my phone. The form fields are cut off and the category dropdown doesn't scroll.",
      author: 'Raj Malhotra',
      email: 'rmalhotra@onthegopm.com',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.48,
      urgency: 0.7,
    },
    {
      content:
        "PWA would be ideal but even basic CSS media queries would help. The app clearly wasn't designed with mobile in mind.",
      author: 'Frontend Dev User',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.25,
      urgency: 0.62,
    },
    {
      content:
        'modal dialogs on mobile extend below the viewport and theres no way to scroll to the save button',
      author: 'frustrated_dev',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.6,
      urgency: 0.74,
    },
    {
      content: 'Pinch to zoom is the only way to use taskflow on mobile. Not a great sign.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.5,
      urgency: 0.65,
    },
    {
      content:
        "My team works from construction sites. We need a tool that works on phones. TaskFlow doesn't.",
      author: 'Site Manager',
      email: 'site.mgr@construction.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.38,
      urgency: 0.85,
    },
    {
      content:
        'Tried using taskflow on safari ios — the header is fixed but covers half the content. had to give up.',
      author: 'ios_user',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.55,
      urgency: 0.7,
    },
  ];

  // Theme 4: SSO/Enterprise Auth (20 items)
  const ssoFeedback = [
    {
      content:
        "Our security team won't approve TaskFlow without SAML SSO. This is a blocker for our enterprise rollout.",
      author: 'Victoria Adams',
      email: 'vadams@megacorp.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.1,
      urgency: 0.75,
    },
    {
      content:
        'Managing separate credentials for TaskFlow is painful. Can we get Okta integration?',
      author: 'IT Admin',
      email: 'itadmin@techcompany.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.15,
      urgency: 0.6,
    },
    {
      content:
        "We're an Azure AD shop. Without OIDC support, we can't roll this out to our 500-person org.",
      author: 'Derek Kim',
      email: 'dkim@azureshop.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.05,
      urgency: 0.7,
    },
    {
      content:
        'SSO is a hard requirement for any vendor tool at our company. No exceptions. Can you provide a timeline?',
      author: 'Michelle Tang',
      email: 'mtang@fortun500.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.2,
      urgency: 0.65,
    },
    {
      content:
        "We passed on the enterprise plan because there's no SSO. Once you add it, we'll upgrade immediately.",
      author: 'Jack Harrison',
      email: 'jharrison@readytobuy.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.45,
      urgency: 0.5,
    },
    {
      content:
        "Our infosec policy requires SSO for all SaaS tools. We've been using TaskFlow unofficially, but IT will shut it down if we can't get SSO by Q3.",
      author: 'Nancy White',
      email: 'nwhite@regulated.com',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.12,
      urgency: 0.72,
    },
    {
      content:
        "I've been asked by three different enterprise prospects about SSO this month alone. It's becoming the number one sales objection.",
      author: 'Sales Team Lead',
      email: 'sales@taskflow.io',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.3,
      urgency: 0.68,
    },
    {
      content:
        'SAML and SCIM provisioning would let us automate user management. Right now I manually add and remove users, which is a security risk.',
      author: 'Paul Henderson',
      email: 'phenderson@iam.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.18,
      urgency: 0.62,
    },
    {
      content:
        "No SSO is the reason I can't recommend this tool to our enterprise clients. It's a non-starter.",
      author: 'Consultant',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: 0.08,
      urgency: 0.7,
    },
    {
      content: 'Good product, missing enterprise basics like SSO and audit logs.',
      author: 'Enterprise Buyer',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: 0.35,
      urgency: 0.55,
    },
    {
      content: 'Need SSO. Not a want, a need.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.05,
      urgency: 0.72,
    },
    {
      content: 'When will SSO be available? My security review is next month.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.2,
      urgency: 0.68,
    },
    {
      content:
        'is there any way to connect taskflow to our google workspace for login? separate passwords are a pain',
      author: 'admin_jessica',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.25,
      urgency: 0.5,
    },
    {
      content: 'our CISO literally said no SSO = no approval. so... we need SSO',
      author: 'blocked_buyer',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.0,
      urgency: 0.8,
    },
    {
      content:
        "We have 12 SaaS tools. TaskFlow is the only one without SSO. It's the odd one out and it creates security gaps.",
      author: 'Emily Richards',
      email: 'erichards@secops.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.22,
      urgency: 0.58,
    },
    {
      content: 'MFA support at minimum, SSO ideally. We need better auth options.',
      author: 'David Olsen',
      email: 'dolsen@fintech.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.28,
      urgency: 0.55,
    },
    {
      content:
        'SCIM user provisioning would save our IT team hours every month on onboarding/offboarding.',
      author: 'IT Manager',
      email: 'itmgr@scaling.com',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.4,
      urgency: 0.48,
    },
    {
      content:
        "We'd be happy to pay more for an enterprise tier with SSO. Just tell us when it's ready.",
      author: 'Budget Holder',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.55,
      urgency: 0.45,
    },
    {
      content:
        'Compliance requires centralized authentication for all tools. Taskflow is the gap in our coverage.',
      author: 'Compliance Officer',
      email: 'compliance@healthcare.org',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.1,
      urgency: 0.72,
    },
    {
      content:
        "Add Google/Microsoft/Okta SSO and you'll unlock the entire enterprise market. It's the single biggest blocker.",
      author: 'SaaS Advisor',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: 0.38,
      urgency: 0.6,
    },
  ];

  // Theme 5: Real-time Notifications (20 items)
  const notifFeedback = [
    {
      content:
        'I miss critical task updates because I only check TaskFlow twice a day. Need push notifications or Slack alerts.',
      author: 'Jordan Blake',
      email: 'jblake@agileteam.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.2,
      urgency: 0.65,
    },
    {
      content:
        "When someone assigns me a task, I don't find out until I happen to open the app. That's not workable.",
      author: 'Megan Ross',
      email: 'mross@teamlead.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.15,
      urgency: 0.7,
    },
    {
      content:
        'We need Slack notifications for task assignments and status changes. Our team lives in Slack.',
      author: 'Tyler Cook',
      email: 'tcook@slackfirst.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.35,
      urgency: 0.62,
    },
    {
      content: 'Email digests would be great. Just a daily summary of what changed in my projects.',
      author: 'Hannah Lewis',
      email: 'hlewis@overview.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.5,
      urgency: 0.45,
    },
    {
      content:
        'I found out a deadline was moved to today because I randomly checked the calendar. We need alerts!',
      author: 'Ben Carter',
      email: 'bcarter@deadline.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.1,
      urgency: 0.8,
    },
    {
      content:
        "Our distributed team spans 4 timezones. Without notifications, things fall through the cracks constantly. Someone changes a task at 3am my time and I don't see it until noon.",
      author: 'Linda Chen',
      email: 'lchen@distributed.io',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.25,
      urgency: 0.72,
    },
    {
      content:
        "Browser push notifications would be the minimum. Slack and email integrations would be ideal. We've had three missed deadlines this month because people didn't see updates.",
      author: 'Scott Miller',
      email: 'smiller@projectops.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.18,
      urgency: 0.75,
    },
    {
      content:
        "The lack of notifications means we still use a separate Slack channel to announce TaskFlow updates manually. It's redundant.",
      author: 'Kate Zhang',
      email: 'kzhang@processflow.io',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.3,
      urgency: 0.58,
    },
    {
      content: 'Would love in-app notifications at minimum. A bell icon that shows recent changes.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.45,
      urgency: 0.5,
    },
    {
      content: 'No notifications in 2026? Really? Every other tool has this.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.15,
      urgency: 0.68,
    },
    {
      content: 'Slack integration for notifications would make this tool 10x more useful for us.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.55,
      urgency: 0.55,
    },
    {
      content:
        "we set up a zapier workaround for notifications but it's flakey. native support would be way better",
      author: 'workaround_king',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.3,
      urgency: 0.55,
    },
    {
      content:
        'does taskflow have webhooks for notifications? trying to build a custom integration',
      author: 'dev_marcus',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.4,
      urgency: 0.48,
    },
    {
      content:
        'Missed an important deadline because there was no notification when the due date changed. Need alerts ASAP.',
      author: 'Paul Newman',
      email: 'pnewman@deadlines.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.3,
      urgency: 0.82,
    },
    {
      content:
        'At minimum: email when assigned, email when mentioned, email when deadline changes. These are table stakes.',
      author: 'Sandra King',
      email: 'sking@basicsplease.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.22,
      urgency: 0.65,
    },
    {
      content:
        'Microsoft Teams integration for notifications. Most of our company uses Teams, not Slack.',
      author: 'Teams User',
      email: 'teamsfan@bigorg.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.35,
      urgency: 0.52,
    },
    {
      content:
        "Good PM tool, lacks notifications. I check it compulsively because I'm afraid I'll miss something.",
      author: 'Anxious PM',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: 0.25,
      urgency: 0.6,
    },
    {
      content:
        "No notification system means this is a 'pull' tool only. Modern PM tools need to be 'push' as well.",
      author: 'PM Analyst',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: 0.3,
      urgency: 0.58,
    },
    {
      content:
        'a notification bell in the top bar would be a start. right now I have no idea if anything changed since I last looked',
      author: 'refresh_addict',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.2,
      urgency: 0.55,
    },
    {
      content:
        "My team literally has a rotation where someone checks TaskFlow every 2 hours and posts updates in Slack. That's insane.",
      author: 'Olivia Grant',
      email: 'ogrant@scrumteam.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.1,
      urgency: 0.7,
    },
  ];

  // Theme 6: API Rate Limiting (15 items)
  const rateLimitFeedback = [
    {
      content:
        "We're hitting rate limits during our nightly sync. Can you increase the limit or add a batch endpoint?",
      author: 'Jason Tech',
      email: 'jtech@integration.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.35,
      urgency: 0.72,
    },
    {
      content:
        "API returns 429 after only 60 requests per minute. That's way too low for our CI/CD pipeline.",
      author: 'Erik Andersen',
      email: 'eandersen@devops.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.5,
      urgency: 0.7,
    },
    {
      content:
        'We built an integration that creates tasks from our ticketing system. Hits rate limits every day around 9am when tickets flood in.',
      author: 'Nina Pham',
      email: 'npham@automate.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.4,
      urgency: 0.68,
    },
    {
      content:
        'Rate limiting is too aggressive. 60 req/min is fine for casual use but not for real integrations.',
      author: 'Mike Developer',
      email: 'mdev@apiusers.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.45,
      urgency: 0.65,
    },
    {
      content:
        'Batch endpoints would solve the rate limit problem. Instead of 100 individual POST calls, let me send 100 items in one request.',
      author: 'Platform Engineer',
      email: 'platform@techco.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.2,
      urgency: 0.62,
    },
    {
      content:
        'Our Zapier workflows keep failing because of rate limits. We have about 200 tasks created automatically per day.',
      author: 'Sarah Automation',
      email: 'sauto@nocode.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.38,
      urgency: 0.65,
    },
    {
      content:
        'When we discussed API usage, the biggest pain point was rate limiting. Developers want higher limits, better error messages, and batch endpoints.',
      author: 'API Product Manager',
      email: 'apipm@taskflow.io',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.25,
      urgency: 0.6,
    },
    {
      content:
        "The 429 error response doesn't include a Retry-After header. Hard to build proper backoff logic.",
      author: 'Integration Dev',
      email: 'intdev@tools.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.3,
      urgency: 0.55,
    },
    {
      content:
        'Rate limits are blocking our migration script. Trying to import 5,000 tasks and it takes 2 hours because of throttling.',
      author: 'Migration Lead',
      email: 'migrate@switching.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.48,
      urgency: 0.72,
    },
    {
      content: 'api rate limits are killing our automation. 429 errors everywhere',
      author: 'frustrated_dev',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.55,
      urgency: 0.68,
    },
    {
      content:
        'has anyone found a workaround for the rate limits? we need to sync ~500 items daily',
      author: 'sync_issues',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.3,
      urgency: 0.6,
    },
    {
      content: 'API rate limits are too restrictive for serious integration use cases.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.35,
      urgency: 0.62,
    },
    {
      content: "Need higher API limits or batch endpoints. Current limits don't scale.",
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.28,
      urgency: 0.58,
    },
    {
      content:
        'API documentation is solid but the rate limits make it impractical for production integrations.',
      author: 'Developer Review',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.3,
      urgency: 0.6,
    },
    {
      content:
        'Configurable rate limits per API key would be ideal. Our enterprise integration needs more headroom than a personal script.',
      author: 'Leo Chang',
      email: 'lchang@enterprise-int.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.22,
      urgency: 0.58,
    },
  ];

  // Theme 7: Onboarding Confusion (15 items)
  const onboardingFeedback = [
    {
      content:
        "I signed up last week and still don't understand the difference between projects and workspaces. The docs don't help.",
      author: 'New User',
      email: 'newuser@confused.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.42,
      urgency: 0.55,
    },
    {
      content:
        'The initial setup was overwhelming. Too many options, no guidance. I almost gave up.',
      author: 'Trial User',
      email: 'trialuser@almost-quit.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.5,
      urgency: 0.5,
    },
    {
      content:
        "Where's the getting started guide? I landed on the dashboard and had no idea what to do first.",
      author: 'Confused Newbie',
      email: 'cnewbie@helpme.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.38,
      urgency: 0.48,
    },
    {
      content:
        'It took me 30 minutes to figure out how to import my first CSV. The import page needs better instructions.',
      author: 'CSV Importer',
      email: 'csvguy@dataentry.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.32,
      urgency: 0.45,
    },
    {
      content:
        "The empty state on the dashboard is confusing. It says 'No data yet' but doesn't tell me how to add data.",
      author: 'Day One User',
      email: 'dayone@startup.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.25,
      urgency: 0.42,
    },
    {
      content:
        "When new users sign up, about 40% of them don't complete the import step. They get stuck because the UI doesn't guide them through it.",
      author: 'Onboarding PM',
      email: 'onboarding@taskflow.io',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.2,
      urgency: 0.58,
    },
    {
      content:
        'I interviewed five new users and three of them said they almost abandoned the product during setup. The first impression needs work.',
      author: 'UX Researcher',
      email: 'uxr@research.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.28,
      urgency: 0.52,
    },
    {
      content:
        'An interactive walkthrough or tutorial would help. Even just tooltips pointing to key features.',
      author: 'New User',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.15,
      urgency: 0.4,
    },
    {
      content: 'Setup was confusing. Took way too long to figure out.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.4,
      urgency: 0.45,
    },
    {
      content:
        "Need better docs and onboarding. I figured it out eventually but it shouldn't be this hard.",
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.3,
      urgency: 0.38,
    },
    {
      content:
        "just signed up. where do I start? the dashboard is empty and there's no obvious next step",
      author: 'brand_new_here',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.25,
      urgency: 0.42,
    },
    {
      content:
        "lol I spent 20 minutes trying to find the import button. it's hidden under a submenu??",
      author: 'lost_newbie',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.35,
      urgency: 0.45,
    },
    {
      content: 'Learning curve is steep. Product is powerful but initial experience needs polish.',
      author: 'Product Reviewer',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.18,
      urgency: 0.42,
    },
    {
      content: 'Setup took our team a full day. With better onboarding it could take 30 minutes.',
      author: 'Team Lead Reviewer',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.22,
      urgency: 0.48,
    },
    {
      content:
        "The terminology is inconsistent. Sometimes it says 'feedback' sometimes 'items' sometimes 'entries'. Pick one.",
      author: 'Detail-Oriented User',
      email: 'details@precision.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.28,
      urgency: 0.35,
    },
  ];

  // Theme 8: Dark Mode (10 items)
  const darkModeFeedback = [
    {
      content: 'Dark mode please! I use TaskFlow all day and the white background is blinding.',
      author: 'Night Owl',
      email: 'nightowl@latework.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.6,
      urgency: 0.3,
    },
    {
      content:
        'Any chance of getting a dark theme? Working late and the bright white hurts my eyes.',
      author: 'Late Worker',
      email: 'lateworker@overtime.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.65,
      urgency: 0.25,
    },
    {
      content: 'Every tool I use has dark mode except TaskFlow. Please add it!',
      author: 'Dark Mode Fan',
      email: 'darkmode@fan.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.7,
      urgency: 0.2,
    },
    {
      content:
        'I have light sensitivity and the bright interface gives me headaches after extended use. Dark mode would be an accessibility improvement.',
      author: 'Accessibility User',
      email: 'a11y@needs.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: 0.5,
      urgency: 0.4,
    },
    {
      content: 'Dark mode would make me so happy. Simple ask, big impact.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.75,
      urgency: 0.2,
    },
    {
      content: 'Please add dark mode. My eyes are begging.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: 0.68,
      urgency: 0.22,
    },
    {
      content: 'dark mode when?? my retinas need a break',
      author: 'dark_mode_plz',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.62,
      urgency: 0.28,
    },
    {
      content:
        'Using a browser extension to force dark mode on TaskFlow but it breaks half the UI. Native support would be great.',
      author: 'Hacky User',
      email: 'hacky@workarounds.co',
      channel: 'slack',
      sourceId: slack.id,
      sentiment: 0.55,
      urgency: 0.3,
    },
    {
      content:
        'I use TaskFlow in dark rooms during evening standups. The white glare on the projector is intense. Dark mode would help.',
      author: 'Standup Lead',
      email: 'standup@evening.co',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: 0.58,
      urgency: 0.25,
    },
    {
      content: "Minor ask: dark mode. It's 2026, this should be standard.",
      author: 'Standards Guy',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: 0.72,
      urgency: 0.18,
    },
  ];

  // Theme 9: Pricing Complaints (10 items)
  const pricingFeedback = [
    {
      content:
        'We love TaskFlow but $49/seat/month is steep for a 200-person team. Any volume discounts?',
      author: 'Budget Conscious',
      email: 'budget@largeteam.com',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.4,
      urgency: 0.45,
    },
    {
      content:
        '$49/seat is more than Jira and Linear combined. Hard to justify without enterprise features like SSO.',
      author: 'Cost Analyst',
      email: 'costs@compare.co',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.55,
      urgency: 0.48,
    },
    {
      content:
        "The pricing doesn't scale. At 10 users it's fine, at 100 it's astronomical. We need tiered pricing.",
      author: 'Scaling Startup',
      email: 'scale@growing.io',
      channel: 'support_ticket',
      sourceId: intercom.id,
      sentiment: -0.48,
      urgency: 0.42,
    },
    {
      content:
        "When we asked about pricing, the number one complaint was that there's no volume discount. Teams over 50 feel punished.",
      author: 'Customer Success',
      email: 'cs@taskflow.io',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.35,
      urgency: 0.5,
    },
    {
      content:
        'I compared pricing with 5 competitors. TaskFlow is 40% more expensive than the next option. The features are better but the gap is hard to justify.',
      author: 'Procurement Lead',
      email: 'procurement@evalteam.com',
      channel: 'interview',
      sourceId: interviews.id,
      sentiment: -0.42,
      urgency: 0.45,
    },
    {
      content: 'Price is too high for what you get. Especially without SSO, export, or mobile.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.6,
      urgency: 0.4,
    },
    {
      content: 'Would switch from Asana if the pricing was more competitive. Love the AI features.',
      author: 'Anonymous',
      email: null,
      channel: 'survey',
      sourceId: surveys.id,
      sentiment: -0.3,
      urgency: 0.35,
    },
    {
      content: 'is there a startup/nonprofit discount? $49/seat is brutal for a bootstrapped team',
      author: 'bootstrap_founder',
      email: null,
      channel: 'slack',
      sourceId: slack.id,
      sentiment: -0.5,
      urgency: 0.38,
    },
    {
      content: 'Solid product but overpriced for the tier. Linear does 80% of this for $8/seat.',
      author: 'Value Shopper',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.65,
      urgency: 0.42,
    },
    {
      content:
        'Great AI-powered PM tool but the pricing model will limit adoption. Consider a usage-based or freemium approach.',
      author: 'SaaS Analyst',
      email: null,
      channel: 'review',
      sourceId: g2.id,
      sentiment: -0.45,
      urgency: 0.38,
    },
  ];

  // Insert all feedback items
  const allFeedback = [
    ...slowLoadFeedback,
    ...exportFeedback,
    ...mobileFeedback,
    ...ssoFeedback,
    ...notifFeedback,
    ...rateLimitFeedback,
    ...onboardingFeedback,
    ...darkModeFeedback,
    ...pricingFeedback,
  ];

  const now = new Date();
  const feedbackItems = await Promise.all(
    allFeedback.map((item, i) =>
      prisma.feedbackItem.create({
        data: {
          content: item.content,
          author: item.author,
          email: item.email,
          channel: item.channel,
          sourceId: item.sourceId,
          sentiment: item.sentiment,
          urgency: item.urgency,
          processedAt: new Date(now.getTime() - (allFeedback.length - i) * 60000),
          metadata: {},
        },
      }),
    ),
  );

  console.log(`Created ${feedbackItems.length} feedback items`);

  // ── 3. THEMES (9) ───────────────────────────────────────
  const themeDefs = [
    {
      name: 'Slow Page Load Times',
      description:
        'Users report significant performance degradation with large datasets, especially on dashboard and table views. Load times exceed 8 seconds for teams with 10K+ tasks.',
      category: 'performance',
      feedbackCount: 45,
      avgSentiment: -0.61,
      avgUrgency: 0.84,
      opportunityScore: 92,
      painPoints: [
        'Timeouts on large queries',
        'Dashboard freezes',
        'Search unusable',
        'View switching delays',
      ],
    },
    {
      name: 'Data Export Capabilities',
      description:
        'Strong demand for CSV/JSON export across all data views for reporting, compliance, and external analysis.',
      category: 'feature_request',
      feedbackCount: 35,
      avgSentiment: 0.38,
      avgUrgency: 0.67,
      opportunityScore: 84,
      painPoints: ['No bulk export', 'Manual copy-paste workarounds', 'GDPR/CCPA compliance gaps'],
    },
    {
      name: 'Mobile UX Issues',
      description:
        'Layout breaks and overlapping elements reported across iOS Safari and Android Chrome on smaller screens.',
      category: 'ux_issue',
      feedbackCount: 30,
      avgSentiment: -0.44,
      avgUrgency: 0.71,
      opportunityScore: 71,
      painPoints: [
        'Sidebar overlap',
        'Tiny touch targets',
        'Broken drag-and-drop',
        'Viewport overflow',
      ],
    },
    {
      name: 'Real-time Notifications',
      description:
        'Users miss critical updates because the app has no push notification, email digest, or Slack integration for task changes.',
      category: 'feature_request',
      feedbackCount: 20,
      avgSentiment: 0.31,
      avgUrgency: 0.58,
      opportunityScore: 65,
      painPoints: ['No assignment alerts', 'Missed deadline changes', 'Manual Slack announcements'],
    },
    {
      name: 'SSO / Enterprise Auth',
      description:
        'Enterprise customers requesting SAML/OIDC single sign-on to integrate with their identity providers.',
      category: 'feature_request',
      feedbackCount: 20,
      avgSentiment: 0.22,
      avgUrgency: 0.53,
      opportunityScore: 63,
      painPoints: [
        'Security team blockers',
        'Separate credential management',
        'No SCIM provisioning',
      ],
    },
    {
      name: 'API Rate Limiting',
      description:
        'Developers hitting rate limits during integrations and migrations. Current 60 req/min limit too restrictive for production use.',
      category: 'bug',
      feedbackCount: 15,
      avgSentiment: -0.38,
      avgUrgency: 0.62,
      opportunityScore: 58,
      painPoints: ['429 errors during sync', 'No batch endpoints', 'Missing Retry-After headers'],
    },
    {
      name: 'Onboarding Flow Confusion',
      description:
        'New users struggle with initial setup, unclear terminology, and lack of guided walkthrough.',
      category: 'ux_issue',
      feedbackCount: 15,
      avgSentiment: -0.29,
      avgUrgency: 0.45,
      opportunityScore: 47,
      painPoints: ['No getting started guide', 'Hidden import button', 'Inconsistent terminology'],
    },
    {
      name: 'Pricing Tier Flexibility',
      description:
        'Per-seat pricing at $49/month lacks volume discounts, making it prohibitive for larger teams.',
      category: 'pricing',
      feedbackCount: 10,
      avgSentiment: -0.52,
      avgUrgency: 0.41,
      opportunityScore: 39,
      painPoints: [
        'No volume discounts',
        'Higher than competitors',
        'No startup/nonprofit pricing',
      ],
    },
    {
      name: 'Dark Mode Support',
      description:
        'Users requesting dark theme for reduced eye strain during extended use and low-light environments.',
      category: 'feature_request',
      feedbackCount: 10,
      avgSentiment: 0.65,
      avgUrgency: 0.25,
      opportunityScore: 24,
      painPoints: ['Eye strain', 'Browser extension workarounds', 'Projector glare'],
    },
  ];

  // Map feedback arrays to themes for linking
  const feedbackArrays = [
    slowLoadFeedback,
    exportFeedback,
    mobileFeedback,
    notifFeedback,
    ssoFeedback,
    rateLimitFeedback,
    onboardingFeedback,
    pricingFeedback,
    darkModeFeedback,
  ];

  const themes = await Promise.all(
    themeDefs.map((t) =>
      prisma.theme.create({
        data: {
          name: t.name,
          description: t.description,
          category: t.category,
          feedbackCount: t.feedbackCount,
          avgSentiment: t.avgSentiment,
          avgUrgency: t.avgUrgency,
          opportunityScore: t.opportunityScore,
          painPoints: t.painPoints,
        },
      }),
    ),
  );

  console.log(`Created ${themes.length} themes`);

  // ── 4. FEEDBACK-THEME LINKS ──────────────────────────────
  let linkOffset = 0;
  for (let t = 0; t < themes.length; t++) {
    const arr = feedbackArrays[t];
    for (let j = 0; j < arr.length; j++) {
      const fi = feedbackItems[linkOffset + j];
      const confidence = 0.7 + Math.random() * 0.3; // 0.7 - 1.0
      await prisma.feedbackThemeLink.create({
        data: {
          feedbackItemId: fi.id,
          themeId: themes[t].id,
          similarityScore: parseFloat(confidence.toFixed(3)),
        },
      });
    }
    linkOffset += arr.length;
  }

  console.log('Linked feedback to themes');

  // ── 5. PROPOSALS (9) ────────────────────────────────────
  const proposalDefs = [
    {
      title: 'Implement query pagination and virtual scrolling',
      problem:
        'Users with large datasets (10K+ tasks) experience page load times of 8-14 seconds. The application loads all items at once without pagination, causing browser freezes and 504 timeouts. Multiple enterprise customers are evaluating alternatives due to performance.',
      solution:
        'Implement server-side cursor-based pagination for all list endpoints, add virtual scrolling to the frontend for smooth rendering of large lists, and introduce database query optimization with proper indexing. Target: all pages load in under 2 seconds regardless of dataset size.',
      reachScore: 9,
      impactScore: 10,
      confidenceScore: 9,
      effortScore: 8,
      riceScore: 94.2,
      status: 'approved',
      themeIdx: 0,
    },
    {
      title: 'Add bulk CSV/JSON export across all views',
      problem:
        'Users cannot export data from TaskFlow in any structured format. This blocks quarterly reporting, compliance audits (GDPR/CCPA), and custom analytics workflows. Teams spend hours manually copy-pasting data for board reports.',
      solution:
        'Add CSV and JSON export buttons to all data views (feedback, themes, proposals, specs). Include a bulk export API endpoint with no rate limiting for authenticated users. Support filtered exports matching current view filters. Add PDF export for specs/PRDs.',
      reachScore: 8,
      impactScore: 9,
      confidenceScore: 9,
      effortScore: 7,
      riceScore: 87.6,
      status: 'approved',
      themeIdx: 1,
    },
    {
      title: 'Rebuild responsive mobile layout',
      problem:
        "The application is unusable on mobile devices. The sidebar overlaps content, touch targets are too small, drag-and-drop doesn't work, and tables overflow the viewport. About 30% of users need mobile access.",
      solution:
        'Redesign the layout with a mobile-first approach: collapsible sidebar as a drawer, increased touch targets (44px minimum), responsive tables with horizontal scroll, and disable drag-and-drop in favor of action menus on mobile.',
      reachScore: 7,
      impactScore: 8,
      confidenceScore: 8,
      effortScore: 6,
      riceScore: 71.3,
      status: 'proposed',
      themeIdx: 2,
    },
    {
      title: 'Add Slack/email notification system',
      problem:
        'Users miss critical task updates because the app has no notification system. Teams resort to manual Slack announcements or compulsive app checking. Missed deadlines are increasing due to unseen changes.',
      solution:
        'Build a notification engine with configurable preferences: in-app notification center (bell icon), Slack webhook integration for channels, email digests (daily/weekly), and browser push notifications. Users can configure which events trigger each channel.',
      reachScore: 8,
      impactScore: 7,
      confidenceScore: 8,
      effortScore: 6,
      riceScore: 68.4,
      status: 'proposed',
      themeIdx: 3,
    },
    {
      title: 'Integrate SAML/OIDC single sign-on',
      problem:
        'Enterprise security teams block TaskFlow adoption without SSO. Separate credentials create security gaps and user management overhead. Multiple large deals are stalled pending SSO support.',
      solution:
        'Implement SAML 2.0 and OIDC authentication flows supporting Okta, Azure AD, Google Workspace, and OneLogin. Add SCIM provisioning for automated user lifecycle management. Include just-in-time user provisioning.',
      reachScore: 6,
      impactScore: 8,
      confidenceScore: 9,
      effortScore: 7,
      riceScore: 63.1,
      status: 'approved',
      themeIdx: 4,
    },
    {
      title: 'Add configurable API rate limits and batch endpoints',
      problem:
        'Developers hit the 60 req/min rate limit during integrations and data migrations. No batch endpoints exist, forcing individual requests. Missing Retry-After headers make backoff logic difficult.',
      solution:
        'Increase default rate limits to 300 req/min, add per-API-key configurable limits for enterprise customers, create batch POST/PUT/DELETE endpoints accepting up to 100 items per request, and add Retry-After headers to 429 responses.',
      reachScore: 5,
      impactScore: 7,
      confidenceScore: 9,
      effortScore: 5,
      riceScore: 58.7,
      status: 'proposed',
      themeIdx: 5,
    },
    {
      title: 'Redesign onboarding wizard with interactive walkthrough',
      problem:
        "New users struggle with initial setup. 40% don't complete the import step. Unclear terminology and lack of guidance cause early abandonment.",
      solution:
        'Build a step-by-step onboarding wizard: welcome screen, data import helper with drag-and-drop, interactive tooltip tour of key features, and sample data option for exploration. Add contextual help buttons throughout.',
      reachScore: 6,
      impactScore: 6,
      confidenceScore: 7,
      effortScore: 5,
      riceScore: 47.2,
      status: 'proposed',
      themeIdx: 6,
    },
    {
      title: 'Introduce volume-based pricing tiers',
      problem:
        "The flat $49/seat/month pricing doesn't scale for larger teams. Competitors offer 40% lower pricing with volume discounts. Bootstrapped startups and nonprofits are priced out.",
      solution:
        'Introduce tiered pricing: Starter (free, 5 users), Team ($29/seat, 6-50 users), Business ($19/seat, 51-200 users), Enterprise (custom pricing). Add startup and nonprofit discount programs (50% off for 2 years).',
      reachScore: 7,
      impactScore: 5,
      confidenceScore: 6,
      effortScore: 4,
      riceScore: 39.5,
      status: 'proposed',
      themeIdx: 7,
    },
    {
      title: 'Add system-wide dark mode',
      problem:
        'Users experience eye strain during extended use. Multiple users report using browser extensions to force dark mode, which breaks the UI. Accessibility concern for users with light sensitivity.',
      solution:
        'Implement a system-wide dark color scheme using CSS custom properties. Add a theme toggle in settings with options: Light, Dark, System (follow OS preference). Ensure all components, charts, and code blocks render correctly in both modes.',
      reachScore: 8,
      impactScore: 4,
      confidenceScore: 9,
      effortScore: 3,
      riceScore: 24.8,
      status: 'shipped',
      themeIdx: 8,
    },
  ];

  const proposals = await Promise.all(
    proposalDefs.map((p) =>
      prisma.proposal.create({
        data: {
          title: p.title,
          problem: p.problem,
          solution: p.solution,
          reachScore: p.reachScore,
          impactScore: p.impactScore,
          confidenceScore: p.confidenceScore,
          effortScore: p.effortScore,
          riceScore: p.riceScore,
          status: p.status,
          themeId: themes[p.themeIdx].id,
        },
      }),
    ),
  );

  console.log(`Created ${proposals.length} proposals`);

  // ── 6. PROPOSAL EVIDENCE ─────────────────────────────────
  // Link top 10 feedback items per proposal
  linkOffset = 0;
  for (let p = 0; p < proposals.length; p++) {
    const arr = feedbackArrays[p];
    const count = Math.min(10, arr.length);
    for (let j = 0; j < count; j++) {
      const fi = feedbackItems[linkOffset + j];
      await prisma.proposalEvidence.create({
        data: {
          proposalId: proposals[p].id,
          feedbackItemId: fi.id,
          relevanceScore: parseFloat((0.75 + Math.random() * 0.25).toFixed(3)),
          quote:
            arr[j].content.length > 120 ? arr[j].content.substring(0, 120) + '...' : arr[j].content,
        },
      });
    }
    linkOffset += arr.length;
  }

  console.log('Linked evidence to proposals');

  // ── 7. SPECS (3 - for approved proposals) ────────────────
  const specDefs = [
    {
      proposalId: proposals[0].id, // Pagination & virtual scrolling
      prdMarkdown: `# PRD: Query Pagination & Virtual Scrolling

## Overview
Implement server-side pagination and client-side virtual scrolling to ensure all pages load in under 2 seconds regardless of dataset size.

## Problem Statement
Users with large datasets (10,000+ tasks) experience page load times of 8-14 seconds. The current implementation loads all items from the database and renders them in the DOM simultaneously. This causes browser freezes, 504 gateway timeouts, and has led multiple enterprise customers to evaluate competing products.

## Goals
- All list views load in <2 seconds for datasets up to 100K items
- Smooth scrolling experience with no visible jank
- Maintain all existing filter and sort capabilities
- Zero breaking changes to the API contract

## User Stories
1. As a PM with 15,000 tasks, I want the task list to load instantly so I can find what I need without waiting.
2. As an enterprise admin, I want the dashboard to remain responsive as our data grows so my team stays productive.
3. As a developer using the API, I want paginated responses with cursor-based navigation so I can efficiently fetch large datasets.
4. As a user scrolling through feedback items, I want smooth continuous scrolling so the experience feels native.

## Acceptance Criteria
1. All list endpoints return paginated responses (default 50 items, max 200)
2. API supports cursor-based pagination with \`cursor\` and \`limit\` query params
3. Frontend uses virtual scrolling for lists >100 items
4. Page load time <2s at p95 for datasets up to 100K rows
5. Existing filters and sorts work with pagination
6. Backward-compatible: \`page\`/\`pageSize\` params still work alongside cursor
7. Loading skeleton shown during page transitions
8. "Load more" or infinite scroll UX on all list views

## Technical Approach
- **Backend**: Add cursor-based pagination to all Prisma queries using \`cursor\`/\`take\`/\`skip\`. Add database indexes on sort columns. Implement keyset pagination for consistent performance.
- **Frontend**: Integrate \`@tanstack/react-virtual\` for virtual scrolling. Update React Query hooks to use infinite queries with \`getNextPageParam\`.
- **Caching**: Add Redis caching for count queries (60s TTL) to avoid expensive COUNT(*) on every request.

## Data Model Changes
- No schema changes required
- Add composite indexes: \`FeedbackItem(createdAt, id)\`, \`Theme(opportunityScore, id)\`, \`Proposal(riceScore, id)\`

## API Changes
- All list endpoints accept \`cursor\` (string, optional) and \`limit\` (number, 1-200, default 50)
- Response includes \`nextCursor\` field (null when no more results)
- Deprecate (but continue supporting) \`page\`/\`pageSize\` params

## Edge Cases
- Empty result sets should return \`{ data: [], nextCursor: null }\`
- Deleted items between pages (cursor still valid, skip missing items)
- Concurrent modifications during pagination (eventual consistency acceptable)
- Sort order changes mid-pagination (reset cursor)

## Out of Scope
- Full-text search optimization (separate initiative)
- Database sharding or read replicas
- Offline support`,
      agentPrompt: `You are implementing server-side pagination and virtual scrolling for ShipScope, a feedback analysis tool built with Express + Prisma + React.

TASK: Add cursor-based pagination to all list API endpoints and virtual scrolling to the React frontend.

CONTEXT:
- Backend: Express.js + Prisma ORM + PostgreSQL
- Frontend: React 18 + TanStack React Query + Tailwind CSS
- Current state: All list endpoints return full datasets without pagination
- Problem: Pages take 8-14 seconds to load with 10K+ items

REQUIREMENTS:
1. Backend - Add cursor-based pagination to these endpoints:
   - GET /api/feedback (packages/api/src/routes/feedback.ts)
   - GET /api/synthesis/themes (packages/api/src/routes/synthesis.ts)
   - GET /api/proposals (packages/api/src/routes/proposals.ts)
   - GET /api/dashboard/activity (packages/api/src/routes/dashboard.ts)

2. Each endpoint should accept: cursor (string), limit (number, default 50, max 200)
3. Response format: { data: [...], nextCursor: string | null, pagination: { total, hasMore } }
4. Keep backward compatibility with existing page/pageSize params

5. Frontend - Add virtual scrolling:
   - Install @tanstack/react-virtual
   - Update FeedbackTable, ThemeCard list, ProposalCard list to use virtual scrolling
   - Update React Query hooks to use useInfiniteQuery with getNextPageParam
   - Show Skeleton loading states during fetches

6. Database - Add composite indexes in Prisma schema:
   - FeedbackItem: @@index([createdAt, id])
   - Theme: @@index([opportunityScore, id])
   - Proposal: @@index([riceScore, id])

TESTS TO WRITE:
- Unit: Cursor pagination returns correct next cursor
- Unit: Limit parameter is respected and capped at 200
- Unit: Empty results return null cursor
- Integration: Paginating through full dataset returns all items
- Integration: Filters work correctly with cursor pagination`,
    },
    {
      proposalId: proposals[1].id, // CSV/JSON export
      prdMarkdown: `# PRD: Bulk Data Export (CSV/JSON)

## Overview
Add CSV and JSON export capabilities across all data views, enabling users to extract their data for reporting, compliance, and custom analysis workflows.

## Problem Statement
Users cannot export data from ShipScope in any structured format. Teams spend hours manually copy-pasting data for quarterly board reports. Compliance teams cannot fulfill GDPR/CCPA data export requests. BI teams cannot build custom dashboards from ShipScope data.

## Goals
- One-click CSV/JSON export from any data view
- Filtered exports matching current view state
- Bulk API export endpoint for programmatic access
- PDF export for specs and PRDs
- Export completes within 30 seconds for up to 100K rows

## User Stories
1. As a PM, I want to export feedback data to CSV so I can create custom reports in Excel.
2. As a compliance officer, I want to export all user data as JSON so I can fulfill GDPR requests.
3. As a BI analyst, I want a bulk API export endpoint so I can pipe data into our analytics warehouse.
4. As a consultant, I want to export PRDs as PDF so I can share them with clients who don't have ShipScope access.
5. As a team lead, I want to export the current filtered view so I only get the data I need.

## Acceptance Criteria
1. Export buttons (CSV, JSON) appear on Feedback, Themes, Proposals, and Specs pages
2. Exports respect current filters and sort order
3. CSV includes headers matching the table columns
4. JSON export uses the same schema as API responses
5. Export of 50K rows completes in <30 seconds
6. PRD/Spec pages have a "Download PDF" button
7. API endpoint: GET /api/export/:entity?format=csv|json with same filter params as list endpoints
8. Export files are named: shipscope-{entity}-{date}.{ext}

## Technical Approach
- **Backend**: Create /api/export routes that stream data as CSV or JSON. Use Prisma cursor pagination internally to avoid loading all data into memory. Set Content-Disposition header for file download.
- **Frontend**: Add export dropdown button component. On click, redirect to export API URL with current filter params. Show progress toast for large exports.
- **PDF**: Use server-side markdown-to-PDF conversion (markdown-pdf or puppeteer) for spec documents.

## API Changes
- GET /api/export/feedback?format=csv&channel=support_ticket&...
- GET /api/export/themes?format=json&category=bug&...
- GET /api/export/proposals?format=csv&status=approved&...
- GET /api/specs/:id/pdf (returns PDF file)

## Edge Cases
- Very large exports (100K+): Stream response, don't buffer in memory
- Special characters in CSV (commas, newlines in content): Proper CSV escaping
- Unicode content: UTF-8 BOM prefix for Excel compatibility
- Empty result set: Export file with headers only (CSV) or empty array (JSON)

## Out of Scope
- Scheduled/automated exports
- Export to cloud storage (S3, Google Drive)
- Import from exported files (round-trip)`,
      agentPrompt: `You are implementing bulk data export for ShipScope, a feedback analysis tool built with Express + Prisma + React.

TASK: Add CSV/JSON export to all data views and a PDF export for specs.

CONTEXT:
- Backend: Express.js + Prisma ORM + PostgreSQL
- Frontend: React 18 + TanStack React Query + Tailwind CSS
- Users need to export feedback, themes, proposals, and specs data

REQUIREMENTS:
1. Backend - Create export routes (packages/api/src/routes/export.ts):
   - GET /api/export/feedback?format=csv|json (accepts same filter params as /api/feedback)
   - GET /api/export/themes?format=csv|json
   - GET /api/export/proposals?format=csv|json
   - GET /api/specs/:id/pdf

2. Stream large datasets using cursor pagination internally (don't load all into memory)
3. Set Content-Disposition: attachment; filename="shipscope-feedback-2026-03-07.csv"
4. CSV: Include UTF-8 BOM, escape special characters properly
5. JSON: Array of objects matching API response schema

6. Frontend - Add ExportButton component (packages/web/src/components/ui/ExportButton.tsx):
   - Dropdown with CSV and JSON options
   - Constructs URL with current filter params and opens in new tab
   - Add to FeedbackTable, Themes page, Proposals page, Specs page

7. PDF Export for specs:
   - Convert prdMarkdown to PDF on the server
   - Return as application/pdf with proper filename

TESTS TO WRITE:
- Unit: CSV output has correct headers and escaping
- Unit: JSON output matches expected schema
- Unit: Filters are applied correctly to export queries
- Integration: Export endpoint returns downloadable file with correct Content-Type
- Integration: Large dataset export streams without timeout`,
    },
    {
      proposalId: proposals[4].id, // SSO
      prdMarkdown: `# PRD: SAML/OIDC Single Sign-On

## Overview
Implement SAML 2.0 and OpenID Connect authentication to enable enterprise customers to use their existing identity providers (Okta, Azure AD, Google Workspace) with ShipScope.

## Problem Statement
Enterprise security teams block ShipScope adoption without SSO integration. Teams must manage separate credentials, creating security gaps and administrative overhead. Multiple enterprise deals worth $50K+ ARR are stalled pending SSO support.

## Goals
- Support SAML 2.0 and OIDC authentication flows
- Integrate with Okta, Azure AD, Google Workspace, and OneLogin
- Enable SCIM provisioning for automated user lifecycle management
- Just-in-time user provisioning on first SSO login
- Zero impact on existing email/password authentication

## User Stories
1. As an IT admin, I want to configure SAML SSO so my team can log in with their corporate credentials.
2. As a security officer, I want centralized authentication so I can enforce MFA and password policies from our IdP.
3. As an IT admin, I want SCIM provisioning so users are automatically created and deactivated when they join or leave the company.
4. As a new employee, I want to click "Sign in with SSO" and immediately access ShipScope without creating a new account.
5. As an admin, I want to see SSO configuration status and connected users in the settings page.

## Acceptance Criteria
1. Settings page has SSO configuration section with IdP metadata upload
2. SAML 2.0 SP-initiated and IdP-initiated flows work correctly
3. OIDC authorization code flow with PKCE works correctly
4. Users are created on first SSO login (JIT provisioning)
5. Existing email/password auth continues to work alongside SSO
6. SCIM 2.0 endpoint supports user provisioning and deprovisioning
7. SSO login adds "SSO" badge to user profile
8. Admin can require SSO for all users (disable password login)

## Technical Approach
- **SAML**: Use passport-saml strategy. Store IdP metadata (entity ID, SSO URL, X.509 cert) in Settings table. Implement /auth/saml/login and /auth/saml/callback endpoints.
- **OIDC**: Use openid-client library. Support authorization code flow with PKCE. Store client ID, client secret, and discovery URL in Settings.
- **SCIM**: Implement /scim/v2/Users endpoint supporting CREATE, UPDATE, DELETE operations per RFC 7644.
- **Session**: Issue JWT on successful SSO callback, redirect to frontend with token in URL fragment.

## Data Model Changes
- Add to User model: \`ssoProvider\` (string, nullable), \`ssoSubjectId\` (string, nullable), \`ssoEnabled\` (boolean)
- Add Settings keys: \`sso_saml_metadata\`, \`sso_oidc_config\`, \`sso_required\`, \`scim_token\`

## API Changes
- POST /auth/saml/login - Initiate SAML flow
- POST /auth/saml/callback - Handle SAML assertion
- GET /auth/oidc/login - Initiate OIDC flow
- GET /auth/oidc/callback - Handle OIDC callback
- /scim/v2/Users - SCIM provisioning endpoint
- GET /api/settings/sso - Get SSO configuration status
- PUT /api/settings/sso - Update SSO configuration

## Edge Cases
- IdP certificate rotation (support multiple active certificates)
- Clock skew between ShipScope and IdP (5-minute tolerance)
- User exists with email/password, then SSO enabled (link accounts)
- SSO provider goes down (allow fallback to password if admin permits)
- SCIM deprovisioning for user with active sessions (invalidate immediately)

## Out of Scope
- Multi-factor authentication (MFA) within ShipScope (delegated to IdP)
- Directory sync beyond SCIM (LDAP, Active Directory direct)
- Role mapping from IdP groups (future phase)`,
      agentPrompt: `You are implementing SAML/OIDC SSO for ShipScope, a feedback analysis tool built with Express + Prisma + React.

TASK: Add SAML 2.0 and OIDC single sign-on authentication.

CONTEXT:
- Backend: Express.js + Prisma ORM + PostgreSQL + JWT for sessions
- Frontend: React 18 + React Router v6
- Current auth: JWT-based (API keys for webhooks, no user auth yet for self-hosted)
- Enterprise customers blocking adoption without SSO

REQUIREMENTS:
1. Backend - Add auth routes (packages/api/src/routes/auth.ts):
   - POST /auth/saml/login - Redirect to IdP
   - POST /auth/saml/callback - Process SAML assertion, create/find user, issue JWT
   - GET /auth/oidc/login - Redirect to OIDC provider
   - GET /auth/oidc/callback - Exchange code for tokens, create/find user, issue JWT

2. Install passport-saml and openid-client
3. Store SSO config in Settings table (sso_saml_metadata, sso_oidc_config)
4. Just-in-time user provisioning on first SSO login

5. SCIM endpoint (packages/api/src/routes/scim.ts):
   - GET/POST/PATCH/DELETE /scim/v2/Users per RFC 7644
   - Bearer token auth using scim_token setting

6. Frontend - Add SSO login option:
   - "Sign in with SSO" button on login page
   - SSO configuration UI in Settings (IdP metadata upload, OIDC config)
   - Visual indicator for SSO-authenticated users

7. Data Model - Add to Prisma schema:
   - User model fields: ssoProvider, ssoSubjectId, ssoEnabled
   - Or store in Settings if no User model exists yet

TESTS TO WRITE:
- Unit: SAML assertion parsing extracts email and name correctly
- Unit: OIDC token exchange returns valid user data
- Unit: JIT provisioning creates user on first login
- Unit: SCIM user creation and deactivation
- Integration: Full SAML login flow with mock IdP
- Integration: Full OIDC login flow with mock provider`,
    },
  ];

  await Promise.all(
    specDefs.map((s) =>
      prisma.spec.create({
        data: {
          proposalId: s.proposalId,
          prdMarkdown: s.prdMarkdown,
          agentPrompt: s.agentPrompt,
          version: 1,
        },
      }),
    ),
  );

  console.log('Created 3 specs');

  // ── 8. ACTIVITY LOG ──────────────────────────────────────
  const activities = [
    {
      type: 'import',
      description: 'Imported 80 feedback items from Intercom Support',
      metadata: { count: 80, format: 'intercom' },
    },
    {
      type: 'import',
      description: 'Imported 40 feedback items from User Interviews Q1 2026',
      metadata: { count: 40, format: 'interview' },
    },
    {
      type: 'import',
      description: 'Imported 30 feedback items from NPS Survey Feb 2026',
      metadata: { count: 30, format: 'survey' },
    },
    {
      type: 'import',
      description: 'Imported 30 feedback items from #product-feedback Slack',
      metadata: { count: 30, format: 'slack' },
    },
    {
      type: 'import',
      description: 'Imported 20 feedback items from G2 Reviews',
      metadata: { count: 20, format: 'review' },
    },
    {
      type: 'synthesis',
      description: 'Synthesis completed: discovered 9 themes from 200 feedback items',
      metadata: { themes: 9, items: 200 },
    },
    {
      type: 'proposal_generation',
      description: 'Generated 9 proposals from top themes',
      metadata: { created: 9, skipped: 0 },
    },
    {
      type: 'spec_generation',
      description: 'Generated spec for "Implement query pagination and virtual scrolling"',
      metadata: { proposalTitle: 'Implement query pagination and virtual scrolling' },
    },
    {
      type: 'spec_generation',
      description: 'Generated spec for "Add bulk CSV/JSON export across all views"',
      metadata: { proposalTitle: 'Add bulk CSV/JSON export across all views' },
    },
    {
      type: 'spec_generation',
      description: 'Generated spec for "Integrate SAML/OIDC single sign-on"',
      metadata: { proposalTitle: 'Integrate SAML/OIDC single sign-on' },
    },
  ];

  for (let i = 0; i < activities.length; i++) {
    await prisma.activityLog.create({
      data: {
        type: activities[i].type,
        description: activities[i].description,
        metadata: activities[i].metadata,
        createdAt: new Date(now.getTime() - (activities.length - i) * 3600000),
      },
    });
  }

  console.log('Created activity log entries');

  console.log('\nDemo seed complete: 200 feedback items, 9 themes, 9 proposals, 3 specs');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
