import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, hit, radius, space } from '@/constants/theme';
import { formatDate, formatINR } from '@/lib/format';

export type PreviewData = {
  number?: string | null;
  title: string;
  customerName?: string | null;
  customerPhone?: string | null;
  city?: string | null;
  siteAddress?: string | null;
  items: Array<{ title: string; description?: string | null; quantity: number; unitPrice: number }>;
  discount: number;
  notes?: string | null;
  terms?: string | null;
  validUntil?: string | Date | null;
};

type Props = { visible: boolean; onClose: () => void; data: PreviewData };

/**
 * "What the customer will get": the proposal laid out like a document, built from the proposal (or from
 * the draft still being typed, so it works before anything is saved or sent).
 */
export function ProposalPreview(props: Props) {
  // A Modal is its own window, so it needs its own safe-area provider for real insets.
  return (
    <Modal visible={props.visible} animationType="slide" onRequestClose={props.onClose} statusBarTranslucent navigationBarTranslucent>
      <SafeAreaProvider>
        <Body {...props} />
      </SafeAreaProvider>
    </Modal>
  );
}

const money = (n: number) => formatINR(Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);

function Body({ onClose, data }: Props) {
  const insets = useSafeAreaInsets();
  const lines = data.items.map((i) => {
    const q = Number.isFinite(i.quantity) ? i.quantity : 0;
    const p = Number.isFinite(i.unitPrice) ? i.unitPrice : 0;
    return { ...i, quantity: q, unitPrice: p, lineTotal: Math.round(q * p) };
  });
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const discount = Number.isFinite(data.discount) ? data.discount : 0;
  const total = Math.max(0, subtotal - discount);
  const valid = data.validUntil ? formatDate(typeof data.validUntil === 'string' ? data.validUntil : data.validUntil.toISOString()) : null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.bar}>
        <Text variant="section" style={{ flex: 1 }}>
          Preview
        </Text>
        <PressableScale onPress={onClose} accessibilityLabel="Close preview" style={styles.close}>
          <Feather name="x" size={22} color={colors.mutedForeground} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={{ padding: space[4], paddingBottom: insets.bottom + space[8] }}>
        <View style={styles.paper}>
          <View style={styles.brandRow}>
            <Text variant="section" color={colors.primary}>
              Vastu Kitchen
            </Text>
            <Text variant="caption" muted>
              PROPOSAL{data.number ? ` · ${data.number}` : ''}
            </Text>
          </View>

          <Text variant="title">{data.title || 'Untitled proposal'}</Text>

          {data.customerName || data.siteAddress ? (
            <View style={styles.block}>
              <Text variant="caption" muted>
                PREPARED FOR
              </Text>
              {data.customerName ? <Text variant="label">{data.customerName}</Text> : null}
              {data.customerPhone || data.city ? (
                <Text variant="caption" muted>
                  {[data.customerPhone, data.city].filter(Boolean).join('  ·  ')}
                </Text>
              ) : null}
              {data.siteAddress ? <Text style={{ fontSize: 14 }}>{data.siteAddress}</Text> : null}
            </View>
          ) : null}

          {valid ? (
            <Text variant="caption" muted>
              Valid till {valid}
            </Text>
          ) : null}

          <View style={styles.block}>
            <Text variant="caption" muted>
              SCOPE AND PRICING
            </Text>
            {lines.length === 0 ? <Text muted>No items yet.</Text> : null}
            {lines.map((l, i) => (
              <View key={i} style={styles.line}>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text variant="label">{l.title || `Item ${i + 1}`}</Text>
                  {l.description ? (
                    <Text variant="caption" muted>
                      {l.description}
                    </Text>
                  ) : null}
                  <Text variant="caption" muted>
                    {l.quantity} × {money(l.unitPrice)}
                  </Text>
                </View>
                <Text variant="label" style={styles.amount}>
                  {money(l.lineTotal)}
                </Text>
              </View>
            ))}
          </View>

          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text muted>Subtotal</Text>
              <Text style={styles.amount}>{money(subtotal)}</Text>
            </View>
            {discount > 0 ? (
              <View style={styles.totalRow}>
                <Text muted>Discount</Text>
                <Text style={styles.amount}>− {money(discount)}</Text>
              </View>
            ) : null}
            <View style={styles.totalRow}>
              <Text variant="section">Total</Text>
              <Text variant="section" color={colors.primary} style={styles.amount}>
                {money(total)}
              </Text>
            </View>
          </View>

          {data.notes ? (
            <View style={styles.block}>
              <Text variant="caption" muted>
                NOTES
              </Text>
              <Text style={{ fontSize: 14 }}>{data.notes}</Text>
            </View>
          ) : null}
          {data.terms ? (
            <View style={styles.block}>
              <Text variant="caption" muted>
                TERMS
              </Text>
              <Text variant="caption" muted>
                {data.terms}
              </Text>
            </View>
          ) : null}
        </View>
        <Text variant="caption" muted style={{ textAlign: 'center', marginTop: space[3] }}>
          A summary of what the customer will receive. The sent proposal uses the full template design.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.muted },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  close: { width: hit, height: hit, alignItems: 'center', justifyContent: 'center', marginRight: -space[2] },
  paper: {
    gap: space[3],
    padding: space[4],
    borderRadius: radius.xl,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  block: {
    gap: space[1],
    paddingTop: space[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  line: { flexDirection: 'row', gap: space[3], paddingVertical: space[2] },
  amount: { fontVariant: ['tabular-nums'], textAlign: 'right' },
  totals: {
    gap: space[1],
    paddingTop: space[3],
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  totalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
