import { PortalShell } from '@/components/shell/PortalShell';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PortalShell role="judge_mentor">{children}</PortalShell>;
}
