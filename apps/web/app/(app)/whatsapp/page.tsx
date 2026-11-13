import { RoleGate } from '@/components/common/role-gate';
import { WhatsappView } from '@/components/whatsapp/whatsapp-view';

/** DEMO: simulated WhatsApp chat. See lib/whatsapp-demo.ts. */
export default function WhatsappPage() {
  return (
    <RoleGate roles={['ADMIN', 'SALES', 'OFFICE']}>
      <WhatsappView />
    </RoleGate>
  );
}
