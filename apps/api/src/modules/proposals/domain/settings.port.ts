export interface CompanyProfile {
  name: string;
  tagline: string;
  address: string;
  phone: string;
}

/** What proposals needs from system settings (the adapter wraps the settings contract). */
export interface ProposalSettingsPort {
  /** The terms printed on a NEW proposal. */
  defaultTerms(): Promise<string>;
  /** The company details printed on every proposal. Read each time, so an edit applies at once. */
  company(): Promise<CompanyProfile>;
}
