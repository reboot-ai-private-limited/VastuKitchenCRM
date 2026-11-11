import {
  DESIGN_STAGES,
  PROJECT_STAGES,
  type DesignStage,
  type ProjectDto,
  type ProjectStage,
  type RoleName,
} from '@vastu/contracts';

export const STAGE_LABEL: Record<ProjectStage, string> = {
  DESIGN: 'Design',
  SITE: 'Site',
  CLOSED: 'Closed',
};

export const DESIGN_STAGE_LABEL: Record<DesignStage, string> = {
  NOT_STARTED: 'Not started',
  IN_DESIGN: 'In design',
  SHARED: 'Shared with client',
  APPROVED: 'Approved',
};

export interface ProjectFilters {
  search: string;
  stage: ProjectStage | null;
  designStage: DesignStage | null;
  designerId: string | null;
  page: number;
  view: 'cards' | 'table';
}

export const DEFAULT_PROJECT_FILTERS: ProjectFilters = {
  search: '',
  stage: null,
  designStage: null,
  designerId: null,
  page: 1,
  view: 'cards',
};

const oneOf = <T extends string>(list: readonly T[], v: string | null): T | null =>
  v && (list as readonly string[]).includes(v) ? (v as T) : null;

export function parseProjectFilters(params: { get(name: string): string | null }): ProjectFilters {
  const page = Number.parseInt(params.get('page') ?? '', 10);
  return {
    search: (params.get('q') ?? '').trim(),
    stage: oneOf(PROJECT_STAGES, params.get('stage')),
    designStage: oneOf(DESIGN_STAGES, params.get('design')),
    designerId: params.get('designer') || null,
    page: Number.isFinite(page) && page >= 1 ? page : 1,
    view: params.get('view') === 'table' ? 'table' : 'cards',
  };
}

export function projectFiltersToSearch(f: ProjectFilters): string {
  const p = new URLSearchParams();
  if (f.search) p.set('q', f.search);
  if (f.stage) p.set('stage', f.stage);
  if (f.designStage) p.set('design', f.designStage);
  if (f.designerId) p.set('designer', f.designerId);
  if (f.page > 1) p.set('page', String(f.page));
  if (f.view === 'table') p.set('view', 'table');
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** What the signed-in person may do on a project. Cosmetic: the API is the real gate. */
export function projectPermissions(
  role: RoleName | undefined,
  userId: string | undefined,
  p?: ProjectDto,
) {
  const isAdmin = role === 'ADMIN';
  const isCustomer = role === 'CUSTOMER';
  const isMember = !!p && !!userId && p.members.some((m) => m.id === userId);
  const isDesigner = !!p && !!userId && p.designer?.id === userId;
  return {
    isAdmin,
    isCustomer,
    isMember,
    /** Sales who own the lead but are not on the project see a summary, never the feeds. */
    summaryOnly: !isAdmin && !isCustomer && !isMember,
    createProject: isAdmin,
    editProject: isAdmin,
    manageMembers: isAdmin,
    changeStage: isAdmin,
    changeDesignStage: isAdmin || isDesigner,
    invite: isAdmin || role === 'SALES',
    seesTeam: isAdmin || isMember,
  };
}

/** A project is "on the design board" until the customer approves the design. */
export const isOnDesignBoard = (p: Pick<ProjectDto, 'designStage' | 'stage'>) =>
  p.stage !== 'CLOSED' && p.designStage !== 'APPROVED';
