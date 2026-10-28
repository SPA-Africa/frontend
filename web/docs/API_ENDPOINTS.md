# API endpoints

Generated from `lib/api/services` by `npm run api:docs`. Do not edit by hand.

146 endpoints. Types named in Request and Response live in `lib/types.ts` or in the service file that declares the endpoint.

Legend: **Offline** means the client may replay the request after reconnecting, so honour `Idempotency-Key`. **Paged** means the response is `Page<T>` (`items, page, pageSize, total`).

## core-svc (NestJS) at /api/core

### agrimarket

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| POST | `/api/core/market/listings/:id/messages` | authenticated | Send a message to the seller of a listing. Relayed to the seller by SMS and email; the buyer never sees seller contact details. Limit 10 messages per hour per buyer. 400 "empty_message".. Offline | `SellerMessageRequest` | `{ sentAt: string }` | SRS-1.2.1 | listing.contacted |
| POST | `/api/core/market/listings` | beneficiary | Post produce for sale. May be queued on the device while offline and replayed with the same Idempotency-Key. 400 "invalid_listing" for empty title, non-positive quantity or price. Volumes feed the agriculture KPI "Produce marketed through the platform".. Offline | `NewListing` | `MarketListing` | SRS-1.2.1, SRS-2.2.1, FR-B3.1 | listing.created |
| DELETE | `/api/core/market/listings/:id` | beneficiary | Take one of your listings down. Owner only (403 "not_owner"). Soft delete so M&E volumes stay intact.. Offline |  | `void` | SRS-1.2.1 | listing.removed |
| GET | `/api/core/market/listings` | authenticated | Browse produce listings, newest first. Query: q?: string (title, place, seller), category?: ListingCategory, location?: string, page?: number, pageSize?: number (default 9). Seller phone numbers and emails are never returned; buyers reach sellers through POST /market/listings/:id/messages.. Paged |  | `Page<MarketListing>` | SRS-1.2.1, NFR-BW.5 |  |
| GET | `/api/core/market/listings/me` | beneficiary | The caller's own listings |  | `MarketListing[]` | SRS-1.2.1 |  |

### assistant

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| DELETE | `/api/core/assistant/conversations/:id` | authenticated | Delete one of the caller's help assistant conversations. 404 conversation_not_found unless the conversation is the caller's. Deleting does not reset the hourly question limit. |  | `void (204)` |  |  |
| GET | `/api/core/assistant/conversations/:id` | authenticated | The caller's conversation with the help assistant: questions and answers, oldest first. Only the person's messages and the assistant's answers; tool steps and thinking are never returned. 404 conversation_not_found unless the conversation is the caller's. |  | `AssistantConversation` |  |  |
| POST | `/api/core/assistant/messages` | authenticated | Ask the help assistant a question, in a new or an existing conversation. Claude (toolTurn, low effort, at most 6 tool rounds) with read-only tools over the caller's own data, chosen by role. History is stored exactly as returned and replayed unchanged (append-only); the role, page, language and date go in the user message, never the system prompt. 400 empty_message / message_too_long (2000 characters). 404 conversation_not_found unless the conversation is the caller's. 409 conversation_full after 20 questions; 409 conversation_busy when two messages race on one conversation. 429 ai_rate_limited after AI_ASSISTANT_HOURLY_LIMIT questions in an hour. 503 ai_unavailable when AI is turned off or the model cannot be reached; suggest the support team instead. `handoff` is true when the assistant suggests a person; the frontend then offers to send the transcript as a support ticket. | `AssistantMessageRequest` | `AssistantReply` |  |  |

### authoring

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| POST | `/api/core/authoring/assist` | pillar_rep, executive_admin | Writing assistant: an AI draft of a course outline, a reading lesson or quiz questions. Nothing is saved.. Query: pillar?: PillarId (executive_admin only). Runs without a database transaction (it waits for Claude, effort medium). Written in the course's first language. outline: 3 to 6 modules, each ending with a quiz lesson, minutes 1 to 240. reading: { intro, sections[{ heading, body?, list? }] }. quiz: count questions with server-generated ids, answers within the options, true_false options ["True", "False"], short questions with guidance. 400 invalid_task, title_required, lesson_title_required, invalid_count. 429 ai_rate_limited after AI_AUTHORING_HOURLY_LIMIT drafts per person per hour (default 40). 422 ai_declined when the model declines. 503 ai_unavailable "The writing assistant is not available right now" when AI is off or failing. Only usage is logged; the course is not read or written. | `AssistRequest` | `AssistResult` | FR-A2.14 |  |
| GET | `/api/core/authoring/context` | pillar_rep, executive_admin | Programmes, languages and quiz defaults for authoring in the caller's pillar. Query: pillar?: PillarId (executive_admin only) |  | `AuthoringContext` | FR-A2.14, FR-A2.9 |  |
| POST | `/api/core/authoring/courses` | pillar_rep, executive_admin | Create a draft course in the caller's pillar. Query: pillar?: PillarId (executive_admin only). pillar_id is taken from the token for pillar_rep, never from the body. Always created unpublished. Slug is derived from the title and made unique. Validation: title 5 to 120 chars, programme must belong to the pillar, hours 1 to 200, lesson minutes 1 to 240, pass mark 1 to 100.. Offline | `CourseDraftInput` | `AuthoringCourse` | FR-A2.14, FR-B1.3 | course.created |
| GET | `/api/core/authoring/courses/:id` | pillar_rep, executive_admin | One course with modules, lessons and full quiz content (answers included) for editing. 404 course_not_found; 403 other_pillar when a pillar_rep opens another pillar's course. Quiz answers are only ever returned on this authoring route, never on learner routes. |  | `AuthoringCourse` | FR-A2.14 |  |
| GET | `/api/core/authoring/courses` | pillar_rep, executive_admin | Courses of the caller's pillar, drafts included, with structure counts, completion and attention flags. Query: pillar?: PillarId (executive_admin only), status?: "published" \| "draft". RLS: pillar_rep only sees rows where courses.pillar_id = their pillar; executive_admin bypasses. completionRate = completed / enrolled for the course. Flags: draft, no_quiz, no_enrolments (published with 0 enrolled), low_completion (< 25% with at least 4 learners). |  | `AuthoringCourseRow[]` | FR-A2.14, FR-B1.3 |  |
| POST | `/api/core/authoring/courses/:id/publish` | pillar_rep, executive_admin | Publish a course so learners can find and enrol in it. 422 not_publishable with details.problems (title, summary, languages, outcomes, lessons, lesson_titles, quiz_questions) when incomplete. 409 already_published. On success the course appears in GET /catalog/courses and recommendations. |  | `AuthoringCourse` | FR-A2.14, FR-B1.3 | course.published |
| POST | `/api/core/authoring/courses/:id/unpublish` | pillar_rep, executive_admin | Hide a course from learners; enrolled learners keep their progress. 409 not_published when already a draft. Existing enrolments stay readable for those learners. |  | `AuthoringCourse` | FR-A2.14 | course.unpublished |
| PUT | `/api/core/authoring/courses/:id` | pillar_rep, executive_admin | Save the course outline, lessons and quizzes (replaces the whole draft). Same validation as create. When the course is already published, the publish checks also apply and a failing save returns 422 not_publishable, so a live course never becomes incomplete. Lesson ids that disappear remove the lesson; learner progress on removed lessons is kept for audit.. Offline | `CourseDraftInput` | `AuthoringCourse` | FR-A2.14 | course.updated |

