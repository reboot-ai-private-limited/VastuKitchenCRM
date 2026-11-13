/** The words and pictures of the demo: project conversations, complaints and documents. */
export interface Img { tag: string; n?: number }
interface Post {
  by: string; daysAgo: number; text: string; images?: Img[];
  visibility?: 'CLIENT' | 'TEAM'; comments?: Array<{ by: string; text: string }>;
}
export const STORIES: Array<{ project: string; posts: Post[] }> = [
  {
    project: 'Rao Kitchen — Siliguri',
    posts: [
      { by: 'Dev', daysAgo: 34, visibility: 'TEAM', text: 'Site measurement done at Hakimpara. Window wall is 7 ft 2 in, plumbing point is 2 ft off the corner. Sharing the sheet for the 3D team.', images: [{ tag: 'measurement' }, { tag: 'site-work', n: 3 }] },
      { by: 'Dev', daysAgo: 30, text: 'Welcome Mrs Rao! Here are three L-shaped layouts we shortlisted for your kitchen. Please tell us which one feels closest to how you cook.', images: [{ tag: 'l-shaped', n: 0 }, { tag: 'g-shaped' }],
        comments: [{ by: 'admin', text: 'Layout 1 is our recommendation for a family of four - the corner unit gives you the most storage.' }] },
      { by: 'Sneha', daysAgo: 22, text: 'Material freeze: Century laminate in matte grey for shutters, Greenlam off-white for the loft, Sylvan BWP ply for the carcass, Blum soft-close hinges and Hafele tandem drawers. Reply here to approve.', images: [{ tag: 'hardware' }],
        comments: [{ by: 'Dev', text: 'The quartz counter sample is also at our studio, drop in any day Mon-Sat 10 to 7.' }] },
      { by: 'Sneha', daysAgo: 12, text: 'Your cabinets are in production at our factory. We will share photos from the shop floor next week - delivery on site is planned in 2 weeks.', images: [{ tag: 'installation', n: 1 }] },
      { by: 'Dev', daysAgo: 5, visibility: 'TEAM', text: 'Internal: factory confirmed the corner carousel will arrive 2 days late. Ask the technician to start with the wall units first.' },
    ],
  },
  {
    project: 'Das Residence — Pantry & Island',
    posts: [
      { by: 'Sneha', daysAgo: 40, text: 'Hello Mr Das! Island + pantry concept is ready. The island seats three and hides the hob extractor duct inside the loft.', images: [{ tag: 'island', n: 0 }, { tag: 'island', n: 1 }],
        comments: [{ by: 'admin', text: 'Island width is 3 ft 6 in so there is a comfortable 4 ft walkway on both sides.' }] },
      { by: 'Sneha', daysAgo: 31, text: 'Material freeze done: Greenlam walnut for the island, white gloss for the pantry tall units, Rehau edge band, Ebco profile handles. We start the factory work today.', images: [{ tag: 'countertop' }] },
      { by: 'Tarun', daysAgo: 20, visibility: 'TEAM', text: 'Site check before the carcass arrives: floor is level, wall tiles are done. Power points for the oven and the dishwasher are marked on the wall.', images: [{ tag: 'site-work', n: 3 }, { tag: 'electrical' }] },
      { by: 'Tarun', daysAgo: 15, text: 'Day 1 on site - tall pantry units are up and aligned. Island base comes tomorrow.', images: [{ tag: 'installation', n: 0 }, { tag: 'site-work', n: 0 }] },
      { by: 'Bikash', daysAgo: 9, text: 'Island base fitted and levelled, hob cut-out is done. Countertop template is taken, granite will be cut this week.', images: [{ tag: 'site-work', n: 1 }, { tag: 'countertop' }],
        comments: [{ by: 'Sneha', text: 'Thanks Bikash. Mr Das, the slab arrives Thursday - please keep the kitchen free that morning.' }] },
      { by: 'Sneha', daysAgo: 3, text: 'Countertop and sink are in. We are on the final stage - handles, lights and the finishing touches. Handover is planned this weekend.', images: [{ tag: 'finished-kitchen', n: 0 }] },
    ],
  },
  // Sen Kitchen is delivered and CLOSED: a closed project takes no new posts or photos.
];

