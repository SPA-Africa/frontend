// Sample data used across all portals until the API exists.
// Targets and programme names come from the SPA strategic plan and SRS.

import type {
  AgriListing, Booking, CatalogueTopic, Certificate, CompetitionCycle, Course, Invoice,
  Kpi, Milestone, Pillar, PillarId, PitchEntry, QuizQuestion, RubricCriterion, ServicePackage,
} from '../types';

export const pillars: Pillar[] = [
  { id: 'technology', name: 'Technology', short: 'Tech', description: 'Digital skills, AI and robotics training so young people and institutions can take part in the digital economy.', programs: ['AI and Digital Skills Academy', 'Digital Transformation Hub', 'Robotics and Innovation Labs', 'Information Monetisation Projects'] },
  { id: 'education', name: 'Education', short: 'Edu', description: 'Training teachers, improving curricula and bringing quality learning to underserved communities.', programs: ['Teacher Capacity Building', 'Education Innovation Toolkit', 'Research and Library Centres', 'Access and Advocacy Campaign'] },
  { id: 'leadership', name: 'Leadership', short: 'Lead', description: 'Growing principled, people-centred leaders through training, camps and mentorship.', programs: ['Values-Based Leadership Training', 'Emerging Leaders Academy', 'Leadership Incubation Centre', 'Mentorship Exchange Program'] },
  { id: 'young_startups', name: 'Young Startups', short: 'Startups', description: 'Helping young founders turn ideas into businesses and connecting them with investors and markets.', programs: ['Startup Bootcamps', 'Pitch and Investment Forums', 'Microfinancing and Seed Capital', 'Startup Accelerator Partnership'] },
  { id: 'agriculture', name: 'Agriculture', short: 'Agri', description: 'Modern farming skills and market access, so agriculture becomes a real career for youth and women.', programs: ['Smart Agriculture Training Centres', 'Agribusiness Development Program', 'Agri-Market Access Platform', 'Women in Agriculture Initiative'] },
];

export const pillarById = Object.fromEntries(pillars.map(p => [p.id, p])) as Record<PillarId, Pillar>;

const mods = (titles: [string, [string, 'video' | 'reading' | 'pdf' | 'quiz', number][]][]) =>
  titles.map(([title, lessons], i) => ({
    id: `m${i + 1}`,
    title,
    lessons: lessons.map(([t, type, minutes], j) => ({ id: `m${i + 1}-l${j + 1}`, title: t, type, minutes })),
  }));

