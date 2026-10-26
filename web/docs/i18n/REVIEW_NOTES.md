# Kinyarwanda review notes

The `rw` strings were drafted against [`KINYARWANDA_GLOSSARY.md`](./KINYARWANDA_GLOSSARY.md) but have not yet been checked by a native speaker. This page lists, per area, the phrases the translators were least sure about. Start the review here, then read each messages file top to bottom.

How to review: open the file in `lib/i18n/messages/`, change the `rw` value on the line, and keep `{placeholders}` intact. To test, run the app, open any page and pick **RW** in the language menu.

## Executive Office and Board (`admin.ts`, 242 strings)

| Key | Draft | Question |
| --- | --- | --- |
| `admin.people.boardTerm` and term reminders | Manda, "Kwibutsa irangira rya manda" | "Manda" for a board term; "amanda" avoided because it reads as fines |
| `admin.programs.minAge` | Imyaka mike yemewe | "ntarengwa" avoided because it means "not to exceed" |
| `admin.programs.eligibility` | Ibisabwa ku biyandikisha | |
| `admin.reports.midTerm`, `admin.reports.final` | Isuzuma ryo hagati, Isuzuma risoza | |
| `board.home.title` | Igenamigambi ry'ingamba | versus "Gahunda y'ingamba" for "Strategic plan" |
| `board.funding.type.earned` | Amafaranga yinjizwa n'ikigo | "Earned income" |
| `board.funding.short`, `board.funding.meets` | "angana na {share} y'amafaranga yose yabonetse" | sentence with several placeholders |
| `board.funding.stage.prospect`, `stage.committed` | Amahirwe ateganyijwe, Yemewe gutangwa | funding pipeline stages |
| `board.funding.byStage` | Inkunga ziteganyijwe hakurikijwe icyiciro | "Pipeline by stage" |
| `admin.approvals.approveJudge` | "imishinga ... itagaragaza amazina ya ba nyirayo" | "anonymised entries" |
| `admin.reports.confirmBody` | ntizongera guhindurwa | "frozen" |
| `admin.home.overdueAmount` | {amount} yarengeje igihe | agreement assumes *amafaranga* |
| `admin.finance.billed` / `received` / `outstanding` / `balance` | Ayishyujwe, Ayakiriwe, Asigaye kwishyurwa, Asigaye | |
| `admin.audit.appendOnly`, actor, target | Ibishya byongerwamo gusa, Uwakoze, Icyakorewe | |
| `admin.settings.reset`, `resetTitle`, `demoText` | "Subiza ... uko yari ari", "Zisibe" | |
| `admin.settings.sla` | Igihe ntarengwa cyo gusiba amakuru | SLA not translated literally |
| `admin.finance.format` | Uburyo bwo gutanga nimero | invoice numbering format |
| `admin.settings.enabled`, `notEnabled` | Rurakora, Ntirukora | assumes the subject is *ururimi* |
| `admin.approvals.confirmApprove`, `confirmDecline` | Kwemeza iyi konti? | infinitive questions |

Suggested glossary additions from this area: Board term = Manda; Strategic plan = Igenamigambi ry'ingamba; Evaluation = Isuzuma (mid-term: Isuzuma ryo hagati, final: Isuzuma risoza); Share (%) = Ijanisha; Minimum = Igipimo fatizo or "Nibura {pct}"; Earned income = Amafaranga yinjizwa n'ikigo; Grant = Inkunga; Partnership = Ubufatanye; Programme = Porogaramu; Publish = Gutangaza; Compile = Gukusanya; Eligibility = Ibisabwa ku biyandikisha; Actual (vs target) = Ibyagezweho; Browser = Mushakisha; languages: Icyongereza, Igifaransa, Igiswahili, Igiporutugali.

## Organisation portal and public pages (`org.ts` 262, `public.ts` 146)

| Key | Draft | Question |
| --- | --- | --- |
| `org.inv.*` (subtotal, total, qty, unit, billedTo, balanceDue) | Igiteranyo kitarimo TVA, Igiteranyo, Umubare, Igiciro kimwe, Yandikiwe, Asigaye kwishyurwa | compare with a real RRA/EBM invoice |
| `org.prof.f.tin` | Nimero iranga usora (TIN) | |
| `org.book.reference` | Nimero y'isaba | "nimero" or "nomero" |
| Organisation user roles | Nyiri konti, Imari, Umuhuzabikorwa | Owner, Finance, Coordinator |
| `org.pkg.quoted` | Igiciro cyumvikanwaho | "quoted price" |
| `org.assess.recommended`, `org.book.recommended` | Tukugira inama | might read better as *Bikwiye* |
| `org.home.overdue`, `org.home.pending` | {n} zarengeje igihe, {n} ategereje | number agreement |
| Assessment bands | Urufatiro rukomeye; Bihagaze neza, ariko hari aho kunoza; Mu ntangiriro | |
| `public.courses.curriculum` | Integanyanyigisho | |
| `public.auth.consentTerms`, `consentData`, `org.register.consent` | itangazo ryerekeye ibanga ry'amakuru | legal: please check closely |
| `public.auth.blurb.judge_mentor` | Tanga amanota ku mishinga y'urubyiruko itagaragaza ba nyirayo | |
| Gender options | Gore, Gabo, Sinifuza kubivuga | form register |
| `public.auth.signingIn` | Kwinjira birakorwa | loading text |

