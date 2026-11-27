import { useRef, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Animated, {
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useRouter, type Href } from 'expo-router';
import type { DashboardAttentionDto, DashboardCountersDto, DashboardDto, DashboardPersonDto } from '@vastu/contracts';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space, tone } from '@/constants/theme';
import { routeFor } from '@/features/alerts/route-for';
import { formatINRShort, formatTime, timeAgo } from '@/lib/format';

/**
 * PLACEHOLDER DATA, same as the website dashboard: there is no meetings model yet, so these are stable
 * made-up numbers (derived from the user id so they don't jump on refresh). Replace with real API fields.
 */
const hash = (s: string): number => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};
const dummyMeets = (userId: string, days: number): number =>
  (hash(`m${userId}`) % 3) + Math.max(0, Math.round(days * 0.6));
const DUMMY_MEETINGS_TODAY = { total: 4, done: 2 };

type Staff = NonNullable<DashboardDto['staff']>;

function Kpi({
  label,
  value,
  sub,
  onPress,
}: {
  label: string;
  value: string | number;
  sub?: string;
  onPress?: () => void;
}) {
  return (
    <PressableScale style={styles.kpiWrap} disabled={!onPress} onPress={onPress}>
      <Card style={styles.kpi}>
        <Text variant="caption" muted numberOfLines={1}>
          {label}
        </Text>
        <Text variant="counter" style={{ fontVariant: ['tabular-nums'] }}>
          {value}
        </Text>
        {sub ? (
          <Text variant="caption" muted numberOfLines={1} style={{ fontVariant: ['tabular-nums'] }}>
            {sub}
          </Text>
        ) : null}
      </Card>
    </PressableScale>
  );
}

/** The four headline tiles, in the same order as the website: new leads, meetings, follow-ups, staff present. */
export function KpiRow({ counters, staff }: { counters: DashboardCountersDto; staff: Staff | null }) {
  const router = useRouter();
  const upcoming = DUMMY_MEETINGS_TODAY.total - DUMMY_MEETINGS_TODAY.done;
  return (
    <View style={styles.kpiGrid}>
      <Kpi label="New leads" value={counters.leads.newInRange} sub="In this period" onPress={() => router.push('/leads' as Href)} />
      <Kpi
        label="Today's meetings"
        value={DUMMY_MEETINGS_TODAY.total}
        sub={`${DUMMY_MEETINGS_TODAY.done} done · ${upcoming} upcoming`}
      />
      <Kpi
        label="Pending follow-ups"
        value={counters.leads.byStatus.FOLLOW_UP ?? 0}
        sub="Leads in follow-up"
        onPress={() => router.push('/leads' as Href)}
      />
      <Kpi
        label="Staff present today"
        value={staff ? `${staff.present} / ${staff.tracked}` : '—'}
        {...(staff ? { sub: staff.offDay ? 'Weekly off today' : `${staff.absent} absent` } : {})}
        onPress={() => router.push('/attendance/board' as Href)}
      />
    </View>
  );
}

const ROW_H = 58;
const HEAD_H = 38;
const NAME_W = 118;
const STATUS_W = 84;
const FROZEN_W = NAME_W + STATUS_W;
const COLS: { key: string; label: string; w: number; right?: boolean }[] = [
  { key: 'in', label: 'Check-in', w: 76, right: true },
  { key: 'out', label: 'Check-out', w: 76, right: true },
  { key: 'calls', label: 'Calls', w: 72, right: true },
  { key: 'leads', label: 'Leads', w: 58, right: true },
  { key: 'meets', label: 'Meets', w: 58, right: true },
  { key: 'props', label: 'Proposals', w: 84, right: true },
  { key: 'target', label: 'Target (₹)', w: 164 },
];
const TABLE_W = COLS.reduce((n, c) => n + c.w, 0);

/** A value that isn't there: a muted dash, so it recedes next to real figures. */
function Missing() {
  return (
    <Text muted style={styles.num} accessibilityLabel="Not available">
      —
    </Text>
  );
}

/** The column header carries the ₹, so the figures under it leave it out. */
const rupees = (n: number) => formatINRShort(n).replace('₹', '');

function TargetCell({ target }: { target: DashboardPersonDto['target'] }) {
  if (!target) return <Missing />;
  if (target.amount === 0) {
    return (
      <Text variant="caption" muted numberOfLines={1} style={{ fontSize: 11 }}>
        {rupees(target.achieved)} won · No target
      </Text>
    );
  }
  const pct = Math.round((target.achieved / target.amount) * 100);
  return (
    <View style={{ gap: 4 }}>
      <Text variant="caption" style={{ fontVariant: ['tabular-nums'], fontSize: 11 }} numberOfLines={1}>
        {rupees(target.achieved)} / {rupees(target.amount)}
      </Text>
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { width: `${Math.min(100, pct)}%`, backgroundColor: pct >= 100 ? tone.success.fg : colors.primary },
          ]}
        />
      </View>
    </View>
  );
}