export const courses: Course[] = [
  {
    id: 'c-ai-foundations', slug: 'ai-foundations', title: 'AI Foundations for Young Professionals', program: 'AI and Digital Skills Academy', pillarId: 'technology',
    summary: 'Understand what AI can and cannot do, use everyday AI tools responsibly, and build your first simple automation.',
    level: 'Beginner', hours: 12, language: ['English', 'French'], published: true, enrolled: 412,
    outcomes: ['Explain how modern AI tools work in plain language', 'Use AI assistants safely for research and writing', 'Spot bias and misinformation in AI output', 'Automate a small task in your own work'],
    modules: mods([
      ['Getting started', [['Welcome and how this course works', 'video', 6], ['What is AI, really?', 'video', 14], ['Key terms cheat sheet', 'pdf', 5]]],
      ['Using AI tools well', [['Writing good prompts', 'video', 18], ['Fact-checking AI answers', 'reading', 12], ['Practice: research a local topic', 'reading', 20]]],
      ['Responsible AI', [['Bias, privacy and consent', 'video', 16], ['Case studies from African startups', 'reading', 15], ['Module quiz', 'quiz', 10]]],
      ['Your first automation', [['Planning an automation', 'video', 12], ['Build it step by step', 'video', 25], ['Final quiz', 'quiz', 15]]],
    ]),
  },
  {
    id: 'c-digital-marketing', slug: 'digital-marketing', title: 'Digital Marketing and Remote Work', program: 'Digital Transformation Hub', pillarId: 'technology',
    summary: 'Promote a product online, work with remote teams and earn from your skills through freelancing.',
    level: 'Beginner', hours: 10, language: ['English'], published: true, enrolled: 268,
    outcomes: ['Plan a simple social media campaign', 'Use remote collaboration tools', 'Set up a freelancing profile'],
    modules: mods([
      ['Marketing basics', [['Who is your customer?', 'video', 12], ['Channels that work in Africa', 'reading', 10]]],
      ['Working remotely', [['Tools for remote teams', 'video', 14], ['Communicating clearly online', 'reading', 9], ['Quiz', 'quiz', 10]]],
    ]),
  },
  {
    id: 'c-teaching-digital', slug: 'teaching-with-digital-tools', title: 'Teaching with Digital Tools', program: 'Teacher Capacity Building', pillarId: 'education',
    summary: 'Practical, student-centred teaching methods using the devices and connectivity you actually have.',
    level: 'Intermediate', hours: 16, language: ['English', 'French', 'Kinyarwanda'], published: true, enrolled: 187,
    outcomes: ['Design a student-centred lesson', 'Use free tools for low-bandwidth classrooms', 'Assess learning with quick checks'],
    modules: mods([
      ['Student-centred learning', [['Why it matters', 'video', 10], ['Planning a lesson', 'reading', 14]]],
      ['Low-bandwidth tools', [['Offline-first resources', 'video', 15], ['Mobile phones in class', 'reading', 10], ['Quiz', 'quiz', 10]]],
    ]),
  },
  {
    id: 'c-critical-thinking', slug: 'critical-thinking-classroom', title: 'Critical Thinking in the Classroom', program: 'Teacher Capacity Building', pillarId: 'education',
    summary: 'Help learners ask better questions, weigh evidence and solve problems together.',
    level: 'Beginner', hours: 8, language: ['English', 'French'], published: true, enrolled: 143,
    outcomes: ['Use questioning techniques', 'Run group problem-solving sessions'],
    modules: mods([['Questioning', [['Open questions', 'video', 12], ['Quiz', 'quiz', 8]]]]),
  },
  {
    id: 'c-values-leadership', slug: 'values-based-leadership', title: 'Values-Based Leadership', program: 'Values-Based Leadership Training', pillarId: 'leadership',
    summary: 'Lead with integrity, balance results with relationships and build teams people want to join.',
    level: 'Intermediate', hours: 14, language: ['English', 'French'], published: true, enrolled: 236,
    outcomes: ['Define your leadership values', 'Give feedback that helps', 'Balance work and life as a leader'],
    modules: mods([
      ['Leading yourself', [['Knowing your values', 'video', 14], ['Work-life balance', 'reading', 10]]],
      ['Leading others', [['Feedback that helps', 'video', 16], ['Building trust', 'reading', 12], ['Quiz', 'quiz', 10]]],
    ]),
  },
  {
    id: 'c-emerging-leaders', slug: 'emerging-leaders', title: 'Emerging Leaders Academy', program: 'Emerging Leaders Academy', pillarId: 'leadership',
    summary: 'A short programme for students and recent graduates ready to take the lead.',
    level: 'Beginner', hours: 9, language: ['English'], published: true, enrolled: 318,
    outcomes: ['Lead a small project', 'Speak with confidence'],
    modules: mods([['Foundations', [['What leaders do', 'video', 10], ['Quiz', 'quiz', 8]]]]),
  },
  {
    id: 'c-startup-bootcamp', slug: 'startup-bootcamp', title: 'Startup Bootcamp: Idea to Business Plan', program: 'Startup Bootcamps', pillarId: 'young_startups',
    summary: 'Test your idea, understand your numbers and write a business plan investors can read.',
    level: 'Beginner', hours: 18, language: ['English', 'French'], published: true, enrolled: 355,
    outcomes: ['Validate an idea with real customers', 'Build a simple financial model', 'Write a clear business plan', 'Prepare a five-minute pitch'],
    modules: mods([
      ['Your idea', [['Finding a real problem', 'video', 14], ['Talking to customers', 'reading', 15]]],
      ['Your numbers', [['Costs, prices and margins', 'video', 18], ['Financial literacy basics', 'pdf', 10], ['Quiz', 'quiz', 12]]],
      ['Your pitch', [['Structure of a great pitch', 'video', 16], ['Practice and feedback', 'reading', 10]]],
    ]),
  },
  {
    id: 'c-smart-farming', slug: 'smart-farming', title: 'Smart Farming and Hydroponics', program: 'Smart Agriculture Training Centres', pillarId: 'agriculture',
    summary: 'Grow more with less water and land using climate-smart methods and simple agritech.',
    level: 'Beginner', hours: 11, language: ['English', 'Kinyarwanda'], published: true, enrolled: 204,
    outcomes: ['Set up a small hydroponic system', 'Plan crops around the climate', 'Keep simple farm records'],
    modules: mods([
      ['Climate-smart farming', [['Soil and water basics', 'video', 12], ['Choosing crops', 'reading', 10]]],
      ['Hydroponics', [['How it works', 'video', 14], ['Build a starter kit', 'pdf', 8], ['Quiz', 'quiz', 10]]],
    ]),
  },
  {
    id: 'c-agribusiness', slug: 'agribusiness-basics', title: 'Agribusiness Basics', program: 'Agribusiness Development Program', pillarId: 'agriculture',
    summary: 'Turn your farm into a business: pricing, buyers, cooperatives and small loans.',
    level: 'Intermediate', hours: 8, language: ['English', 'French', 'Kinyarwanda'], published: false, enrolled: 0,
    outcomes: ['Price your produce', 'Work with a cooperative'],
    modules: mods([['Selling', [['Finding buyers', 'video', 12], ['Quiz', 'quiz', 8]]]]),
  },
];

