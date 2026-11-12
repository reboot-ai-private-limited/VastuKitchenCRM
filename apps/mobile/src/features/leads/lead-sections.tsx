import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, space } from '@/constants/theme';
import { formatDate, formatINR, formatTime, timeAgo } from '@/lib/format';
import { PendingSyncBadge } from '@/offline';
import { describeActivity, formatDuration, OUTCOME_LABEL } from './lead-meta';
import { useLeadCalls, useLeadProposals, useLeadTimeline, usePendingForLead } from './use-leads';

function SectionHead({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <Text variant="section" style={{ flex: 1 }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

function Failed({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <View style={{ gap: space[2], alignItems: 'flex-start' }}>
      <Text muted>Could not load {what}.</Text>
      <Button title="Retry" size="sm" variant="outline" onPress={onRetry} />
    </View>
  );
}

export function CallsSection({ leadId, onLog }: { leadId: string; onLog?: () => void }) {
  const q = useLeadCalls(leadId);
  const pending = usePendingForLead(leadId, 'call.record');
  return (
    <View style={{ gap: space[3] }}>
      <SectionHead
        title="Calls"
        action={onLog ? <Button title="Log a call" size="sm" variant="outline" onPress={onLog} /> : null}
      />
      {pending.length > 0 ? (
        <Card style={{ gap: space[2] }}>
          {pending.map((p) => (
            <View key={p.id} style={{ gap: 2 }}>
              <Text variant="caption" muted>
                You · {timeAgo(new Date(p.capturedAt).toISOString())}
              </Text>
              <PendingSyncBadge filter={(i) => i.id === p.id} />
            </View>
          ))}
        </Card>
      ) : null}
      {q.isPending ? (
        <Text muted>Loading calls...</Text>
      ) : q.isError ? (
        <Failed what="calls" onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        pending.length > 0 ? null : <Text muted>No calls logged yet.</Text>
      ) : (
        <Card style={{ gap: space[3] }}>
          {q.data.map((c) => (
            <View key={c.id} style={{ gap: 2 }}>
              <Text variant="label">
                {c.answered ? `Answered (${formatDuration(c.durationSec)})` : 'Not answered'}
                {c.outcome ? ` · ${OUTCOME_LABEL[c.outcome] ?? c.outcome}` : ''}
              </Text>
              <Text variant="caption" muted>
                {c.user.name} · {formatDate(c.startedAt)} {formatTime(c.startedAt)}
              </Text>
              {c.note ? <Text>{c.note}</Text> : null}
            </View>
          ))}
        </Card>
      )}
    </View>
  );
}

export function ProposalsSection({ leadId, canCreate }: { leadId: string; canCreate: boolean }) {
  const router = useRouter();
  const q = useLeadProposals(leadId);
  return (
    <View style={{ gap: space[3] }}>
      <SectionHead
        title="Proposals"
        action={
          canCreate ? (
            <Button
              title="New proposal"
              size="sm"
              onPress={() => router.push(`/proposals/new?leadId=${encodeURIComponent(leadId)}` as Href)}
            />
          ) : null
        }
      />
      {q.isPending ? (
        <Text muted>Loading proposals...</Text>
      ) : q.isError ? (
        <Failed what="proposals" onRetry={() => void q.refetch()} />
      ) : q.data.items.length === 0 ? (
        <Text muted>No proposals yet.</Text>
      ) : (
        <View style={{ gap: space[2] }}>
          {q.data.items.map((p) => (
            <PressableScale
              key={p.id}
              onPress={() => router.push({ pathname: '/proposals/[id]', params: { id: p.id } } as Href)}
            >
              <Card style={{ gap: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
                  <Text variant="label" style={{ flex: 1 }} numberOfLines={1}>
                    {p.number} · {p.title}
                  </Text>
                  <Badge label={p.status === 'SENT' ? 'Sent' : 'Draft'} t={p.status === 'SENT' ? 'success' : 'neutral'} />
                </View>
                <Text variant="caption" muted>
                  {formatINR(p.total)}
                  {p.sentAt ? ` · sent ${timeAgo(p.sentAt)}` : ''}
                </Text>
              </Card>
            </PressableScale>
          ))}
        </View>
      )}
    </View>
  );
}

export function TimelineSection({ leadId }: { leadId: string }) {
  const q = useLeadTimeline(leadId);
  return (
    <View style={{ gap: space[3] }}>
      <SectionHead title="Timeline" />
      {q.isPending ? (
        <Text muted>Loading timeline...</Text>
      ) : q.isError ? (
        <Failed what="the timeline" onRetry={() => void q.refetch()} />
      ) : q.data.length === 0 ? (
        <Text muted>Nothing has happened on this lead yet.</Text>
      ) : (
        <Card style={{ gap: space[3] }}>
          {q.data.map((a) => {
            const { title, detail } = describeActivity(a);
            return (
              <View
                key={a.id}
                style={{ gap: 2, borderLeftWidth: 2, borderLeftColor: colors.border, paddingLeft: space[3] }}
              >
                <Text variant="label">{title}</Text>
                {detail ? (
                  <Text variant="caption" muted>
                    {detail}
                  </Text>
                ) : null}
                <Text variant="caption" muted>
                  {formatDate(a.at)} {formatTime(a.at)}
                </Text>
              </View>
            );
          })}
        </Card>
      )}
    </View>
  );
}
