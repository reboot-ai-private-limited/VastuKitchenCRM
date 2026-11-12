import { RoleGate } from '@/components/common/role-gate';
import { TemplateGallery } from '@/components/proposals/templates/template-gallery';

export default function ProposalTemplatesPage() {
  return (
    <RoleGate roles={['ADMIN']}>
      <TemplateGallery />
    </RoleGate>
  );
}
