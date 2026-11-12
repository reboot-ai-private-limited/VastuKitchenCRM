import { RoleGate } from '@/components/common/role-gate';
import { TemplateScreen } from '@/components/proposals/templates/template-screen';

export default async function ProposalTemplatePage({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return (
    <RoleGate roles={['ADMIN']}>
      <TemplateScreen templateKey={key} />
    </RoleGate>
  );
}
