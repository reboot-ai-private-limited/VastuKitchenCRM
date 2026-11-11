import { COMPANY_PROFILE, DEFAULT_PROPOSAL_TERMS } from '@/config/company.js';
import { env } from '@/config/env.js';
import type { SettingRegistry } from './setting.entity.js';

/**
 * Every setting: its label, rules and default. Adding a setting = a line in
 * `SETTING_TYPES` (contracts) and one here; the Admin screen and the API fill themselves in.
 *
 * Time values are in DAYS (decimals allowed, so a demo can use minutes). The reminder defaults
 * come from `.env`, so existing deployments keep behaving the same until an Admin changes them.
 */
export const SETTINGS: SettingRegistry = {
  'projects.autoCreateOnWon': {
    group: 'Projects',
    label: 'Create a project automatically when a lead is won',
    description:
      'On: winning a lead creates its project at once. Off: Admins are alerted to create it by hand. Applies to leads won from now on.',
    type: 'boolean',
    default: true,
  },
  'leads.stuckDays': {
    group: 'Leads',
    label: 'A lead is "stuck" after (days)',
    description:
      'An open lead whose status has not changed for this long is flagged as stuck and triggers reminders.',
    type: 'number',
    default: env.LEAD_STUCK_DAYS,
    min: 0.0001,
    max: 365,
  },
  'reminders.unseenDays': {
    group: 'Reminders',
    label: 'Remind when a proposal is not opened after (days)',
    description:
      'A sent proposal the customer has not opened after this long alerts its owner, once.',
    type: 'number',
    default: env.REMINDER_UNSEEN_DAYS,
    min: 0.0001,
    max: 365,
  },
  'reminders.noActionDays': {
    group: 'Reminders',
    label: 'Remind when an opened proposal gets no action after (days)',
    description:
      'A proposal the customer opened, with the lead status unchanged since, alerts its owner after this long, once.',
    type: 'number',
    default: env.REMINDER_NO_ACTION_DAYS,
    min: 0.0001,
    max: 365,
  },
  'reminders.stagnantMax': {
    group: 'Reminders',
    label: 'Stagnant-lead reminders per stuck period (at most)',
    description:
      'A stuck lead is reminded every "stuck" interval, up to this many times, until its status changes.',
    type: 'number',
    default: env.REMINDER_STAGNANT_MAX,
    min: 1,
    max: 20,
    integer: true,
  },
  'reminders.complaintDays': {
    group: 'Reminders',
    label: 'Complaint not resolved after (days)',
    description:
      'An Open or Assigned complaint older than this reminds the technician, or the Admins when nobody is assigned. Once per complaint.',
    type: 'number',
    default: env.REMINDER_COMPLAINT_DAYS,
    min: 0.0001,
    max: 365,
  },
  'docs.maxFileMb': {
    group: 'Documents',
    label: 'Largest document that can be uploaded (MB)',
    description:
      "Files above this size are refused. Cloudinary's free plan allows about 10 MB; raise it only if your storage plan does.",
    type: 'number',
    default: 10,
    min: 1,
    max: 100,
    integer: true,
  },
  'proposals.defaultTerms': {
    group: 'Proposals',
    label: 'Default terms on a new proposal',
    description:
      'Printed on every new proposal (editable per proposal). Existing proposals are not changed.',
    type: 'longText',
    default: DEFAULT_PROPOSAL_TERMS,
  },
  'company.name': {
    group: 'Company',
    label: 'Company name',
    description: 'Printed on proposals and used in the WhatsApp message.',
    type: 'text',
    default: COMPANY_PROFILE.name,
  },
  'company.tagline': {
    group: 'Company',
    label: 'Tagline',
    description: 'Printed under the company name on proposals.',
    type: 'text',
    default: COMPANY_PROFILE.tagline,
  },
  'company.address': {
    group: 'Company',
    label: 'Address',
    description: 'Printed on proposals.',
    type: 'longText',
    default: COMPANY_PROFILE.address,
    maxLength: 400,
  },
  'company.phone': {
    group: 'Company',
    label: 'Phone',
    description: 'Printed on proposals, as the number customers can call.',
    type: 'text',
    default: COMPANY_PROFILE.phone,
    maxLength: 40,
  },
};
