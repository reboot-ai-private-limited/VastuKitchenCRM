import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type { DashboardAttentionDto, DashboardCountersDto, DashboardDto, DashboardPersonDto } from '@vastu/contracts';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, radius, space, tone } from '@/constants/theme';
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

const ROW_H = 60;
const HEAD_H = 40;
const NAME_W = 124;
const COLS: { key: string; label: string; w: number; right?: boolean }[] = [
  { key: 'in', label: 'In', w: 82 },
  { key: 'out', label: 'Out', w: 82 },
  { key: 'att', label: 'Attendance', w: 104 },
  { key: 'calls', label: 'Calls', w: 76, right: true },
  { key: 'leads', label: 'Leads', w: 64, right: true },
  { key: 'meets', label: 'Meets', w: 64, right: true },
  { key: 'props', label: 'Proposals', w: 92, right: true },
  { key: 'target', label: 'Target', w: 168 },
];
const TABLE_W = COLS.reduce((n, c) => n + c.w, 0);

function TargetCell({ target }: { target: DashboardPersonDto['target'] }) {
  if (!target || target.amount === 0) {
    return (
      <Text variant="caption" muted numberOfLines={1}>
        {target ? `${formatINRShort(target.achieved)} won · ` : ''}No target
      </Text>
    );
  }
  const pct = Math.round((target.achieved / target.amount) * 100);
  return (
    <View style={{ gap: 4 }}>
      <Text variant="caption" style={{ fontVariant: ['tabular-nums'] }} numberOfLines={1}>
        {formatINRShort(target.achieved)} / {formatINRShort(target.amount)}
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
 * The team as a table, like the website: the employee column stays put on the left while the other
 * columns (In, Out, Attendance, Calls, Leads, Meets, Proposals, Target) scroll sideways.
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
  const rows = [...people].sort((a, b) => a.name.localeCompare(b.name));
  if (rows.length === 0) {
    return (
      <Card>
        <Text muted>No one on attendance yet.</Text>
      </Card>
    );
  }
  const clock = (iso: string | null | undefined) => (iso ? formatTime(iso) : '—');
  const cells = (p: DashboardPersonDto): ReactNode[] => {
    const a = p.attendance;
    const status = !a
      ? 'Not tracked'
      : days > 1
        ? `${a.daysPresent}/${days}`
        : a.daysPresent > 0
          ? 'Present'
          : offDay
            ? 'Off'
            : 'Absent';
    const present = !!a && a.daysPresent > 0;
    const act = p.activity;
    return [
      <Text key="in" style={styles.num}>{clock(a?.inAt)}</Text>,
      <Text key="out" style={styles.num}>{clock(a?.outAt)}</Text>,
      <Text key="att" variant="label" color={present ? tone.success.fg : colors.mutedForeground}>{status}</Text>,
      <Text key="calls" style={styles.num}>
        {act ? `${act.calls}${act.calls > 0 ? ` (${act.answeredCalls})` : ''}` : '—'}
      </Text>,
      <Text key="leads" style={styles.num}>{act ? act.leadsHandled : '—'}</Text>,
      <Text key="meets" style={styles.num}>{act ? dummyMeets(p.userId, days) : '—'}</Text>,
      <Text key="props" style={styles.num}>{act ? act.proposalsGenerated : '—'}</Text>,
      <TargetCell key="target" target={p.target} />,
    ];
  };

  return (
    <View style={{ flexDirection: 'row' }}>
      {/* Fixed column: employee */}
      <View style={{ width: NAME_W, flexShrink: 0 }}>
        <View style={[styles.headCell, { height: HEAD_H, width: NAME_W }]}>
          <Text variant="caption" muted>
            Employee
          </Text>
        </View>
        {rows.map((p) => (
          <View key={p.userId} style={[styles.rowLine, { height: ROW_H, width: NAME_W, gap: space[2] }]}>
            <Text variant="label" numberOfLines={1} style={{ flex: 1 }}>
              {p.name}
            </Text>
          </View>
        ))}
      </View>

      {/* Scrolling columns */}
      <ScrollView horizontal style={{ flex: 1 }} contentOffset={{ x: 0, y: 0 }} showsHorizontalScrollIndicator nestedScrollEnabled bounces={false}>
        <View style={{ width: TABLE_W }}>
          <View style={[styles.headRow, { height: HEAD_H }]}>
            {COLS.map((c) => (
              <View key={c.key} style={[styles.headCell, { width: c.w }, c.right && { alignItems: 'flex-end' }]}>
                <Text variant="caption" muted>
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
      </ScrollView>
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
  headCell: { justifyContent: 'center', paddingHorizontal: space[3], backgroundColor: colors.muted },
  rowLine: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[2],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  cell: { justifyContent: 'center', paddingHorizontal: space[1] },
  num: { fontVariant: ['tabular-nums'] },
  track: { height: 6, borderRadius: radius.full, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.full },
  cRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  cCell: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: space[3] },
  cEmpty: { flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[4] },
  cItem: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tone.danger.fg },
});
