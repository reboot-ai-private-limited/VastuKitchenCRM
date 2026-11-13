import type { StockMovementType, StockUnit } from '@vastu/contracts';

/** A movement to record after the item exists: type, quantity (ADJUST: the new counted total), note. */
export type DemoMove = [StockMovementType, number, string];

export interface DemoStockItem {
  name: string;
  category: string;
  unit: StockUnit;
  minLevel: number;
  /** Opening balance. */
  openingQuantity: number;
  moves: DemoMove[];
}

const out = (qty: number, note: string): DemoMove => ['OUT', qty, note];
const inn = (qty: number, note: string): DemoMove => ['IN', qty, note];

/**
 * A believable store for a modular-kitchen company. Balances after the moves leave most items OK,
 * eight LOW and two OUT, so the dashboard-style flags have something to show.
 */
export const DEMO_STOCK: DemoStockItem[] = [
  // ── Boards
  {
    name: 'Plywood 18mm BWP',
    category: 'Boards',
    unit: 'sheet',
    minLevel: 10,
    openingQuantity: 60,
    moves: [
      out(12, 'Rao residence - base units'),
      out(8, 'Das residence - wall units'),
      inn(20, 'Received from supplier'),
    ],
  },
  {
    name: 'Plywood 12mm BWP',
    category: 'Boards',
    unit: 'sheet',
    minLevel: 10,
    openingQuantity: 30,
    moves: [out(14, 'Sen residence - shutters'), out(8, 'Bose residence - drawers')],
  },
  {
    name: 'Plywood 6mm (back panels)',
    category: 'Boards',
    unit: 'sheet',
    minLevel: 15,
    openingQuantity: 40,
    moves: [out(10, 'Rao residence - back panels')],
  },
  {
    name: 'MDF 18mm',
    category: 'Boards',
    unit: 'sheet',
    minLevel: 8,
    openingQuantity: 25,
    moves: [out(6, 'Sen residence - pantry')],
  },
  {
    name: 'HDHMR 18mm',
    category: 'Boards',
    unit: 'sheet',
    minLevel: 6,
    openingQuantity: 12,
    moves: [out(6, 'Das residence - sink base')],
  },
  {
    name: 'Laminate 1mm - White gloss',
    category: 'Boards',
    unit: 'sheet',
    minLevel: 15,
    openingQuantity: 45,
    moves: [out(18, 'Rao residence - shutters')],
  },
  {
    name: 'Laminate 1mm - Walnut matte',
    category: 'Boards',
    unit: 'sheet',
    minLevel: 15,
    openingQuantity: 20,
    moves: [out(12, 'Sen residence - shutters')],
  },
  {
    name: 'Laminate 1mm - Grey texture',
    category: 'Boards',
    unit: 'sheet',
    minLevel: 10,
    openingQuantity: 28,
    moves: [out(4, 'Bose residence - loft')],
  },
  {
    name: 'Acrylic sheet 1.5mm - High gloss',
    category: 'Boards',
    unit: 'sheet',
    minLevel: 8,
    openingQuantity: 10,
    moves: [out(10, 'Das residence - island shutters')],
  },
  // ── Hardware
  {
    name: 'Soft-close hinges',
    category: 'Hardware',
    unit: 'pcs',
    minLevel: 50,
    openingQuantity: 200,
    moves: [
      out(96, 'Rao residence'),
      out(40, 'Das residence'),
      ['ADJUST', 58, 'Recount after site returns'],
    ],
  },
  {
    name: 'Telescopic channel 18"',
    category: 'Hardware',
    unit: 'pcs',
    minLevel: 30,
    openingQuantity: 120,
    moves: [out(40, 'Rao residence - drawers'), inn(60, 'Received from supplier')],
  },
  {
    name: 'Telescopic channel 20"',
    category: 'Hardware',
    unit: 'pcs',
    minLevel: 30,
    openingQuantity: 80,
    moves: [out(52, 'Das residence - drawers')],
  },
  {
    name: 'Tandem box (soft-close)',
    category: 'Hardware',
    unit: 'set',
    minLevel: 10,
    openingQuantity: 24,
    moves: [out(8, 'Sen residence')],
  },
  {
    name: 'Profile handle 2.5 ft',
    category: 'Hardware',
    unit: 'pcs',
    minLevel: 40,
    openingQuantity: 150,
    moves: [out(64, 'Rao residence')],
  },
  {
    name: 'Wire basket - cutlery',
    category: 'Hardware',
    unit: 'set',
    minLevel: 5,
    openingQuantity: 9,
    moves: [out(6, 'Das residence')],
  },
  {
    name: 'Corner carousel unit',
    category: 'Hardware',
    unit: 'set',
    minLevel: 3,
    openingQuantity: 6,
    moves: [out(2, 'Bose residence')],
  },
  {
    name: 'Gas lift (hydraulic)',
    category: 'Hardware',
    unit: 'pcs',
    minLevel: 20,
    openingQuantity: 70,
    moves: [out(24, 'Rao residence - loft')],
  },
  // ── Fittings
  {
    name: 'Stainless steel sink, single bowl',
    category: 'Fittings',
    unit: 'pcs',
    minLevel: 3,
    openingQuantity: 10,
    moves: [out(4, 'Rao, Das, Sen and Bose residences')],
  },
  {
    name: 'Sink mixer tap',
    category: 'Fittings',
    unit: 'pcs',
    minLevel: 4,
    openingQuantity: 12,
    moves: [out(5, 'Rao, Das and Sen residences')],
  },
  {
    name: 'Hob, 4-burner glass top',
    category: 'Fittings',
    unit: 'pcs',
    minLevel: 2,
    openingQuantity: 5,
    moves: [out(3, 'Rao, Das and Sen residences')],
  },
  {
    name: 'Chimney 90cm auto-clean',
    category: 'Fittings',
    unit: 'pcs',
    minLevel: 2,
    openingQuantity: 4,
    moves: [out(4, 'Rao, Das, Sen and Bose residences')],
  },
  {
    name: 'Quartz countertop slab',
    category: 'Fittings',
    unit: 'pcs',
    minLevel: 2,
    openingQuantity: 8,
    moves: [out(3, 'Rao and Das residences')],
  },
  // ── Finishing
  {
    name: 'Edge-band tape - white',
    category: 'Finishing',
    unit: 'm',
    minLevel: 200,
    openingQuantity: 900,
    moves: [out(350, 'Rao residence')],
  },
  {
    name: 'Edge-band tape - walnut',
    category: 'Finishing',
    unit: 'm',
    minLevel: 200,
    openingQuantity: 500,
    moves: [out(330, 'Sen residence')],
  },
  {
    name: 'Fevicol SH adhesive',
    category: 'Finishing',
    unit: 'kg',
    minLevel: 5,
    openingQuantity: 25,
    moves: [out(9, 'Workshop'), inn(10, 'Received from supplier')],
  },
  {
    name: 'PU adhesive (cartridge)',
    category: 'Finishing',
    unit: 'pcs',
    minLevel: 12,
    openingQuantity: 30,
    moves: [out(10, 'Workshop')],
  },
  {
    name: 'Silicone sealant, clear',
    category: 'Finishing',
    unit: 'pcs',
    minLevel: 20,
    openingQuantity: 60,
    moves: [out(24, 'Site finishing')],
  },
  {
    name: 'Screws 1.5" (box of 1000)',
    category: 'Finishing',
    unit: 'box',
    minLevel: 6,
    openingQuantity: 18,
    moves: [out(5, 'Workshop')],
  },
  {
    name: 'Wall plugs and screws kit',
    category: 'Finishing',
    unit: 'box',
    minLevel: 6,
    openingQuantity: 14,
    moves: [out(4, 'Site installation'), ['ADJUST', 9, 'Recount']],
  },
  // ── Consumables
  {
    name: 'Masking tape',
    category: 'Consumables',
    unit: 'pcs',
    minLevel: 10,
    openingQuantity: 30,
    moves: [out(12, 'Site finishing')],
  },
  {
    name: 'Sandpaper sheets, 120 grit',
    category: 'Consumables',
    unit: 'pcs',
    minLevel: 40,
    openingQuantity: 120,
    moves: [out(70, 'Workshop')],
  },
  {
    name: 'Work gloves (pair)',
    category: 'Consumables',
    unit: 'pcs',
    minLevel: 20,
    openingQuantity: 36,
    moves: [out(20, 'Technicians')],
  },
];