### capacity

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/core/capacity/assessment/questionnaire` | org_client | The active needs assessment: areas with weights, questions with weights, answer scale. Versioned. ai-svc scores against the version the client submits. Seed: 10 questions across 7 areas, area weights sum to 1. |  | `Questionnaire` | FR-C3.1 |  |
| POST | `/api/core/capacity/bookings/:id/cancel` | org_client | Cancel a booking that is still pending. Only from status pending, otherwise 409 "not_cancellable". The Executive Office then cancels or credits the linked invoice.. Offline | `{ reason?: string }` | `BookingView` | FR-C4.6 | booking.cancelled |
| POST | `/api/core/capacity/bookings` | org_client | Create a booking (status pending) and issue its invoice. Recompute the price server side (ignore any client totals). Validate start >= today, end >= start, participants >= 1, location required unless Virtual, every topic supports the mode. Custom packages create the booking with no invoice (quote follows) and do not emit invoice.issued. Store the latest assessment recommendation and the optional override reason with the booking.. Offline | `BookingRequest` | `CreateBookingResult` | FR-C4.1, FR-C4.2, FR-C4.3, FR-C4.4, FR-C3.4, FR-C4.6 | booking.created, invoice.issued |
| POST | `/api/core/capacity/bookings/estimate` | org_client | Itemised estimate for a draft booking, priced by the server. No side effects. Same pricing code as booking create. Validates topics are published and within the package topic limit. | `EstimateRequest` | `BookingEstimate` | FR-C4.3 |  |
| GET | `/api/core/capacity/bookings/:id` | org_client | One booking with its invoice reference and notes. 404 when the booking belongs to another organisation. |  | `BookingView` | FR-C4.5 |  |
| GET | `/api/core/capacity/bookings` | org_client | The organisation's bookings, newest first. Query: status?: BookingStatus. RLS: only bookings of the caller organisation. |  | `BookingView[]` | FR-C4.5 |  |
| POST | `/api/core/capacity/bookings/:id/reschedule-requests` | org_client | Ask for new dates on a pending or confirmed booking. Creates a request only. The Executive Office accepts it, which sets status rescheduled and updates the window. One open request per booking.. Offline | `RescheduleRequest` | `BookingView` | FR-C4.6 | booking.reschedule_requested |
| GET | `/api/core/capacity/catalogue/:id` | public | One published topic with outcomes, audience, length, modes and languages. 404 for unpublished topics. |  | `CatalogueTopic` | FR-C2.2 |  |
| GET | `/api/core/capacity/catalogue` | public | Published coaching and training topics, with optional filters. Query: kind?: Capacity Building \| Leadership Training \| Coaching, mode?: In-person \| Virtual \| Hybrid, language?: string. Only topics with status "published". Draft and retired topics are managed through capacityAdmin. |  | `CatalogueTopic[]` | FR-C2.1, FR-C2.2 |  |
| GET | `/api/core/capacity/invoices/:id` | org_client | One invoice with lines, totals, billing details and its booking. billedTo is the organisation profile snapshot at issue time. 404 for other organisations. |  | `InvoiceDetail` | FR-C4.7, FR-C4.3 |  |
| GET | `/api/core/capacity/invoices` | org_client | The organisation's invoices with totals and balance, newest first. Query: status?: InvoiceStatus, page?: number, pageSize?: number (default 20). RLS: only invoices whose booking belongs to the caller organisation. Totals computed server side.. Paged |  | `Page<InvoiceRow>` | FR-C4.7 |  |
| GET | `/api/core/capacity/invoices/:id/pdf` | org_client | Short-lived download link for the invoice PDF. Return a MinIO pre-signed GET URL (5 minute expiry). Render the PDF on invoice.issued and cache it in MinIO. Mock mode returns the printable page. |  | `{ url: string; expiresAt: string }` | FR-C4.3 |  |
| GET | `/api/core/orgs/me` | org_client | The signed-in user's organisation profile |  | `OrgProfile` | FR-C1.2 |  |
| GET | `/api/core/orgs/me/summary` | org_client | Totals for the organisation home: billed, paid, outstanding, bookings and next engagement. Excludes draft, cancelled and written-off invoices from billed totals. Next engagement is the soonest confirmed or rescheduled booking starting today or later. |  | `OrgSummary` | FR-C4.5, FR-C4.7 |  |
| PATCH | `/api/core/orgs/me` | org_client | Update organisation details shown on invoices. Owner role inside the organisation only. Name and billing email required. Existing invoices keep their billing snapshot.. Offline | `OrgProfileUpdate` | `OrgProfile` | FR-C1.2 | organisation.updated |
| POST | `/api/core/orgs/me/users` | org_client | Invite a colleague by email as finance or coordinator. Owner only. Sends an invitation email with a one-time link (7 day expiry). 409 "already_member" when the email is already on the list. | `InviteOrgUserRequest` | `OrgUser` | FR-C1.3 | org_user.invited |
| GET | `/api/core/orgs/me/users` | org_client | People authorised to book and see invoices for the organisation |  | `OrgUser[]` | FR-C1.3 |  |
| DELETE | `/api/core/orgs/me/users/:id` | org_client | Remove a colleague's access to the organisation. Owner only. The owner and the caller cannot be removed (409). Revokes the user sessions. Past bookings and invoices are kept. |  | `void` | FR-C1.3 | org_user.removed |
| GET | `/api/core/capacity/packages` | public | Service packages with price, size, length, inclusions and topic limit. price is null for Custom (quoted). maxTopics null means no limit. |  | `PackageView[]` | FR-C2.4 |  |
| GET | `/api/core/capacity/settings` | public | Pricing settings used for estimates: VAT rate, travel fee rule, payment terms. All values are configurable by the Executive Office. Defaults: VAT 0.18, payment terms 30 days, travel fee RWF 150,000 for in-person or hybrid delivery outside Kigali. |  | `CapacitySettings` | FR-C4.3, FR-C4.6 |  |

### capacityAdmin

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| POST | `/api/core/capacity/admin/catalogue` | pillar_rep, executive_admin | Create a catalogue entry as a draft. Validation: title 3 to 120 chars, description required, kind in Capacity Building \| Leadership Training \| Coaching, at least one mode and one language. Always created as draft. | `CatalogueEntryInput` | `CatalogueEntry` | FR-C2.3 | catalogue.created |
| GET | `/api/core/capacity/admin/catalogue` | pillar_rep, executive_admin | Every coaching catalogue entry, drafts and retired included. Query: status?: "published" \| "draft" \| "retired", kind?: string. The public GET /capacity/catalogue returns published entries only. |  | `CatalogueEntry[]` | FR-C2.3 |  |
| POST | `/api/core/capacity/admin/catalogue/:id/publish` | pillar_rep, executive_admin | Publish a draft or reinstate a retired entry so organisations can book it. 409 invalid_state when already published. |  | `CatalogueEntry` | FR-C2.3 | catalogue.published |
| POST | `/api/core/capacity/admin/catalogue/:id/retire` | pillar_rep, executive_admin | Retire an entry: removed from the public catalogue, kept on past bookings and invoices. 409 invalid_state when already retired. Soft state change, never a delete. |  | `CatalogueEntry` | FR-C2.3 | catalogue.retired |
| POST | `/api/core/capacity/admin/catalogue/:id/unpublish` | pillar_rep, executive_admin | Move a published entry back to draft. 409 invalid_state unless published. Pending bookings that include it stay valid. |  | `CatalogueEntry` | FR-C2.3 | catalogue.unpublished |
| PUT | `/api/core/capacity/admin/catalogue/:id` | pillar_rep, executive_admin | Edit a catalogue entry; published edits are visible to organisations straight away. Same validation as create. Status is not changed by this route. Past bookings keep the title they were made with. | `CatalogueEntryInput` | `CatalogueEntry` | FR-C2.3 | catalogue.updated |

### catalog

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/core/catalog/courses/:slug` | public | One published course with its outline and outcomes. Return 404 "course_not_found" for unknown or unpublished slugs. Lesson content is not included. |  | `Course` | FR-A2.2 |  |
| GET | `/api/core/catalog/courses` | public | Published courses, most popular first. Query: q?: string (title, summary, programme), pillar?: PillarId, level?: 'Beginner' \| 'Intermediate' \| 'Advanced', language?: 'English' \| 'French' \| 'Kinyarwanda', page?: number, pageSize?: number (default 12). Only published courses. Cache publicly for 5 minutes; invalidate on course.published.. Paged |  | `Page<Course>` | FR-A2.1, NFR-BW.5 |  |
| GET | `/api/core/catalog/pillars` | public | The five pillars with their programmes, for filters and sign-up |  | `Pillar[]` | FR-A2.1 |  |

