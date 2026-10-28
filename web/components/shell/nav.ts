import {
  Award, BarChart3, BookOpen, Building2, CalendarDays, ClipboardCheck, ClipboardList, FileText, Flag, Gauge,
  GraduationCap, Home, Landmark, LayoutDashboard, ListChecks, MessageSquareText, Milestone, Package, Receipt,
  Rocket, ScrollText, Settings, ShieldCheck, Sprout, Store, Target, User, Users,
} from 'lucide-react';
import type { Role } from '@/lib/types';

/** `label` is an i18n key from lib/i18n/messages/nav.ts */
export interface NavItem { href: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }
export interface NavGroup { label?: string; items: NavItem[] }

// Route map for every portal (SRS role-based routing). Pages live under app/(portals)/<base>.
export const portalNav: Record<Role, { base: string; title: string; groups: NavGroup[] }> = {
  beneficiary: {
    base: '/app', title: 'nav.portal.learner',
    groups: [
      { items: [
        { href: '/app', label: 'nav.home', icon: Home },
        { href: '/app/courses', label: 'nav.myCourses', icon: BookOpen },
        { href: '/app/schedule', label: 'nav.schedule', icon: CalendarDays },
        { href: '/app/certificates', label: 'nav.certificates', icon: Award },
      ] },
      { label: 'nav.group.opportunities', items: [
        { href: '/app/pitch', label: 'nav.pitch', icon: Rocket },
        { href: '/app/market', label: 'nav.market', icon: Store },
      ] },
      { label: 'nav.group.account', items: [{ href: '/app/profile', label: 'nav.profile', icon: User }] },
    ],
  },
  org_client: {
    base: '/org', title: 'nav.portal.org',
    groups: [
      { items: [
        { href: '/org', label: 'nav.overview', icon: LayoutDashboard },
        { href: '/org/assessment', label: 'nav.assessment', icon: ClipboardCheck },
        { href: '/org/book', label: 'nav.book', icon: GraduationCap },
        { href: '/org/bookings', label: 'nav.bookings', icon: ClipboardList },
        { href: '/org/invoices', label: 'nav.invoices', icon: Receipt },
      ] },
      { label: 'nav.group.account', items: [{ href: '/org/profile', label: 'nav.orgProfile', icon: Building2 }] },
    ],
  },
  pillar_rep: {
    base: '/console', title: 'nav.portal.console',
    groups: [
      { items: [
        { href: '/console', label: 'nav.overview', icon: LayoutDashboard },
        { href: '/console/courses', label: 'nav.courses', icon: BookOpen },
        { href: '/console/reviews', label: 'nav.answerReviews', icon: MessageSquareText },
        { href: '/console/learners', label: 'nav.learners', icon: Users },
        { href: '/console/milestones', label: 'nav.milestones', icon: Milestone },
        { href: '/console/kpis', label: 'nav.kpis', icon: Target },
      ] },
      { label: 'nav.group.startups', items: [{ href: '/console/competitions', label: 'nav.competitions', icon: Flag }] },
      { label: 'nav.group.capacity', items: [{ href: '/console/catalogue', label: 'nav.catalogue', icon: Package }] },
    ],
  },
  judge_mentor: {
    base: '/judge', title: 'nav.portal.judge',
    groups: [
      { items: [
        { href: '/judge', label: 'nav.queue', icon: ListChecks },
        { href: '/judge/history', label: 'nav.submitted', icon: ScrollText },
      ] },
    ],
  },
  executive_admin: {
    base: '/admin', title: 'nav.portal.admin',
    groups: [
      { items: [
        { href: '/admin', label: 'nav.overview', icon: Gauge },
        { href: '/admin/approvals', label: 'nav.approvals', icon: ShieldCheck },
        { href: '/admin/users', label: 'nav.people', icon: Users },
        { href: '/admin/reports', label: 'nav.reports', icon: FileText },
      ] },
      { label: 'nav.group.configuration', items: [
        { href: '/admin/programs', label: 'nav.programs', icon: Sprout },
        { href: '/admin/finance', label: 'nav.finance', icon: Receipt },
        { href: '/admin/settings', label: 'nav.settings', icon: Settings },
        { href: '/admin/audit', label: 'nav.audit', icon: ScrollText },
      ] },
    ],
  },
  board_auditor: {
    base: '/board', title: 'nav.portal.board',
    groups: [
      { items: [
        { href: '/board', label: 'nav.overview', icon: BarChart3 },
        { href: '/board/plan', label: 'nav.plan', icon: Milestone },
        { href: '/board/inclusion', label: 'nav.inclusion', icon: Users },
        { href: '/board/funding', label: 'nav.funding', icon: Landmark },
        { href: '/board/reports', label: 'nav.quarterly', icon: FileText },
      ] },
    ],
  },
};
