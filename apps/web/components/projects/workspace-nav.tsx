import { FileText, LifeBuoy, ListChecks, MessagesSquare, type LucideIcon } from 'lucide-react';

export type WorkspaceSection = 'feed' | 'todos' | 'complaints' | 'docs';

/** Label and icon of each project section. They are listed in the project's three-dots menu. */
export const SECTION_META: Record<WorkspaceSection, { label: string; icon: LucideIcon }> = {
  feed: { label: 'Chat', icon: MessagesSquare },
  todos: { label: 'To-do', icon: ListChecks },
  complaints: { label: 'Complaints', icon: LifeBuoy },
  docs: { label: 'Docs', icon: FileText },
};
