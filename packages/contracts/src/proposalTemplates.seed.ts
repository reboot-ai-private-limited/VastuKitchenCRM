import type { ProposalBlock, ProposalTemplate } from './proposalTemplates.js';

/**
 * Built-in proposal templates. Branding is taken from vaastukitchen.com: teal #0E8F78, warm
 * browns and creams, serif headings. Pictures are the studio's own site assets.
 */

const SITE = 'https://vaastukitchen.com';
const img = (path: string) => `${SITE}${path.replace(/ /g, '%20')}`;

const LOGO = img('/assets/logo/vastukitchen logo 2.png');
const HERO_1 = img('/home-slider/vastu1.jpg');
const HERO_2 = img('/home-slider/vastu2.jpg');
const HERO_3 = img('/home-slider/vastu3.jpg');
const STUDIO = img('/assets/home/about us.jpg');
const GALLERY = [
  { src: img('/assets/projects/l-shaped-modular-kitchen.jpg'), alt: 'L-shaped modular kitchen' },
  { src: img('/assets/projects/contemporary-island-kitchen.jpg'), alt: 'Island kitchen' },
  { src: img('/assets/projects/compact-modular-kitchen.jpg'), alt: 'Compact kitchen' },
  { src: img('/assets/projects/luxury kitchen.jpg'), alt: 'Luxury kitchen' },
  { src: img('/assets/projects/contemporary-tv-unit-design.jpg'), alt: 'TV unit' },
  { src: img('/assets/projects/custom-storage-wall-system.jpg'), alt: 'Storage wall' },
];

const PROCESS: ProposalBlock = {
  type: 'steps',
  title: 'How we work',
  items: [
    { title: 'Consultation', text: 'We listen to how you cook, live and store.' },
    { title: 'Site measure', text: 'Exact measurements taken at your home.' },
    { title: '3D concept', text: 'See your kitchen before a single panel is cut.' },
    { title: 'Material freeze', text: 'Finishes, hardware and appliances confirmed.' },
    { title: 'Production', text: 'Built in our workshop to tight tolerances.' },
    { title: 'Installation', text: 'Fitted by our own supervised team.' },
    { title: 'Handover', text: 'Walk-through, care guide and warranty papers.' },
  ],
};

const PARTNERS: ProposalBlock = {
  type: 'logos',
  title: 'Materials and hardware we trust',
  names: ['Blum', 'Hafele', 'Hettich', 'Rehau', 'Century Laminates', 'Greenlam', 'Sylvan Plywood', 'Ebco'],
};

const PAYMENT: ProposalBlock = {
  type: 'paymentSchedule',
  title: 'Payment schedule',
  rows: [
    { label: 'On confirmation of the order', percent: 50 },
    { label: 'Before production starts', percent: 40 },
    { label: 'On installation and handover', percent: 10 },
  ],
};

const SIGNATURE: ProposalBlock = {
  type: 'signature',
  leftLabel: 'For Vaastu Kitchen',
  rightLabel: 'Accepted by {{client.name}}',
};

const modern: ProposalTemplate = {
  key: 'modern-modular',
  name: 'Modern modular',
  description: 'Full-bleed photography, teal accents and the complete story: about us, scope, price, process.',
  logo: LOGO,
  theme: {
    primary: '#0E8F78',
    ink: '#2d241d',
    paper: '#ffffff',
    tint: '#f6f3ee',
    accent: '#c4b5a8',
    headingFont: 'serif',
  },
  pages: [
    {
      id: 'cover',
      kind: 'cover',
      layout: 'hero',
      image: HERO_1,
      headline: '{{proposal.title}}',
      subline: 'Prepared for {{client.name}}',
      blocks: [],
    },
    {
      id: 'about',
      kind: 'content',
      layout: 'hero',
      title: 'About Vaastu Kitchen',
      blocks: [
        {
          type: 'heading',
          eyebrow: 'Who we are',
          text: 'A design studio built on precision, trust and premium execution.',
        },
        {
          type: 'richText',
          text: "North East India's trusted name in luxury interiors and modular solutions for homes, commercial and institutional spaces.\n\nFrom the first measurement to the last handle, one team designs, builds and installs your kitchen, so nothing is lost between the drawing and the home.",
        },
        {
          type: 'stats',
          items: [
            { value: '14+', label: 'Years of experience' },
            { value: '500+', label: 'Projects completed' },
            { value: '7', label: 'Step process' },
          ],
        },
        { type: 'image', src: STUDIO, alt: 'Our studio', caption: 'Our studio in Siliguri', height: 280 },
        PARTNERS,
      ],
    },
    {
      id: 'requirement',
      kind: 'content',
      layout: 'hero',
      title: 'Your project',
      blocks: [
        { type: 'heading', eyebrow: 'Understanding your home', text: 'What we will build for {{client.name}}' },
        {
          type: 'specs',
          title: 'Project details',
          rows: [
            { label: 'Prepared for', value: '{{client.name}}' },
            { label: 'Site', value: '{{client.address}}, {{client.city}}' },
            { label: 'Proposal', value: '{{proposal.number}} · {{proposal.date}}' },
            { label: 'Valid until', value: '{{proposal.validUntil}}' },
          ],
        },
        {
          type: 'specs',
          title: 'Materials and hardware',
          rows: [
            { label: 'Carcass', value: 'Moisture-resistant plywood, edge-banded' },
            { label: 'Shutters', value: 'Laminate or acrylic finish, as selected' },
            { label: 'Hardware', value: 'Soft-close hinges and channels (Blum / Hafele class)' },
            { label: 'Countertop', value: 'To be confirmed at material freeze' },
          ],
        },
        PROCESS,
      ],
    },
    {
      id: 'pricing',
      kind: 'pricing',
      layout: 'hero',
      title: 'Investment',
      blocks: [{ type: 'pricingTable' }, { type: 'notes' }],
    },
    {
      id: 'payment',
      kind: 'content',
      layout: 'hero',
      title: 'Payment and delivery',
      blocks: [
        PAYMENT,
        {
          type: 'quote',
          text: 'Vaastu Kitchen understood our vision perfectly and delivered beyond our expectations.',
          author: 'Mr. Arjun Pradhan',
          role: 'Owner, Mayfair Hill Resort',
        },
        { type: 'gallery', images: GALLERY, columns: 3 },
      ],
    },
    {
      id: 'terms',
      kind: 'terms',
      layout: 'hero',
      title: 'Terms and conditions',
      blocks: [{ type: 'terms' }, SIGNATURE],
    },
    {
      id: 'thanks',
      kind: 'thankyou',
      layout: 'hero',
      image: HERO_2,
      headline: 'Thank you, {{client.name}}',
      subline: 'We would be honoured to build your kitchen.',
      blocks: [{ type: 'contactCard' }],
    },
  ],
};