export const courseBySlug = (slug: string) => courses.find(c => c.slug === slug);

// learner progress for the demo beneficiary
export const myEnrollments = [
  { courseId: 'c-ai-foundations', status: 'in_progress' as const, progress: 0.62, lastLessonId: 'm3-l1', lastActive: '2026-10-22' },
  { courseId: 'c-startup-bootcamp', status: 'in_progress' as const, progress: 0.28, lastLessonId: 'm2-l1', lastActive: '2026-10-19' },
  { courseId: 'c-values-leadership', status: 'completed' as const, progress: 1, lastLessonId: 'm2-l3', lastActive: '2026-09-30' },
];

export const quizzes: Record<string, QuizQuestion[]> = {
  default: [
    { id: 'q1', type: 'single', prompt: 'Which of these is the best first step when an AI tool gives you a surprising fact?', options: ['Share it right away', 'Check it against a trusted source', 'Ask the tool if it is sure', 'Ignore it'], answer: [1] },
    { id: 'q2', type: 'multiple', prompt: 'Which of these are risks of using AI tools? Select all that apply.', options: ['Biased answers', 'Made-up references', 'Leaking private data', 'Faster drafting'], answer: [0, 1, 2] },
    { id: 'q3', type: 'true_false', prompt: 'AI tools always understand the local context of your community.', options: ['True', 'False'], answer: [1] },
    { id: 'q4', type: 'short', prompt: 'In one or two sentences, describe a task in your work you could automate.' },
  ],
};

export const certificates: Certificate[] = [
  { code: 'SPA-LDR-2026-0412', holder: 'Aline Uwase', courseTitle: 'Values-Based Leadership', pillarId: 'leadership', issuedAt: '2026-09-30', status: 'valid' },
  { code: 'SPA-TEC-2026-0198', holder: 'Eric Habimana', courseTitle: 'AI Foundations for Young Professionals', pillarId: 'technology', issuedAt: '2026-08-14', status: 'valid' },
  { code: 'SPA-AGR-2026-0057', holder: 'Claudine Mukamana', courseTitle: 'Smart Farming and Hydroponics', pillarId: 'agriculture', issuedAt: '2026-07-02', status: 'revoked' },
];