### certificates

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/core/certificates/me/:code` | beneficiary | One of the learner’s certificates, for the printable page. 404 "certificate_not_found" when the code does not belong to the caller. |  | `Certificate` | FR-A2.11, FR-A2.13 |  |
| GET | `/api/core/certificates/me` | beneficiary | The learner's certificates, newest first |  | `Certificate[]` | FR-A2.13 |  |
| GET | `/api/core/certificates/verify/:code` | public | Public check of a certificate code. Returns only holder name, course, pillar, issue date and status. Unknown codes return status "not_found" with 200. Rate limit 30 per minute per IP. |  | `CertificateVerification` | FR-A2.12, NFR-SEC.6 |  |

### competitions

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/core/competitions/cycles/:id` | pillar_rep, executive_admin, judge_mentor | One competition cycle |  | `CycleSummary` | FR-A3.9 |  |
| GET | `/api/core/competitions/cycles` | pillar_rep, executive_admin | All competition cycles with status and entry counts, open and judging first. Cycles carry pillar_id = young_startups. Every Pillar Representative may monitor cycles (the console nav shows them to all pillars); if the backend limits publication to the host pillar, return 403 not_cycle_owner for other pillars. executive_admin bypasses. |  | `CycleSummary[]` | FR-A3.9, FR-B2.8 |  |
| GET | `/api/core/competitions/cycles/:id/leaderboard` | pillar_rep, executive_admin, board_auditor | Ranked leaderboard with business names, available after publication. 409 results_not_published until the cycle is published. Business names are only joined to entry codes here, after publication. |  | `Leaderboard` | FR-A3.9, FR-B2.9 |  |
| GET | `/api/core/competitions/cycles/:id/progress` | pillar_rep, executive_admin | Grading completion for a cycle: entries, judge scores received and per-entry counts. Counts only. Must not include any score, aggregate, rank or business name, so nobody (including the Pillar Representative) can see results before publication. |  | `GradingProgress` | FR-B2.8 |  |
| POST | `/api/core/competitions/cycles/:id/results/publish` | pillar_rep, executive_admin | Publish the ranked results of a cycle and notify every entrant. Only from status "judging" (409 invalid_state otherwise). Irreversible. Asks ai-svc for a final aggregate recompute, then ranks by aggregate: rank 1 winner, ranks 2 to 5 finalist, the rest not_selected, and updates each entry's PitchStatus so entrants see their outcome. Entries not fully scored are ranked on the scores received. Cycles carry pillar_id = young_startups. Every Pillar Representative may monitor cycles (the console nav shows them to all pillars); if the backend limits publication to the host pillar, return 403 not_cycle_owner for other pillars. executive_admin bypasses. |  | `Leaderboard` | FR-A3.9, FR-B2.9 | results.published |

