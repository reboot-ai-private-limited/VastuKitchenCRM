/**
 * The company details printed on every proposal. A constant for the MVP (taken from the client's
 * website — see docs/00-vision/branding.md); becomes admin-editable settings if the client asks.
 */
export const COMPANY_PROFILE = {
  name: 'Vaastu Kitchen',
  tagline: 'Modular Kitchen & Furniture',
  address:
    '3rd Mile, Sevoke Rd, near Hotel Cindrella, Chayan Para, Kusum Vatika, Salugara, Siliguri, West Bengal 734001',
  phone: '+91 98004 88882',
} as const;

/**
 * Default terms on a new proposal (editable per proposal). PLACEHOLDER WORDING — confirm the
 * real terms with the client before the live phase.
 */
export const DEFAULT_PROPOSAL_TERMS = [
  '1. All prices are in Indian Rupees and exclude applicable taxes.',
  '2. This proposal is valid until the date shown; prices may change after it.',
  '3. Changes to the approved design or materials may change the price and delivery time.',
  '4. Delivery and installation timelines are confirmed when the order is placed.',
].join('\n');