export const competitionCycles: CompetitionCycle[] = [
  { id: 'cy-ea-2026', name: 'East Africa Youth Pitch 2026', region: 'East Africa', opensAt: '2026-09-01', closesAt: '2026-11-15', status: 'open', entries: 48 },
  { id: 'cy-agri-2026', name: 'Agri Innovators Challenge', region: 'Continental', opensAt: '2026-10-01', closesAt: '2026-12-10', status: 'open', entries: 21 },
  { id: 'cy-pilot-2026', name: 'Kigali Pilot Pitch Night', region: 'Rwanda', opensAt: '2026-05-01', closesAt: '2026-06-30', status: 'judging', entries: 20 },
  { id: 'cy-final-2027', name: 'Continental Final 2027', region: 'Continental', opensAt: '2027-03-01', closesAt: '2027-05-01', status: 'upcoming', entries: 0 },
];

export const myPitches: PitchEntry[] = [
  {
    id: 'p-1', code: 'PITCH-2026-00417', cycleId: 'cy-ea-2026', businessName: 'SokoFresh', sector: 'Agritech',
    summary: 'A mobile platform that connects smallholder vegetable farmers with restaurants in Kigali, cutting waste and middlemen costs.',
    fundingRequested: 15000, team: [{ name: 'Aline Uwase', role: 'Founder, CEO' }, { name: 'Patrick Niyonzima', role: 'Operations' }],
    status: 'draft', updatedAt: '2026-10-21',
    files: [{ kind: 'business_plan', name: 'SokoFresh-business-plan.pdf', sizeMb: 2.4, scan: 'clean' }],
  },
  {
    id: 'p-2', code: 'PITCH-2026-00163', cycleId: 'cy-pilot-2026', businessName: 'SokoFresh (pilot)', sector: 'Agritech',
    summary: 'Pilot version of the SokoFresh marketplace tested with 12 farmers in Bugesera.',
    fundingRequested: 5000, team: [{ name: 'Aline Uwase', role: 'Founder' }],
    status: 'under_review', updatedAt: '2026-06-28',
    files: [{ kind: 'business_plan', name: 'pilot-plan.pdf', sizeMb: 1.1, scan: 'clean' }, { kind: 'pitch_deck', name: 'pilot-deck.pdf', sizeMb: 6.3, scan: 'clean' }],
  },
];

// anonymised entries routed to the demo judge (no names, per SRS FR-B2.2)
export const judgeQueue = [
  { code: 'PITCH-2026-00163', cycleId: 'cy-pilot-2026', sector: 'Agritech', summary: 'A marketplace connecting smallholder vegetable farmers directly with restaurants, cutting waste and middlemen costs.', fundingRequested: 5000, status: 'pending' as const },
  { code: 'PITCH-2026-00171', cycleId: 'cy-pilot-2026', sector: 'Edtech', summary: 'Offline-first revision app for secondary students preparing for national exams, distributed through schools.', fundingRequested: 8000, status: 'pending' as const },
  { code: 'PITCH-2026-00188', cycleId: 'cy-pilot-2026', sector: 'Clean energy', summary: 'Pay-as-you-go solar kits for rural shops, with repayments by mobile money.', fundingRequested: 12000, status: 'in_progress' as const },
  { code: 'PITCH-2026-00102', cycleId: 'cy-pilot-2026', sector: 'Health', summary: 'SMS reminders for antenatal visits, run with community health workers.', fundingRequested: 6000, status: 'submitted' as const },
];

export const rubric: RubricCriterion[] = [
  { id: 'innovation', label: 'Innovation', weight: 0.2, hint: 'How new or better is the solution?' },
  { id: 'market', label: 'Market viability', weight: 0.25, hint: 'Is there real demand and a way to reach customers?' },
  { id: 'team', label: 'Team execution', weight: 0.2, hint: 'Can this team deliver?' },
  { id: 'finance', label: 'Financial soundness', weight: 0.2, hint: 'Do the numbers make sense?' },
  { id: 'impact', label: 'Social and environmental impact', weight: 0.15, hint: 'Who benefits and how much?' },
];