export const COMPLAINTS: Array<{
  project: string; raisedBy: string; daysAgo: number; description: string; images: Img[];
  assignTo?: string; resolved?: { note: string; image: Img };
}> = [
  // Das Residence is on site (not closed), so it still takes photos; these are snags found at fitting.
  { project: 'Das Residence — Pantry & Island', raisedBy: 'Rita', daysAgo: 6, description: 'Water seeping under the sink cabinet after the tap is used for a few minutes.', images: [{ tag: 'leak' }], assignTo: 'Tarun',
    resolved: { note: 'Waste pipe coupling was loose. Re-sealed with a new gasket and tested for 20 minutes - dry.', image: { tag: 'site-work', n: 0 } } },
  { project: 'Das Residence — Pantry & Island', raisedBy: 'Rita', daysAgo: 2, description: 'Island handle on the second drawer is loose and turns when pulled.', images: [{ tag: 'hinge' }], assignTo: 'Bikash' },
  { project: 'Das Residence — Pantry & Island', raisedBy: 'Rita', daysAgo: 1, description: 'Drawer below the hob sits crooked and stops about 2 cm before it closes fully.', images: [{ tag: 'damage' }] },
  { project: 'Das Residence — Pantry & Island', raisedBy: 'Rita', daysAgo: 4, description: 'Pantry pull-out runs noisily and catches halfway.', images: [{ tag: 'hardware', n: 1 }], assignTo: 'Bikash' },
];

const sheet = (rows: string[][]) => rows.map((r) => r.join('   |   '));
export const DOCS: Array<{
  project: string; by: string; folder: string; name: string; title: string;
  visibility: 'CLIENT' | 'TEAM'; lines: string[];
}> = [
  { project: 'Rao Kitchen — Siliguri', by: 'Dev', folder: 'Quotations', name: 'Quotation-v2-Rao-Kitchen.pdf', visibility: 'CLIENT', title: 'Quotation - L-shaped Modular Kitchen',
    lines: ['Vaastu Kitchen, Sevoke Road, Siliguri 734001  |  +91 98004 88882', 'Client: Mrs Rao, Hakimpara, Siliguri', '', ...sheet([
      ['Item', 'Specification', 'Amount (INR)'],
      ['Base units 14 ft', 'Sylvan BWP ply, Century laminate', '1,48,000'],
      ['Wall units 10 ft', 'Greenlam off-white, Blum soft-close', '96,000'],
      ['Corner carousel', 'Hafele, 2-tier', '22,000'],
      ['Tandem drawers x4', 'Hafele, full extension', '38,000'],
      ['Quartz countertop 17 ft', 'Matte grey', '78,000'],
      ['Installation + finishing', 'Own team, 4-6 weeks', '38,000'],
    ]), '', 'Total: INR 4,20,000 + GST    |    Validity 15 days    |    Payment: 50% advance, 40% before delivery, 10% handover'] },
  { project: 'Rao Kitchen — Siliguri', by: 'Dev', folder: 'Drawings', name: 'Floor-plan-and-elevation.pdf', visibility: 'TEAM', title: 'Floor plan and elevation (measurements)',
    lines: ['Site: Hakimpara, Siliguri', 'Window wall: 7 ft 2 in   |   Return wall: 9 ft 6 in   |   Ceiling height: 9 ft 1 in', 'Plumbing point: 2 ft from the corner   |   Electrical board: right of the door', '', 'Notes:', '- Keep 36 in clearance in front of the hob', '- Chimney duct runs through the north wall', '- Loft height 30 in'] },
  { project: 'Das Residence — Pantry & Island', by: 'Sneha', folder: 'Quotations', name: 'Quotation-Das-Island-Pantry.pdf', visibility: 'CLIENT', title: 'Quotation - Island Kitchen and Pantry',
    lines: ['Vaastu Kitchen, Sevoke Road, Siliguri 734001', 'Client: Mr Das, Pradhan Nagar, Siliguri', '', ...sheet([
      ['Item', 'Specification', 'Amount (INR)'],
      ['Island unit 7 x 3.5 ft', 'Greenlam walnut, drawers x6', '1,85,000'],
      ['Pantry tall units 8 ft', 'White gloss, Hafele pull-outs', '2,40,000'],
      ['Base + wall units', 'Century laminate, Blum fittings', '1,95,000'],
      ['Granite + sink cut-outs', '', '70,000'],
      ['Installation', '', '60,000'],
    ]), '', 'Total: INR 7,50,000 + GST'] },
  { project: 'Das Residence — Pantry & Island', by: 'Sneha', folder: 'Drawings', name: 'Island-layout-approved.pdf', visibility: 'CLIENT', title: 'Island and pantry layout - APPROVED',
    lines: ['Approved by Mr Das', 'Island: 7 ft x 3 ft 6 in, seating for 3', 'Walkway both sides: 4 ft', 'Pantry: 8 ft tall units with 2 pull-outs', '', 'Any change after this needs a fresh quote.'] },
  { project: 'Das Residence — Pantry & Island', by: 'Sneha', folder: 'Handover', name: 'Warranty-and-care-guide.pdf', visibility: 'CLIENT', title: 'Warranty and care guide',
    lines: ['Congratulations on your new kitchen!', '', 'Warranty: materials and installation per the Vaastu Kitchen terms', 'Hardware (Blum, Hafele): manufacturer warranty applies', '', 'Care:', '- Wipe laminate with a soft damp cloth, avoid abrasives', '- Do not stand on the shelves or hang heavy loads on doors', '- Call us on +91 98004 88882 or raise a complaint in the app for any issue'] },
];