### governance

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/core/governance/audit-events` | executive_admin | Immutable audit log, newest first, with filters. Query: q?: string (actor or target), role?: Role \| "system" \| "all", action?: string, pillar?: PillarId \| "none" \| "all", from?: ISO date, to?: ISO date, page?: number, pageSize?: number (max 500). Append-only table: no UPDATE or DELETE grants for any role, enforced in Postgres. Reading the log is itself logged. Paged |  | `AuditPage` | NFR-SEC.6, FR-B1.6 |  |
| GET | `/api/core/governance/board-terms` | executive_admin | Trustees with their current term, end date and renewal eligibility. Terms are 3 years, at most 2 consecutive. A nightly job raises a reminder notification to executive_admin when a term ends within 6 months. |  | `BoardTermsSummary` | FR-B1.9 |  |
| PATCH | `/api/core/governance/eligibility` | executive_admin | Change the minimum learner age, youth upper age and guardian consent rule. minimumAge 10 to 30 (default 15), youthMaxAge 18 to 40 (default 35). Registration validates date of birth against minimumAge server-side. Audit-logged. | `Partial<Eligibility>` | `Eligibility` | FR-A1.3, FR-B1.5 | settings.updated |
| GET | `/api/core/governance/finance-config` | executive_admin | VAT rate, invoice numbering and payment terms |  | `FinanceConfig` | FR-C4.6 |  |
| PATCH | `/api/core/governance/finance-config` | executive_admin | Change VAT, numbering format, next sequence or payment terms. Format must include {SEQ}. nextSequence can only move forward (never reuse a number). Applies to invoices issued after the change. Audit-logged. | `Partial<FinanceConfig>` | `FinanceConfig` | FR-C4.6 | settings.updated |
| GET | `/api/core/governance/funding` | executive_admin, board_auditor | Grants, partnerships and earned income by stage, in USD. board_auditor: SELECT-only. Earned income rows are derived from invoices (paid = received, otherwise committed) at the configured RWF/USD rate. |  | `FundingPipeline` | FR-B1.8 |  |
| GET | `/api/core/governance/invoices` | executive_admin | Every invoice issued to every organisation, newest number first, with totals. Query: status?: InvoiceStatus \| "all", q?: string (number or organisation), page?: number, pageSize?: number (max 200). Cross-organisation read, audit-logged (FR-B1.6). totals cover the whole filtered set, not just the page. Amounts in RWF incl. VAT. Paged |  | `InvoiceList` | FR-C4.6, NFR-BW.5 |  |
| GET | `/api/core/governance/packages` | executive_admin | Coaching service packages with their current prices, for editing |  | `ServicePackage[]` | FR-C4.6 |  |
| PATCH | `/api/core/governance/packages/:id` | executive_admin | Change a package price, size, duration, support hours or inclusions. price is RWF before VAT, or null for "quoted on request". New prices apply to bookings created after the change; existing bookings and invoices keep their price. Organisations see the change immediately. | `Partial<ServicePackage>` | `ServicePackage` | FR-C4.6 | package.updated |
| GET | `/api/core/governance/people` | executive_admin | Everyone with an account, with board term details for trustees. Query: q?: string (name or email), role?: Role \| "all", status?: AccountStatus \| "all", pillar?: PillarId \| "all", page?: number, pageSize?: number (max 200). Cross-pillar read: the backend writes an audit entry per request (FR-B1.6). Learner PII is limited to name and email here. Paged |  | `Page<PersonRow>` | FR-B1.8, FR-B1.9, NFR-BW.5 |  |
| POST | `/api/core/governance/programmes` | executive_admin | Add a programme under a pillar, starting inactive. Name 3 to 80 characters, unique within the pillar (409 duplicate_programme). | `CreateProgrammeRequest` | `ProgrammeRecord` | FR-B1.5 | programme.created |
| GET | `/api/core/governance/programmes` | executive_admin | The five pillars with their programmes, active state, reps and eligibility rules |  | `ProgrammesConfig` | FR-B1.5 |  |
| PATCH | `/api/core/governance/programmes/:id` | executive_admin | Rename a programme or turn it on or off. Inactive programmes are hidden from the public catalogue and from course authoring pickers; existing enrolments continue. | `UpdateProgrammeRequest` | `ProgrammeRecord` | FR-B1.5 | programme.updated |
| GET | `/api/core/governance/settings` | executive_admin | Platform-wide defaults: quizzes, languages, privacy, uploads, certificates |  | `PlatformSettings` | FR-B1.5 |  |
| PATCH | `/api/core/governance/settings` | executive_admin | Change one or more platform defaults. Validation: quizPassMark 0.01 to 1; maxQuizAttempts 1 to 10; deletionSlaDays 1 to 90; upload limits 1 to 200 MB; languages must include "en". One audit entry per changed field. | `Partial<PlatformSettings>` | `PlatformSettings` | FR-B1.5, NFR-SEC.6 | settings.updated |
| POST | `/api/core/governance/staff-requests/:id/approve` | executive_admin | Approve a pending staff account so the person can sign in. Only from pending_approval (else 409 invalid_state). Grants the role; for pillar_rep also binds the RLS pillar scope. Sends the welcome email. Audit-logged. |  | `StaffAccount` | FR-B1.7 | staff.approved |
| POST | `/api/core/governance/staff-requests/:id/decline` | executive_admin | Decline a pending staff account. Only from pending_approval (else 409). The account stays unable to sign in; the applicant may register again. Audit-logged. | `DeclineStaffRequest` | `StaffAccount` | FR-B1.7 | staff.declined |
| GET | `/api/core/governance/staff-requests` | executive_admin | Pillar Representative and Judge/Mentor accounts, newest first, filtered by approval status. Query: status?: "pending_approval" \| "active" \| "declined" \| "suspended" \| "all" (default pending_approval). Self-registered staff are created with status pending_approval and cannot sign in (login returns 403 account_pending) until approved. |  | `StaffAccount[]` | FR-B1.7 |  |

### identity

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| POST | `/api/core/auth/oauth/google` | public | Sign in or sign up with a Google ID token | `{ idToken: string }` | `AuthResult` | FR-A1.1 |  |
| POST | `/api/core/auth/login` | public | Sign in with email or phone and password. Rate limit 5 attempts per 15 minutes per IP. Sets the refresh token cookie (httpOnly, Secure, SameSite=Lax). | `LoginRequest` | `AuthResult` | FR-A1.1, NFR-SEC.2, NFR-SEC.7 |  |
| POST | `/api/core/auth/logout` | authenticated | Revoke the refresh token and clear the cookie |  | `void` | NFR-SEC.3 |  |
| GET | `/api/core/auth/me` | authenticated | The signed-in user with role, pillar and organisation |  | `User` | FR-B1.1, FR-B1.2 |  |
| POST | `/api/core/auth/refresh` | public | Exchange the refresh cookie for a new access token. Called automatically by lib/api/http.ts on any 401. Rotate the refresh token on every call. |  | `{ accessToken: string }` | NFR-SEC.3 |  |
| POST | `/api/core/auth/register` | public | Create a learner (beneficiary) account and send a verification code. Reject under the configured minimum age (default 15) with code "under_minimum_age". Store gender and youth_status for M&E (FR-A1.6).. Offline | `RegisterLearnerRequest` | `VerificationPending` | FR-A1.1, FR-A1.2, FR-A1.3, FR-A1.6, FR-A1.7, NFR-COMPLY.2 | user.registered |
| POST | `/api/core/orgs/register` | public | Create an organisation client account and its first admin user | `RegisterOrganisationRequest` | `VerificationPending` | FR-C1.1, FR-C1.2 | organisation.registered |
| POST | `/api/core/auth/verify` | public | Confirm the 6-digit email or SMS code and sign in | `{ verificationId: string; code: string }` | `AuthResult` | FR-A1.7 |  |

### judging

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/core/judging/entries/:code/documents/:kind` | judge_mentor | Short-lived pre-signed link to the anonymised copy of an entry document. Serves the anonymised copy only, never the upload: a PDF rendered after submission with names, contact details, links and other identifying details replaced by [REDACTED] (Claude, then a deterministic pass over the entry's known names). Opened inline in the page viewer; the URL expires after 5 minutes. 409 redaction_pending while the copy is being prepared; 409 redaction_unavailable when there is none. |  | `DocumentLink` | FR-B2.2, FR-B2.3, NFR-SEC.9 |  |
| PUT | `/api/core/judging/entries/:code/draft` | judge_mentor | Save unsubmitted scores and comment so grading can continue later or offline. Partial rubric allowed; each score must be an integer 1 to 10. 409 already_submitted once the score is submitted. Drafts are private to the judge.. Offline | `SaveDraftRequest` | `JudgeDraft` | FR-B2.4 |  |
| GET | `/api/core/judging/entries/:code` | judge_mentor | Anonymised entry for grading by its code, with documents and the caller's draft or submitted score. 404 not_assigned unless the entry is routed to the caller and not recused. Response must contain no personal data: no names, team, photos, emails, phones or original file names (NFR-SEC.9). `documents` lists the entry's current files that passed the virus scan (none for an entry without files), each with the `status` of its anonymised copy: ready, pending (being prepared) or unavailable (AI turned off, three failed attempts, or the original is missing). |  | `GradingEntry` | FR-B2.2, FR-B2.3, NFR-SEC.9 |  |
| GET | `/api/core/judging/entries/:code/peer-average` | judge_mentor | Average weighted score of the other judges on an entry. 403 score_not_submitted until the caller has submitted their own score for this entry, so judging stays independent. Never reveals individual judges or their scores. |  | `PeerAverage` | FR-B2.5 |  |
| GET | `/api/core/judging/queue` | judge_mentor | Anonymised entries routed to the calling judge, with the judge's own progress on each. Query: status?: "pending" \| "in_progress" \| "submitted". Assignments are created by ai-svc routing (POST /api/ai/evaluation/cycles/:cycleId/routing) after anonymisation. Never include business name, team, founder names or original file names. Entries the judge recused from are excluded. Sorted by status (in progress, pending, submitted) then code. |  | `JudgeQueueItem[]` | FR-B2.1, FR-B2.2, NFR-SEC.9 |  |
| POST | `/api/core/judging/entries/:code/recusal` | judge_mentor | Declare a conflict of interest, leave the entry and have it re-routed to another judge. Requires confirmed = true and a reason (details required when reason = other, max 500 chars). 409 already_submitted after a score is submitted. Discards the judge's draft, removes the assignment, writes an audit entry and calls ai-svc POST /evaluation/entries/:code/reroute so a replacement judge is assigned. | `RecusalRequest` | `RecusalResult` | FR-B2.7 | pitch.recused |
| GET | `/api/core/judging/cycles/:cycleId/rubric` | judge_mentor, pillar_rep, executive_admin | Scoring rubric of a cycle: criteria, weights (sum to 1) and hints |  | `RubricCriterion[]` | FR-B2.4 |  |
| GET | `/api/core/judging/scores/me` | judge_mentor | Scores the caller has submitted, newest first, with the other judges' average |  | `MyScore[]` | FR-B2.5 |  |
| POST | `/api/core/judging/entries/:code/scores` | judge_mentor | Submit the final rubric score and written comment for an entry. Every criterion scored with an integer 1 to 10 (400 incomplete_rubric / score_out_of_range); comment at least 50 characters after trimming (400 comment_too_short). 409 already_submitted: scores are immutable once submitted. On success ai-svc recomputes the aggregate (FR-B2.6) and the response includes the other judges' average (FR-B2.5).. Offline | `SubmitScoreRequest` | `MyScore` | FR-B2.4, FR-B2.5, FR-B2.6 | pitch.scored |

### learners

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/core/learners` | pillar_rep, executive_admin | Learners enrolled in the caller's pillar courses, filtered and paged, with inclusion shares for the filtered set. Query: pillar?: PillarId (executive_admin only), q?: string (name or country), courseId?: string, gender?: "Female" \| "Male", ageBand?: "15 to 24" \| "25 to 35" \| "36 and over", status?: EnrollmentStatus, page?: number, pageSize?: number (default 20, max 100). RLS on enrolments joined to courses.pillar_id. Never return email, phone or date of birth to pillar_rep: age is bucketed into ageBand server-side. summary is computed over all filtered rows, not just the current page.. Paged |  | `LearnerPage` | FR-B1.3, FR-B3.9, NFR-BW.5 |  |

### lms

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| POST | `/api/core/lms/enrollments` | beneficiary | Enrol the learner in a published course. Idempotent: enrolling twice returns the existing enrolment. 404 "course_not_found" for unpublished courses.. Offline | `{ courseId: string }` | `MyCourse` | FR-A2.3 | enrollment.created |
| GET | `/api/core/lms/enrollments/me` | beneficiary | Courses the learner is enrolled in, with progress and the next lesson, most recent first |  | `MyCourse[]` | FR-A2.3, FR-A2.4 |  |
| PATCH | `/api/core/lms/enrollments/:courseId` | beneficiary | Remember the lesson the learner opened last. Offline | `{ lastLessonId: string }` | `void` | FR-A2.5 |  |
| POST | `/api/core/lms/courses/:courseId/lessons/:lessonId/complete` | beneficiary | Mark a video, reading or PDF lesson as complete. Quiz lessons are completed only by passing the quiz (400 "quiz_requires_pass"). When every lesson is done and every quiz passed, issue the certificate in the same transaction.. Offline |  | `ProgressUpdate` | FR-A2.4, FR-A2.10 | lesson.completed, course.completed, certificate.issued |
| GET | `/api/core/lms/courses/:courseId/lessons/:lessonId` | beneficiary | Content for one lesson: video sources, reading text or PDF link. Enrolled learners only (403 "not_enrolled"). Video and PDF URLs are short-lived signed /media links to MinIO. Offer 360p, 480p and 720p renditions. Reading lessons return the text written in the course editor, or a generic text when none was written. |  | `LessonContent` | FR-A2.4, NFR-BW.3 |  |
| PUT | `/api/core/lms/courses/:courseId/lessons/:lessonId/position` | beneficiary | Save where the learner stopped a video so it can resume there. Called every 15 seconds while playing and on pause. Last write wins.. Offline | `{ seconds: number }` | `void` | FR-A2.5 |  |
| GET | `/api/core/lms/player/:slug` | beneficiary | Everything the course player needs: outline, enrolment, completed lessons, quiz state, resume points. 404 "course_not_found" for unknown slugs. Unpublished courses stay readable for learners already enrolled. |  | `CoursePlayer` | FR-A2.4, FR-A2.5, FR-A2.6 |  |
| GET | `/api/core/lms/courses/:courseId/quizzes/:lessonId/feedback` | beneficiary | Feedback on the short answers of the learner's latest attempt: the AI suggestion, or the review once a Pillar Representative saved one. Empty before the first attempt. After a submit with feedbackStatus "pending", poll every 2 seconds until no item is pending. The AI gets the question, marking guidance and answer only, never the learner's name or contact details, and writes in the learner's language (account language, else Accept-Language). |  | `ShortAnswerFeedback[]` | FR-A2.6 |  |
| GET | `/api/core/lms/courses/:courseId/quizzes/:lessonId` | beneficiary | Quiz questions (without answers) with the pass mark and attempts left. Never include answer keys. Pass mark and attempts come from platform settings. |  | `Quiz` | FR-A2.6, FR-A2.8 |  |
| GET | `/api/core/lms/courses/:courseId/quizzes/:lessonId/offline` | beneficiary | Download a quiz to take offline; answers are graded when the attempt syncs. Valid for 7 days. Grading stays server-side: the package has no answer keys. The synced attempt is sent to POST .../attempts with offline=true. |  | `OfflineQuizPackage` | FR-A2.9 |  |
| POST | `/api/core/lms/courses/:courseId/quizzes/:lessonId/attempts` | beneficiary | Submit a quiz attempt; objective questions are graded at once, short answers go to review. 409 "attempts_exhausted" after the maximum attempts (default 3). 400 "incomplete" when a question is unanswered. Reveal correct options only when passed or no attempts are left. A pass completes the quiz lesson and may issue the certificate.. Offline | `QuizSubmission` | `QuizResult` | FR-A2.6, FR-A2.7, FR-A2.8, FR-A2.9, FR-A2.10 | quiz.completed, course.completed, certificate.issued |
| GET | `/api/core/lms/settings` | authenticated | Quiz rules set by the Executive Office (pass mark, attempts) |  | `LearnerSettings` | FR-A2.7, FR-A2.8 |  |

### milestones

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| POST | `/api/core/milestones` | pillar_rep | Log a milestone for the caller's pillar, tagged with a plan phase and quarter. pillar_id comes from the token. Validation: title 5 to 160 chars, phase integer 1 to 6, quarter matches YYYY-Qn between 2025-Q3 and next quarter, note up to 1000 chars. Append-only: there is no update or delete, so the record stays auditable. Feeds the quarterly report compiled by ai-svc.. Offline | `CreateMilestoneRequest` | `MilestoneRecord` | FR-B3.2, FR-B3.3 | milestone.logged |
| GET | `/api/core/milestones` | pillar_rep, executive_admin, board_auditor | Milestone log, newest quarter first. Query: pillar?: PillarId, phase?: 1..6, quarter?: YYYY-Qn. RLS: pillar_rep only receives their own pillar regardless of the pillar query. Sorted by quarter desc, then loggedAt desc. |  | `MilestoneRecord[]` | FR-B3.2, FR-B3.3 |  |

### notifications

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/core/notifications` | authenticated | Latest notifications for the signed-in user, newest first. Query: unread?: boolean, limit?: number (default 20) |  | `Notification[]` | FR-C1.6, FR-C4.4, FR-B1.9 |  |
| POST | `/api/core/notifications/read` | authenticated | Mark some or all notifications as read | `{ ids: string[] \| 'all' }` | `void` |  |  |

### pitch

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/core/pitch/cycles` | beneficiary | Competition cycles a learner can see: open, upcoming and in judging |  | `PitchCycle[]` | FR-A3.1 |  |
| POST | `/api/core/pitch/entries` | beneficiary | Start a draft entry for an open cycle. One entry per learner per cycle (409 "entry_exists"). 409 "cycle_closed" when the cycle is not open. Generates the anonymous code. | `{ cycleId: string }` | `LearnerPitch` | FR-A3.2 | pitch.draft_created |
| DELETE | `/api/core/pitch/entries/:id` | beneficiary | Delete a draft entry and its files. Drafts only (409 "entry_locked"). Deletes the MinIO objects too. |  | `void` | FR-A3.2 |  |
| GET | `/api/core/pitch/entries/:id` | beneficiary | One of the learner’s entries with its files and scan state. RLS: owner only (404 otherwise). No scores or judge details. |  | `LearnerPitch` | FR-A3.2, FR-A3.7 |  |
| GET | `/api/core/pitch/entries/me` | beneficiary | The learner's pitch entries, most recently updated first. RLS: owner only. Never return judge identities, individual or aggregate scores. |  | `LearnerPitch[]` | FR-A3.2, FR-A3.7 |  |
| GET | `/api/core/pitch/entries/:id/receipt` | beneficiary | Submission receipt for a submitted entry. 409 "not_submitted" for drafts. The same receipt is emailed on pitch.submitted. |  | `PitchReceipt` | FR-A3.8 |  |
| POST | `/api/core/pitch/entries/:id/submit` | beneficiary | Submit a draft; the entry is locked and sent for anonymous judging. Rejected after the cycle closes (409 "cycle_closed"). 400 "incomplete" unless name, sector, summary (100 to 1,500 chars), amount, team names, both files present and scanned clean. Status becomes "submitted" and the entry is read-only. Judges only ever see the anonymous code. |  | `LearnerPitch` | FR-A3.7, FR-A3.8, FR-B2.1 | pitch.submitted |
| PATCH | `/api/core/pitch/entries/:id` | beneficiary | Save changes to a draft entry. Drafts only, while the cycle is open (409 "entry_locked" / "cycle_closed"). 400 "summary_too_long" over 1,500 characters, "team_too_large" over 5 people.. Offline | `PitchDraftUpdate` | `LearnerPitch` | FR-A3.2, FR-A3.3 |  |
| DELETE | `/api/core/pitch/entries/:id/files/:kind` | beneficiary | Remove the business plan or pitch deck from a draft |  | `LearnerPitch` | FR-A3.3 |  |
| GET | `/api/core/pitch/rules` | beneficiary | Limits for pitch entries: summary length, team size, file types and sizes. File limits come from platform settings (default 20 MB business plan, 30 MB deck). |  | `PitchRules` | FR-A3.3, FR-A3.4 |  |
| POST | `/api/core/pitch/entries/:id/uploads/:uploadId/complete` | beneficiary | Confirm an upload finished; attaches the file and starts the virus scan. Verify the object exists in MinIO with the declared size. Replaces any earlier file of the same kind. Scan state starts as "pending". |  | `PitchFile` | FR-A3.5, FR-A3.6 | pitch.file_uploaded |
| GET | `/api/core/pitch/entries/:id/uploads/:uploadId` | beneficiary | Scan state of an uploaded file (pending, clean or infected). Polled every 2 seconds while pending. Infected files are deleted and cannot be submitted. |  | `PitchFile` | FR-A3.6 |  |
| POST | `/api/core/pitch/entries/:id/uploads` | beneficiary | Get a pre-signed URL to upload a business plan or pitch deck. Business plan: PDF or DOCX up to 20 MB. Pitch deck: PDF or PPTX up to 30 MB. 400 "invalid_file_type" / "file_too_large". The URL is valid for 15 minutes and bound to the declared size and content type. | `UploadUrlRequest` | `UploadTicket` | FR-A3.3, FR-A3.4, FR-A3.5 |  |

### profile

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| PUT | `/api/core/profile/me/consents` | beneficiary | Change consent choices; each change is timestamped for audit. dataProcessing cannot be withdrawn here (400 "consent_required"); the learner asks for deletion instead. Turning off aiRecommendations empties GET /api/ai/recommendations/courses. | `Partial<LearnerConsents>` | `LearnerConsents` | NFR-COMPLY.2, FR-A2.15 | consent.updated |
| DELETE | `/api/core/profile/me/deletion-request` | beneficiary | Cancel a pending deletion request |  | `void` | NFR-COMPLY.3 | account.deletion_cancelled |
| POST | `/api/core/profile/me/deletion-request` | beneficiary | Ask for the account and personal data to be deleted. Erase within the configured window (default 30 days). Issued certificates stay verifiable unless revocation is asked for. Idempotent. | `{ reason?: string }` | `DeletionRequest` | NFR-COMPLY.1, NFR-COMPLY.3 | account.deletion_requested |
| POST | `/api/core/profile/me/data-export` | beneficiary | Ask for a copy of all personal data. Email a download link (signed, 7 days) within 30 days. |  | `{ requestedAt: string; dueBy: string }` | NFR-COMPLY.1 | account.export_requested |
| GET | `/api/core/profile/me` | beneficiary | The learner’s profile, preferences and consent choices |  | `LearnerProfile` | FR-A1.5, NFR-COMPLY.2 |  |
| PATCH | `/api/core/profile/me` | beneficiary | Update profile details, pillars of interest, language or data saver. Changing the email or phone sends a new verification code before it takes effect. 400 "invalid_name" for an empty name.. Offline | `ProfileUpdate` | `LearnerProfile` | FR-A1.5, NFR-UX.1, NFR-BW.3 | profile.updated |

### reviews

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/core/lms/reviews` | pillar_rep, executive_admin | Short quiz answers of the caller's pillar with the AI suggestion and any saved review. Query: status?: "pending" \| "reviewed" \| "all" (default pending), courseId?: string, page?: number, pageSize?: number (default 20, max 100), pillar?: PillarId (executive_admin only). RLS: pillar_rep only sees lms.short_answer_reviews rows of their pillar; executive_admin sees all, or one pillar with ?pillar=. Pending oldest first, reviewed newest review first, all newest submission first. learnerName is the only learner detail returned.. Paged |  | `Page<ReviewItem>` | FR-A2.6 |  |
| POST | `/api/core/lms/reviews/:id` | pillar_rep, executive_admin | Confirm or rewrite the feedback on a short answer; the learner is notified. 400 invalid_verdict, feedback_required, feedback_too_long (1000). 404 review_not_found, also for another pillar's answer. Saving again replaces the earlier review; the learner is notified ("Your answer was reviewed", link /app/learn/<slug>) and the audit log records "Reviewed short answer" only when the verdict or text changed. | `ReviewInput` | `ReviewItem` | FR-A2.6 | short_answer.reviewed |

### schedule

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| POST | `/api/core/schedule/sessions/:id/join` | beneficiary | Get the join link for a live session and record attendance. 409 "too_early" more than 15 minutes before start, 410 "session_ended" after it ends. Attendance feeds M&E participation metrics. |  | `{ joinUrl: string }` |  | session.joined |
| GET | `/api/core/schedule/me` | beneficiary | Upcoming live sessions, deadlines and events for the learner, soonest first. Query: from?: ISO date (default now), to?: ISO date, limit?: number. Only items for courses the learner is enrolled in, plus platform-wide deadlines and events. Leave joinUrl out until 15 minutes before start. A live session still running counts as upcoming. |  | `ScheduleItem[]` |  |  |

### support

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| POST | `/api/core/support/tickets` | authenticated | Send a help request to the SPA team from inside the app. Offline | `SupportTicketRequest` | `{ id: string }` |  | support.ticket_created |

## ai-svc (FastAPI) at /api/ai

### assessment

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/ai/assessments/me` | org_client | Past assessment scores, newest first, to compare re-assessments |  | `AssessmentHistoryItem[]` | FR-C3.5 |  |
| GET | `/api/ai/assessments/me/latest` | org_client | The organisation's most recent assessment result, or null. RLS: caller organisation only. |  | `AssessmentResult \| null` | FR-C3.5, FR-C3.6 |  |
| POST | `/api/ai/assessments` | org_client | Score a completed needs assessment and recommend topics and a package. Fetch weights from core-svc for the submitted version. Every question must be answered with an integer 1 to 5 (400 "incomplete"). Store the result per organisation; re-assessment appends a new result and keeps history. Only recommend published topics.. Offline | `SubmitAssessmentRequest` | `AssessmentResult` | FR-C3.2, FR-C3.3, FR-C3.4, FR-C3.6 | assessment.completed |

### evaluation

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| POST | `/api/ai/evaluation/cycles/:cycleId/aggregates` | executive_admin, pillar_rep | Recompute weighted aggregate scores for every entry in a cycle. Runs on every pitch.scored event; this route forces a full recompute. Aggregate = mean over judges of sum(score x criterion weight). Results stay hidden from pillar_rep until the cycle is published. |  | `AggregateResult` | FR-B2.6 | pitch.aggregated |
| POST | `/api/ai/evaluation/cycles/:cycleId/routing` | executive_admin, pillar_rep | Assign every submitted entry of a cycle to judges, balancing load and sector expertise. Runs automatically when a cycle closes. Strips names, photos, contact details and file metadata before an entry enters a judge queue (FR-A3.7, NFR-SEC.9). Never assigns a judge with a declared conflict on that entry. Idempotent: existing assignments are kept. |  | `RoutingResult` | FR-A3.7, FR-B2.1, FR-B2.2 | pitch.routed |
| POST | `/api/ai/evaluation/entries/:code/reroute` | executive_admin | Assign an entry to a replacement judge after a conflict-of-interest recusal. Called by core-svc on the pitch.recused event (POST /judging/entries/:code/recusal); exposed for the Executive Office to retry. Excludes every judge who has recused from this entry. | `{ fromJudgeId: string }` | `RerouteResult` | FR-B2.7 | pitch.routed |

### metrics

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/ai/metrics/enrolments/monthly` | pillar_rep, executive_admin, board_auditor | New enrolments per calendar month for a pillar, oldest first. Query: pillar?: PillarId (forced to own pillar for pillar_rep), months?: number (default 6, max 24). month is a short English month label for the chart axis; the backend may return YYYY-MM and let the client format it. |  | `MonthlyPoint[]` | FR-B3.1, FR-B3.5 |  |
| GET | `/api/ai/metrics/kpis` | pillar_rep, executive_admin, board_auditor | KPIs with target, actual, time-prorated expectation, status and quarterly trend. Query: pillar?: PillarId \| "all". Pillar Representatives only ever receive their own pillar (RLS). Board receives published snapshots only. |  | `KpiWithStatus[]` | FR-B3.1, FR-B3.5, FR-B3.6, FR-B3.8, FR-B3.9 |  |
| GET | `/api/ai/metrics/pillars/:pillarId/overview` | pillar_rep, executive_admin, board_auditor | Headline pillar figures with six-month series: learners reached, new enrolments, women and youth shares. Read from the nightly me_pillar_metrics snapshot. pillar_rep may only request their own pillar (403 other_pillar). Youth = aged 15 to 35 at enrolment. |  | `PillarOverview` | FR-B3.1, FR-B3.5, FR-B3.9 |  |

### recommendations

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| GET | `/api/ai/recommendations/courses` | beneficiary | Courses to suggest next, with a short human-readable reason. Query: limit?: number (default 3). Return an empty list when the learner has not consented to AI recommendations. Skip courses the learner dismissed. Reasons are in the Accept-Language locale. |  | `Recommendation[]` | FR-A2.15, NFR-COMPLY.2 |  |
| POST | `/api/ai/recommendations/courses/:courseId/dismiss` | beneficiary | Hide a suggested course and use it as negative feedback |  | `void` | FR-A2.15 |  |

### reporting

| Method | Path | Who | Summary | Request | Response | SRS | Emits |
|---|---|---|---|---|---|---|---|
| POST | `/api/ai/reporting/evaluations/:year/export` | executive_admin | Generate the mid-term (2031) or final (2036) evaluation pack with every KPI, milestone and phase. year must be 2031 or 2036 (400 otherwise). Before the evaluation year it exports progress to date. Live mode returns downloadUrl (pre-signed, 15 min); rows may be omitted. Audit-logged. |  | `EvaluationExport` | FR-B3.7 | evaluation.exported |
| POST | `/api/ai/reporting/reports/:quarter/compile` | executive_admin | Recompile a draft report from the latest KPI actuals and milestone logs and send it for review. Allowed from draft or in_review (moves to in_review). 409 if already published, since published reports are frozen. |  | `CompiledReport` | FR-B3.4 | report.compiled |
| GET | `/api/ai/reporting/reports/:quarter` | executive_admin, board_auditor | A compiled quarterly report: KPIs per pillar and milestones. quarter is YYYY-Qn. board_auditor: SELECT-only; unpublished reports return 404 (not 403) so their existence is not revealed. |  | `CompiledReport` | FR-B3.4, FR-B1.8 |  |
| GET | `/api/ai/reporting/reports` | executive_admin, board_auditor | Quarterly M&E reports, newest first. board_auditor: SELECT-only and receives status "published" rows only (RLS policy on me_reports). |  | `QuarterReportSummary[]` | FR-B3.4, FR-B1.8 |  |
| POST | `/api/ai/reporting/reports/:quarter/publish` | executive_admin | Approve a report in review and publish it to the Board of Trustees. Only from in_review (409 otherwise). Freezes the snapshot, sets publishedAt, notifies trustees and Pillar Representatives. Audit-logged. |  | `CompiledReport` | FR-B3.4, FR-B3.7 | report.published |
| GET | `/api/ai/reporting/summary` | executive_admin, board_auditor | Organisation-wide reach by pillar, inclusion shares and plan phase progress. Read from the nightly me_pillar_metrics snapshot. board_auditor: SELECT-only, aggregates only (no learner rows). Executive reads are audit-logged. |  | `OrgSummary` | FR-B3.1, FR-B3.4, FR-B3.5, FR-B3.9, FR-B1.8 |  |

## Domain events

Publish these on the Redis/BullMQ bus after the change is committed (SRS 2.2.3).

- `account.deletion_cancelled` from `profile.deletion.cancel`
- `account.deletion_requested` from `profile.deletion.request`
- `account.export_requested` from `profile.export.request`
- `assessment.completed` from `assessment.submit`
- `booking.cancelled` from `capacity.bookings.cancel`
- `booking.created` from `capacity.bookings.create`
- `booking.reschedule_requested` from `capacity.bookings.reschedule`
- `catalogue.created` from `capacityAdmin.catalogue.create`
- `catalogue.published` from `capacityAdmin.catalogue.publish`
- `catalogue.retired` from `capacityAdmin.catalogue.retire`
- `catalogue.unpublished` from `capacityAdmin.catalogue.unpublish`
- `catalogue.updated` from `capacityAdmin.catalogue.update`
- `certificate.issued` from `lms.lessons.complete`, `lms.quizzes.submit`
- `consent.updated` from `profile.consents.update`
- `course.completed` from `lms.lessons.complete`, `lms.quizzes.submit`
- `course.created` from `authoring.courses.create`
- `course.published` from `authoring.courses.publish`
- `course.unpublished` from `authoring.courses.unpublish`
- `course.updated` from `authoring.courses.update`
- `enrollment.created` from `lms.enrollments.create`
- `evaluation.exported` from `reporting.evaluations.export`
- `invoice.issued` from `capacity.bookings.create`
- `lesson.completed` from `lms.lessons.complete`
- `listing.contacted` from `agrimarket.listings.contact`
- `listing.created` from `agrimarket.listings.create`
- `listing.removed` from `agrimarket.listings.delete`
- `milestone.logged` from `milestones.create`
- `org_user.invited` from `capacity.orgs.users.invite`
- `org_user.removed` from `capacity.orgs.users.remove`
- `organisation.registered` from `identity.register.organisation`
- `organisation.updated` from `capacity.orgs.update`
- `package.updated` from `governance.packages.update`
- `pitch.aggregated` from `evaluation.aggregates.recompute`
- `pitch.draft_created` from `pitch.entries.create`
- `pitch.file_uploaded` from `pitch.uploads.complete`
- `pitch.recused` from `judging.recusals.create`
- `pitch.routed` from `evaluation.routing.cycle`, `evaluation.routing.reroute`
- `pitch.scored` from `judging.scores.submit`
- `pitch.submitted` from `pitch.entries.submit`
- `profile.updated` from `profile.me.update`
- `programme.created` from `governance.programmes.create`
- `programme.updated` from `governance.programmes.update`
- `quiz.completed` from `lms.quizzes.submit`
- `report.compiled` from `reporting.reports.compile`
- `report.published` from `reporting.reports.publish`
- `results.published` from `competitions.results.publish`
- `session.joined` from `schedule.sessions.join`
- `settings.updated` from `governance.eligibility.update`, `governance.finance.update`, `governance.settings.update`
- `short_answer.reviewed` from `reviews.save`
- `staff.approved` from `governance.staffRequests.approve`
- `staff.declined` from `governance.staffRequests.decline`
- `support.ticket_created` from `support.tickets.create`
- `user.registered` from `identity.register.learner`