export const agriListings: AgriListing[] = [
  { id: 'l-1', title: 'Fresh tomatoes', category: 'Vegetables', quantity: '400 kg', pricePerUnit: 700, unit: 'kg', location: 'Bugesera', seller: 'Umuhinzi Cooperative', postedAt: '2026-10-22', image: 'from-brand to-gold' },
  { id: 'l-2', title: 'Avocados (Hass)', category: 'Fruits', quantity: '1,200 pieces', pricePerUnit: 250, unit: 'piece', location: 'Rwamagana', seller: 'Aline Uwase', postedAt: '2026-10-21', image: 'from-ok to-gold' },
  { id: 'l-3', title: 'Maize grain', category: 'Grains', quantity: '3 tonnes', pricePerUnit: 420, unit: 'kg', location: 'Nyagatare', seller: 'Ejo Heza Farmers', postedAt: '2026-10-20', image: 'from-gold to-gold-light' },
  { id: 'l-4', title: 'Fresh milk', category: 'Dairy', quantity: '200 L / day', pricePerUnit: 400, unit: 'litre', location: 'Gicumbi', seller: 'Gicumbi Dairy Youth', postedAt: '2026-10-19', image: 'from-info to-surface-2' },
  { id: 'l-5', title: 'Specialty coffee beans', category: 'Coffee & Tea', quantity: '600 kg', pricePerUnit: 5200, unit: 'kg', location: 'Huye', seller: 'Huye Mountain Growers', postedAt: '2026-10-18', image: 'from-brand-dark to-brand' },
  { id: 'l-6', title: 'Free-range eggs', category: 'Poultry', quantity: '90 trays', pricePerUnit: 4500, unit: 'tray', location: 'Kicukiro', seller: 'Women in Agri Group', postedAt: '2026-10-17', image: 'from-gold-light to-gold' },
];

export const catalogue: CatalogueTopic[] = [
  { id: 't-capacity', title: 'Capacity Building', kind: 'Capacity Building', description: 'Foundational institutional strengthening for growing organisations.', outcomes: ['Clear roles and processes', 'Stronger internal systems'], audience: 'Whole organisation', duration: '3 days', modes: ['In-person', 'Hybrid'], languages: ['English', 'French', 'Kinyarwanda'], standalone: true },
  { id: 't-leadership', title: 'Leadership Training', kind: 'Leadership Training', description: 'Individual and cohort leadership development for managers and team leads.', outcomes: ['Confident decision-making', 'Better feedback culture'], audience: 'Managers and team leads', duration: '2 days', modes: ['In-person', 'Virtual', 'Hybrid'], languages: ['English', 'French'], standalone: true },
  { id: 't-strategy', title: 'Strategic Development and Planning', kind: 'Coaching', description: 'Turn your mission into a realistic multi-year plan with clear priorities.', outcomes: ['A one-page strategy', 'Annual priorities'], audience: 'Leadership team', duration: '4 sessions', modes: ['In-person', 'Virtual'], languages: ['English', 'French'], standalone: true },
  { id: 't-team', title: 'Team Leadership', kind: 'Coaching', description: 'Coaching for leaders who want their teams to perform and stay.', outcomes: ['Healthier team rhythms'], audience: 'Team leads', duration: '6 sessions', modes: ['Virtual', 'Hybrid'], languages: ['English'], standalone: true },
  { id: 't-change', title: 'Organisational Behaviour and Change', kind: 'Coaching', description: 'Lead people through change without losing trust or momentum.', outcomes: ['A change roadmap'], audience: 'Senior leaders', duration: '4 sessions', modes: ['In-person', 'Hybrid'], languages: ['English', 'French'], standalone: false },
  { id: 't-people', title: 'People Management', kind: 'Coaching', description: 'Human behaviour and psychology for everyday management.', outcomes: ['Fewer conflicts', 'Better one-to-ones'], audience: 'Managers', duration: '4 sessions', modes: ['Virtual'], languages: ['English', 'Kinyarwanda'], standalone: true },
  { id: 't-innovation', title: 'Organisational Innovation and Results-Based Leadership', kind: 'Coaching', description: 'Build a culture that tries new things and measures what matters.', outcomes: ['Results framework'], audience: 'Leadership team', duration: '5 sessions', modes: ['In-person', 'Hybrid'], languages: ['English'], standalone: false },
  { id: 't-project', title: 'Project Management', kind: 'Coaching', description: 'Plan, run and close projects on time and on budget.', outcomes: ['Project plan template', 'Risk log'], audience: 'Project staff', duration: '3 sessions', modes: ['In-person', 'Virtual', 'Hybrid'], languages: ['English', 'French'], standalone: true },
  { id: 't-reporting', title: 'Professional Reporting', kind: 'Coaching', description: 'Write reports that donors, boards and partners actually read.', outcomes: ['Report templates'], audience: 'Programme and M&E staff', duration: '2 sessions', modes: ['Virtual'], languages: ['English', 'French'], standalone: true },
  { id: 't-baseline', title: 'Baseline Survey and Impact Assessment', kind: 'Coaching', description: 'Measure where you start and prove the change you make.', outcomes: ['Baseline tool', 'Impact indicators'], audience: 'M&E staff', duration: '4 sessions', modes: ['In-person', 'Hybrid'], languages: ['English', 'French'], standalone: true },
  { id: 't-healthy', title: 'Healthy Teams, Healthy Organisations', kind: 'Coaching', description: 'Wellbeing, workload and team health as a foundation for performance.', outcomes: ['Team health check'], audience: 'All staff', duration: '3 sessions', modes: ['In-person', 'Virtual'], languages: ['English', 'Kinyarwanda'], standalone: true },
];

