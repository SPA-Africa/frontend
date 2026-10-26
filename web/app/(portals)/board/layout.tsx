import { PortalShell } from '@/components/shell/PortalShell';

export default function Layout({ children }: { children: React.ReactNode }) {
  return <PortalShell role="board_auditor">{children}</PortalShell>;
}