const classic: ProposalTemplate = {
  key: 'classic-vastu',
  name: 'Classic',
  description: 'Cream paper, serif headings and warm gold rules. Traditional and formal.',
  logo: LOGO,
  theme: {
    primary: '#2d241d',
    ink: '#2d241d',
    paper: '#f6f3ee',
    tint: '#e6dfd7',
    accent: '#9a8b7e',
    headingFont: 'serif',
  },
  pages: [
    {
      id: 'cover',
      kind: 'cover',
      layout: 'split',
      image: HERO_3,
      headline: '{{proposal.title}}',
      subline: 'A proposal for {{client.name}}',
      blocks: [],
    },
    {
      id: 'about',
      kind: 'content',
      layout: 'hero',
      title: 'Our promise',
      blocks: [
        { type: 'heading', eyebrow: 'Since 2008', text: "We don't just design spaces, we elevate lifestyles." },
        {
          type: 'richText',
          text: 'Every Vaastu Kitchen is drawn around the way you live: the way you cook, the people who gather, the things you keep close.\n\nWe pair careful design with reliable execution, using proven hardware and finishes, and we stand behind the result.',
        },
        {
          type: 'team',
          title: 'The people behind your project',
          members: [
            { name: 'Mr. Ankur Agarwal', role: 'Founder and Principal Designer' },
            { name: 'Sayantra Roy', role: 'Design Consultant' },
            { name: 'Diksha Sharma', role: 'Interior Designer' },
            { name: 'Prakash Chhetri', role: 'Project Supervisor' },
          ],
        },
        PROCESS,
      ],
    },
    {
      id: 'pricing',
      kind: 'pricing',
      layout: 'hero',
      title: 'Proposal',
      blocks: [{ type: 'pricingTable' }, { type: 'notes' }],
    },
    {
      id: 'terms',
      kind: 'terms',
      layout: 'hero',
      title: 'Terms and conditions',
      blocks: [PAYMENT, { type: 'terms' }, SIGNATURE],
    },
    {
      id: 'thanks',
      kind: 'thankyou',
      layout: 'split',
      image: STUDIO,
      headline: 'With thanks',
      subline: 'We look forward to working with you, {{client.name}}.',
      blocks: [{ type: 'contactCard' }],
    },
  ],
};

const minimal: ProposalTemplate = {
  key: 'minimal-quote',
  name: 'Minimal quote',
  description: 'Three clean pages for small jobs: cover, price and terms, thank-you.',
  logo: LOGO,
  theme: {
    primary: '#0E8F78',
    ink: '#2d241d',
    paper: '#ffffff',
    tint: '#f8f8f8',
    accent: '#8aa39d',
    headingFont: 'sans',
  },
  pages: [
    {
      id: 'cover',
      kind: 'cover',
      layout: 'minimal',
      headline: '{{proposal.title}}',
      subline: '{{client.name}} · {{proposal.date}}',
      blocks: [],
    },
    {
      id: 'pricing',
      kind: 'pricing',
      layout: 'minimal',
      title: 'Quotation',
      blocks: [{ type: 'pricingTable' }, { type: 'notes' }, { type: 'terms' }, SIGNATURE],
    },
    {
      id: 'thanks',
      kind: 'thankyou',
      layout: 'minimal',
      headline: 'Thank you',
      subline: 'Questions? We are one call away.',
      blocks: [{ type: 'contactCard' }],
    },
  ],
};

export const BUILTIN_PROPOSAL_TEMPLATES: readonly ProposalTemplate[] = [modern, classic, minimal];
export const DEFAULT_PROPOSAL_TEMPLATE_KEY = modern.key;

export function findBuiltinTemplate(key: string): ProposalTemplate | undefined {
  return BUILTIN_PROPOSAL_TEMPLATES.find((t) => t.key === key);
}