/**
 * The team as a table, like the website: the employee and status columns stay put on the left while the
 * others (Check-in, Check-out, Calls, Leads, Meets, Proposals, Target) scroll sideways.
 */
export function TeamCard({
  people,
  days,
  offDay,
}: {
  people: DashboardPersonDto[];
  days: number;
  offDay: boolean;
}) {
  const scrollRef = useRef<Animated.ScrollView>(null);
  const scrollX = useSharedValue(0);
  const viewW = useSharedValue(0);
  const [canScroll, setCanScroll] = useState(false);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
    },
  });

  const thumbStyle = useAnimatedStyle(() => {
    const vw = viewW.value;
    if (vw <= 0 || TABLE_W <= vw + 1) {
      return { width: 0, opacity: 0, transform: [{ translateX: 0 }] };
    }
    const maxScroll = TABLE_W - vw;
    const tw = Math.max(28, (vw / TABLE_W) * vw);
    const clamped = Math.max(0, Math.min(scrollX.value, maxScroll));
    const tx = (clamped / maxScroll) * (vw - tw);
    return {
      width: tw,
      opacity: 1,
      transform: [{ translateX: tx }],
    };
  });

  const headMoreStyle = useAnimatedStyle(() => {
    const vw = viewW.value;
    const visible = vw > 0 && scrollX.value + vw < TABLE_W - 2;
    return { opacity: visible ? 1 : 0 };
  });

  const rows = [...people].sort((a, b) => a.name.localeCompare(b.name));
  if (rows.length === 0) {
    return (
      <Card>
        <Text muted>No one on attendance yet.</Text>
      </Card>
    );
  }
  const num = (key: string, value: ReactNode) =>
    value == null ? (
      <Missing key={key} />
    ) : (
      <Text key={key} style={styles.num}>
        {value}
      </Text>
    );
  const clock = (iso: string | null | undefined) => (iso ? formatTime(iso) : null);
  const statusFor = (p: DashboardPersonDto) => {
    const a = p.attendance;
    if (!a) return { label: '—', dot: null as string | null, text: colors.mutedForeground, strong: false };
    if (days > 1) {
      return {
        label: `${a.daysPresent}/${days}`,
        dot: a.daysPresent > 0 ? tone.success.fg : colors.input,
        text: a.daysPresent > 0 ? colors.foreground : colors.mutedForeground,
        strong: false,
      };
    }
    if (a.daysPresent > 0) {
      return { label: 'Present', dot: tone.success.fg, text: colors.foreground, strong: false };
    }
    if (offDay) {
      return { label: 'Off', dot: colors.input, text: colors.mutedForeground, strong: false };
    }
    return { label: 'Absent', dot: tone.danger.fg, text: tone.danger.fg, strong: true };
  };
  const cells = (p: DashboardPersonDto): ReactNode[] => {
    const a = p.attendance;
    const act = p.activity;
    return [
      num('in', clock(a?.inAt)),
      num('out', clock(a?.outAt)),
      num('calls', act ? `${act.calls}${act.calls > 0 ? ` (${act.answeredCalls})` : ''}` : null),
      num('leads', act?.leadsHandled),
      num('meets', act ? dummyMeets(p.userId, days) : null),
      num('props', act?.proposalsGenerated),
      <TargetCell key="target" target={p.target} />,
    ];
  };

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* Fixed columns: Employee | Status */}
      <View style={[styles.frozenCol, { width: FROZEN_W }]}>
        <View style={[styles.headRow, { height: HEAD_H }]}>
          <View style={[styles.headCell, { width: NAME_W }]}>
            <Text variant="caption" muted style={{ fontSize: 11 }}>
              Employee
            </Text>
          </View>
          <View style={[styles.headCell, { width: STATUS_W }]}>
            <Text variant="caption" muted style={{ fontSize: 11 }}>
              Status
            </Text>
          </View>
        </View>
        {rows.map((p) => {
          const st = statusFor(p);
          return (
            <View key={p.userId} style={[styles.rowLine, { height: ROW_H, width: FROZEN_W, paddingHorizontal: 0 }]}>
              <View style={{ width: NAME_W, paddingHorizontal: space[2] }}>
                <Text variant="label" numberOfLines={1} style={{ fontSize: 13 }}>
                  {p.name}
                </Text>
                {p.designation ? (
                  <Text variant="caption" muted numberOfLines={1} style={{ fontSize: 11 }}>
                    {p.designation}
                  </Text>
                ) : null}
              </View>
              <View style={styles.statusCell}>
                {st.dot ? <View style={[styles.statusDot, { backgroundColor: st.dot }]} /> : null}
                <Text
                  variant="caption"
                  color={st.text}
                  numberOfLines={1}
                  style={[
                    { fontSize: 12, fontVariant: ['tabular-nums'] },
                    st.strong && { fontFamily: font.semibold },
                  ]}
                >
                  {st.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {/* Scrolling columns */}
      <View style={{ flex: 1 }}>
        <Animated.ScrollView
          ref={scrollRef}
          horizontal
          contentOffset={{ x: 0, y: 0 }}
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          bounces={false}
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            viewW.value = w;
            setCanScroll(w > 0 && TABLE_W > w + 1);
          }}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          <View style={{ width: TABLE_W }}>
            <View style={[styles.headRow, { height: HEAD_H }]}>
              {COLS.map((c) => (
                <View key={c.key} style={[styles.headCell, { width: c.w }, c.right && { alignItems: 'flex-end' }]}>
                  <Text variant="caption" muted style={{ fontSize: 11 }}>
                    {c.label}
                  </Text>
                </View>
              ))}
            </View>
            {rows.map((p) => {
              const row = cells(p);
              return (
                <View key={p.userId} style={[styles.rowLine, { height: ROW_H }]}>
                  {COLS.map((c, i) => (
                    <View key={c.key} style={[styles.cell, { width: c.w }, c.right && { alignItems: 'flex-end' }]}>
                      {row[i]}
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        </Animated.ScrollView>
        {canScroll ? (
          <>
            <View pointerEvents="none" style={styles.scrollTrack}>
              <Animated.View style={[styles.scrollThumb, thumbStyle]} />
            </View>
            <Animated.View style={[styles.headMore, headMoreStyle]}>
              <Pressable
                onPress={() =>
                  scrollRef.current?.scrollTo({
                    x: scrollX.value + viewW.value / 2,
                    animated: true,
                  })
                }
                accessibilityRole="button"
                accessibilityLabel="Show more columns"
                hitSlop={12}
                style={styles.headMoreBtn}
              >
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            </Animated.View>
          </>
        ) : null}
      </View>
    </View>
  );
}

/** Open / Assigned / To close counts, then the complaints waiting too long. */
export function ComplaintsCard({
  counts,
  overdue,
}: {
  counts: DashboardCountersDto['complaints'];
  overdue: DashboardAttentionDto['overdueComplaints'];
}) {
  const router = useRouter();
  const cell = (label: string, value: number) => (
    <PressableScale style={styles.cCell} onPress={() => router.push('/complaints' as Href)}>
      <Text variant="counter" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text variant="caption" muted>
        {label}
      </Text>
    </PressableScale>
  );
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      <View style={styles.cRow}>
        {cell('Open', counts.OPEN)}
        {cell('Assigned', counts.ASSIGNED)}
        {cell('To close', counts.RESOLVED)}
      </View>
      {overdue.total === 0 ? (
        <View style={styles.cEmpty}>
          <Feather name="check-circle" size={16} color={tone.success.fg} />
          <Text muted>Nothing waiting too long</Text>
        </View>
      ) : (
        overdue.items.slice(0, 5).map((item, i) => {
          const href = routeFor(item.ref, 'ADMIN');
          return (
            <PressableScale
              key={`${item.ref.id}-${i}`}
              disabled={!href}
              onPress={() => href && router.push(href)}
              style={styles.cItem}
            >
              <View style={styles.dot} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="label" numberOfLines={1}>
                  {item.title}
                </Text>
                <Text variant="caption" muted numberOfLines={1}>
                  {item.detail}
                </Text>
              </View>
              <Text variant="caption" muted>
                {timeAgo(item.since)}
              </Text>
            </PressableScale>
          );
        })
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  kpiWrap: { width: '48%', flexGrow: 1 },
  kpi: { gap: 4, padding: space[4] },
  headRow: { flexDirection: 'row', backgroundColor: colors.muted },
  headCell: { justifyContent: 'center', paddingHorizontal: space[2], backgroundColor: colors.muted },
  frozenCol: {
    flexShrink: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.border,
  },
  statusCell: {
    width: STATUS_W,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space[2],
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  headMore: {
    position: 'absolute',
    top: 0,
    right: -1,
    width: 29,
    height: HEAD_H,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.muted,
  },
  headMoreBtn: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollTrack: {
    position: 'absolute',
    top: HEAD_H - 2,
    left: 0,
    right: 0,
    height: 2.5,
    backgroundColor: colors.border,
  },
  scrollThumb: {
    height: 2.5,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
  },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cell: { justifyContent: 'center', paddingHorizontal: space[2] },
  num: { fontVariant: ['tabular-nums'], fontSize: 12 },
  track: { height: 6, borderRadius: radius.full, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.full },
  cRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  cCell: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: space[3] },
  cEmpty: { flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[4] },
  cItem: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tone.danger.fg },
});