export const packages: ServicePackage[] = [
  { id: 'pkg-standard', name: 'Standard', price: 1800000, participants: 'Up to 20 people', duration: '2 days or 4 sessions', supportHours: 4, includes: ['One topic of your choice', 'Workbook for every participant', 'Short follow-up call'] },
  { id: 'pkg-advanced', name: 'Advanced', price: 4200000, participants: 'Up to 40 people', duration: '4 days or 8 sessions', supportHours: 12, includes: ['Up to three topics', 'Needs assessment review', 'Baseline and follow-up survey', 'Coaching for two leaders'] },
  { id: 'pkg-custom', name: 'Custom', price: null, participants: 'Any size', duration: 'Designed with you', supportHours: 0, includes: ['Blended programme across topics', 'Delivery in several locations', 'Dedicated programme lead'] },
];

export const bookings: Booking[] = [
  { id: 'bk-104', topics: ['t-leadership', 't-project'], packageId: 'pkg-advanced', window: '10 to 13 Nov 2026', participants: 28, mode: 'In-person', location: 'Kigali', status: 'confirmed', createdAt: '2026-10-02' },
  { id: 'bk-097', topics: ['t-reporting'], packageId: 'pkg-standard', window: '2 Dec 2026', participants: 12, mode: 'Virtual', location: 'Online', status: 'pending', createdAt: '2026-10-18' },
  { id: 'bk-081', topics: ['t-capacity'], packageId: 'pkg-standard', window: '14 to 16 Jul 2026', participants: 18, mode: 'In-person', location: 'Musanze', status: 'completed', createdAt: '2026-06-01' },
];

export const invoices: Invoice[] = [
  { id: 'inv-1', number: 'SPA-INV-2026-0031', bookingId: 'bk-104', issuedAt: '2026-10-03', dueAt: '2026-11-02', currency: 'RWF', taxRate: 0.18, paid: 2000000, status: 'partially_paid',
    lines: [{ description: 'Advanced package: Leadership Training + Project Management', qty: 1, unitPrice: 4200000 }, { description: 'Travel to venue', qty: 1, unitPrice: 150000 }] },
  { id: 'inv-2', number: 'SPA-INV-2026-0029', bookingId: 'bk-081', issuedAt: '2026-06-02', dueAt: '2026-07-02', currency: 'RWF', taxRate: 0.18, paid: 2124000, status: 'paid',
    lines: [{ description: 'Standard package: Capacity Building', qty: 1, unitPrice: 1800000 }] },
  { id: 'inv-3', number: 'SPA-INV-2026-0035', bookingId: 'bk-097', issuedAt: '2026-10-19', dueAt: '2026-11-18', currency: 'RWF', taxRate: 0.18, paid: 0, status: 'issued',
    lines: [{ description: 'Standard package: Professional Reporting', qty: 1, unitPrice: 1800000 }] },
];