## Pillar console and judge terminal (`internal.ts`, 293)

| Key | Draft | Question |
| --- | --- | --- |
| `console.phase.4`, `console.phase.5` | Kubyinjiza mu nzego zihoraho; Guhuza ibikorwa ku mugabane wa Afurika | Institutionalisation, Continental integration |
| `console.editor.outcomes`, `outcomeN` | Ibyo umunyeshuri azunguka, Ingingo ya {n} | |
| `console.cat.unpublishedToast` | {title} yasubijwe mu cyiciro cy'umushinga w'inyandiko | long |
| `console.cat.retire` | Kura mu rutonde | |
| `console.kpis.behindRule` | intego yacyo ibazwe hakurikijwe igihe kimaze gushira | time-prorated target |
| `console.comp.state.complete` | Wahawe amanota yose | agreement assumes *umushinga* |
| `judge.blind`, `judge.redacted` | ritagaragaza ba nyir'imishinga; Kopi yahishwemo amakuru | |
| `judge.scale` | 1 ni hasi cyane, 10 ni indashyikirwa | |
| `judge.commentHint` | Vuga ibintu bifatika kandi mu kinyabupfura | "Be specific and kind" |
| `judge.coi.financial_interest`, `advised_team` | kurigira inama | |
| `judge.peersHidden` | kugira ngo amanota yawe atagira uwo abogamiraho | |

## Learner portal (`learner.ts`, 395)

| Key | Draft | Question |
| --- | --- | --- |
| `learner.market.per` | kuri {unit} | vowel merging cannot happen around a placeholder |
| Market units | ikintu kimwe, umufungo, palato, toni, litiro, umufuka | piece, bunch, tray, tonne, litre, bag |
| `learner.market.cat.poultry` | Inkoko n'amagi | adds "eggs" on purpose |
| `learner.pitch.receipt` | Gihamya yo kohereza | not a payment receipt |
| Pitch sectors | Ikoranabuhanga mu buhinzi, Ikoranabuhanga mu by'imari, Ubuhanzi n'ibihangano, Ingufu zisukuye | Agritech, Fintech, Creative industries, Clean energy |
| `learner.cert.certifies`, `cert.completed` | Iki cyemezo gihamya ko ... yarangije neza amahugurwa | formal certificate text around the name |
| `learner.cert.revokedLabel` | Iki cyemezo cyarateshejwe agaciro | |
| `learner.profile.consent.*`, `delPendingText`, `delAck` | wisubireho kuri uru ruhushya; bizakomeza kuba bishobora kugenzurwa | legal: please check closely |
| `learner.profile.law` | itegeko ry'u Rwanda rirengera amakuru bwite | should match the official name of Law N° 058/2021 |
| `learner.profile.consent.smsUpdates.d` | Hashobora kwishyurwa ikiguzi gisanzwe cy'ubutumwa | "standard rates may apply" |
| `learner.quiz.type.short`, `quiz.resultNote` | umwarimu wawe | facilitator |
| `learner.pitch.cd.*` | amasaha, iminota, amasegonda | may be long for the countdown boxes |

`learner.profile.typeDelete` intentionally keeps the English word **DELETE**: the page checks that the user typed exactly that word.

## Landing page, public header and footer (`site.ts`, 120)

Programme names (AI and Digital Skills Academy, Digital Transformation Hub, Robotics and Innovation Labs, Emerging Leaders Academy) stay in English, as the glossary says. Translate them only if SPA adopts official Kinyarwanda names.

| Key | Draft | Question |
| --- | --- | --- |
| `site.about.lead`, `site.model.body` | sosiyete igamije inyungu rusange (Community Benefit Company) | legal company type |
| Hero headline | Guhindura ubushobozi / bwihishe bw'Afurika / impinduka / igaragara. | split over four lines |
| `site.about.missionText` | kudaheranwa kw'abaturage | "community resilience" (changed from *ubudahangarwa*, which means immunity) |
| `site.values.*` | Gukorera abandi, Kwicisha bugufi, Kubazwa inshingano, Gutanga umusaruro, Ubudashyikirwa | the SHAPE values |
| `site.values.excellence` text | Guharanira gukora ku rwego rwo hejuru buri gihe. | |
| Startup items | Amahugurwa y'imbaraga ku mishinga mishya; Kubona igishoro cyo gutangira | "Startup bootcamps", "Access to seed funding" |
| `site.goals.*` | imishinga mishya ishyigikiwe; abagore cyangwa abo mu byiciro bihezwa | |
| Timeline phase 6 | ikigega gihoraho; Twubakira kuramba | "endowment fund", "Built to last" |
| Benefit loop | Ibisagutse, Kongera gushora | "Surplus", "Reinvest" |
| Partners | Abaterankunga bigenga | "Private donors" |
| Footer tagline | Guhuza inzozi n'ukuri. | "Bridging dreams with reality" |
| Get involved | Fatanya natwe; Ba umujyanama cyangwa umukorerabushake | |
| 404 page | Ntitwabonye urwo rupapuro; umuyoboro | "link" |
