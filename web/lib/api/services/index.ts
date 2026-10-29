// Every frontend call to the backend, grouped by microservice and domain.
// Import as namespaces:  import { lms, pitch } from '@/lib/api/services';
//
// core-svc (NestJS, /api/core)
export * as identity from './core/identity';
export * as notifications from './core/notifications';
export * as catalog from './core/catalog';
export * as lms from './core/lms';
export * as certificates from './core/certificates';
export * as schedule from './core/schedule';
export * as pitch from './core/pitch';
export * as agrimarket from './core/agrimarket';
export * as profile from './core/profile';
export * as capacity from './core/capacity';
export * as capacityAdmin from './core/capacityAdmin';
export * as authoring from './core/authoring';
export * as milestones from './core/milestones';
export * as learners from './core/learners';
export * as competitions from './core/competitions';
export * as judging from './core/judging';
export * as governance from './core/governance';
export * as reviews from './core/reviews';
export * as assistant from './core/assistant';
// ai-svc (FastAPI, /api/ai)
export * as metrics from './ai/metrics';
export * as recommendations from './ai/recommendations';
export * as assessment from './ai/assessment';
export * as evaluation from './ai/evaluation';
export * as reporting from './ai/reporting';
