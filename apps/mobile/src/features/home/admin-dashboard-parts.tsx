import { StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, type Href } from 'expo-router';
import type { DashboardAttentionDto, DashboardCountersDto, DashboardDto, DashboardPersonDto } from '@vastu/contracts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
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

function TargetBar({ target }: { target: DashboardPersonDto['target'] }) {
  if (!target || target.amount === 0) {
    return (
      <Text variant="caption" muted>
        {target ? `${formatINRShort(target.achieved)} won · ` : ''}No target
      </Text>
    );
  }
  const pct = Math.round((target.achieved / target.amount) * 100);
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.targetTop}>
        <Text variant="caption" muted>
          Target
        </Text>
        <Text variant="caption" style={{ fontVariant: ['tabular-nums'] }}>
          {formatINRShort(target.achieved)} / {formatINRShort(target.amount)}
        </Text>
      </View>
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

/** One row per person: attendance and in/out times, then calls, leads, meets, proposals and the rupee target. */
export function TeamCard({
  people,
  days,
  offDay,
}: {
  people: DashboardPersonDto[];
  days: number;
  offDay: boolean;
}) {
  const router = useRouter();
  const rows = [...people].sort((a, b) => a.name.localeCompare(b.name));
  if (rows.length === 0) {
    return (
      <Card>
        <Text muted>No one on attendance yet.</Text>
      </Card>
    );
  }
  return (
    <Card style={{ padding: 0, overflow: 'hidden' }}>
      {rows.map((p, idx) => {
        const a = p.attendance;
        const status = !a
          ? 'Not tracked'
          : days > 1
            ? `${a.daysPresent}/${days} days`
            : a.daysPresent > 0
              ? 'Present'
              : offDay
                ? 'Off'
                : 'Absent';
        const present = !!a && a.daysPresent > 0;
        return (
          <PressableScale
            key={p.userId}
            onPress={() => router.push('/attendance/board' as Href)}
            style={[styles.person, idx > 0 && styles.personDivider]}
          >
            <View style={styles.personHead}>
              <Avatar name={p.name} size={36} accent />
              <View style={{ flex: 1, gap: 1 }}>
                <Text variant="label" numberOfLines={1}>
                  {p.name}
                </Text>
                {p.designation ? (
                  <Text variant="caption" muted numberOfLines={1}>
                    {p.designation}
                  </Text>
                ) : null}
              </View>
              <Badge label={status} t={present ? 'success' : 'neutral'} />
            </View>
            {days === 1 && a ? (
              <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
                In {a.inAt ? formatTime(a.inAt) : '—'} · Out {a.outAt ? formatTime(a.outAt) : '—'}
              </Text>
            ) : null}
            {p.activity ? (
              <>
                <View style={styles.stats}>
                  <Stat label="Calls" value={`${p.activity.calls}${p.activity.calls > 0 ? ` (${p.activity.answeredCalls})` : ''}`} />
                  <Stat label="Leads" value={p.activity.leadsHandled} />
                  <Stat label="Meets" value={dummyMeets(p.userId, days)} />
                  <Stat label="Proposals" value={p.activity.proposalsGenerated} />
                </View>
                <TargetBar target={p.target} />
              </>
            ) : null}
          </PressableScale>
        );
      })}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={{ flex: 1, gap: 1 }}>
      <Text variant="label" style={{ fontVariant: ['tabular-nums'] }}>
        {value}
      </Text>
      <Text variant="caption" muted numberOfLines={1}>
        {label}
      </Text>
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
  person: { gap: space[2], padding: space[4] },
  personDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  personHead: { flexDirection: 'row', alignItems: 'center', gap: space[3] },
  stats: { flexDirection: 'row', gap: space[2] },
  targetTop: { flexDirection: 'row', justifyContent: 'space-between' },
  track: { height: 6, borderRadius: radius.full, backgroundColor: colors.muted, overflow: 'hidden' },
  fill: { height: 6, borderRadius: radius.full },
  cRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  cCell: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: space[3] },
  cEmpty: { flexDirection: 'row', alignItems: 'center', gap: space[2], padding: space[4] },
  cItem: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: tone.danger.fg },
});