export const invoiceTotals = (inv: Invoice) => {
  const subtotal = inv.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const tax = Math.round(subtotal * inv.taxRate);
  return { subtotal, tax, total: subtotal + tax, balance: subtotal + tax - inv.paid };
};

export const kpis: Kpi[] = [
  { id: 'k-trained-2029', pillarId: 'all', label: 'People trained in first programmes', target: 1500, actual: 386, dueYear: 2029, womenShare: 0.54, youthShare: 0.81 },
  { id: 'k-tech-cert', pillarId: 'technology', label: 'Trainees certified in digital skills', target: 600, actual: 162, dueYear: 2029, womenShare: 0.47, youthShare: 0.9 },
  { id: 'k-tech-inst', pillarId: 'technology', label: 'Institutions digitally transformed', target: 20, actual: 3, dueYear: 2029, womenShare: 0, youthShare: 0 },
  { id: 'k-tech-proj', pillarId: 'technology', label: 'Innovation projects incubated', target: 30, actual: 6, dueYear: 2029, womenShare: 0.5, youthShare: 1 },
  { id: 'k-edu-teachers', pillarId: 'education', label: 'Teachers trained and certified', target: 200, actual: 58, dueYear: 2029, womenShare: 0.62, youthShare: 0.35 },
  { id: 'k-lead-cohorts', pillarId: 'leadership', label: 'Leadership cohorts trained', target: 8, actual: 2, dueYear: 2029, womenShare: 0.51, youthShare: 0.77 },
  { id: 'k-startups', pillarId: 'young_startups', label: 'Youth micro-enterprises supported', target: 20, actual: 7, dueYear: 2029, womenShare: 0.43, youthShare: 1 },
  { id: 'k-agri-youth', pillarId: 'agriculture', label: 'Youth in agricultural training', target: 300, actual: 94, dueYear: 2029, womenShare: 0.58, youthShare: 1 },
  { id: 'k-agri-volume', pillarId: 'agriculture', label: 'Produce marketed through the platform', target: 50, actual: 9, unit: 'tonnes', dueYear: 2029, womenShare: 0.6, youthShare: 0.7 },
];

export const milestones: Milestone[] = [
  { id: 'ms-1', pillarId: 'technology', title: 'AI and Digital Skills Academy curriculum approved', phase: 1, quarter: '2026-Q3', note: 'Approved by the Executive Office after review with two partner universities.' },
  { id: 'ms-2', pillarId: 'technology', title: 'First cohort of 40 trainees enrolled', phase: 1, quarter: '2026-Q4', note: 'Fifty-five percent women.' },
  { id: 'ms-3', pillarId: 'education', title: 'Baseline study in three districts completed', phase: 1, quarter: '2026-Q3', note: 'Covers 24 schools.' },
  { id: 'ms-4', pillarId: 'agriculture', title: 'Demonstration farm site identified', phase: 1, quarter: '2026-Q4', note: 'Bugesera, with a youth cooperative.' },
  { id: 'ms-5', pillarId: 'young_startups', title: 'Kigali Pilot Pitch Night held', phase: 1, quarter: '2026-Q2', note: 'Twenty entries, four judges.' },
];

export const phases = [
  { n: 1, name: 'Foundation', years: '2026 to 2027', status: 'current' as const },
  { n: 2, name: 'Pilot and capacity building', years: '2028 to 2029', status: 'upcoming' as const },
  { n: 3, name: 'Expansion', years: '2030 to 2031', status: 'upcoming' as const },
  { n: 4, name: 'Institutionalisation', years: '2032 to 2033', status: 'upcoming' as const },
  { n: 5, name: 'Continental integration', years: '2034 to 2035', status: 'upcoming' as const },
  { n: 6, name: 'Sustainability and legacy', years: '2036', status: 'upcoming' as const },
];
