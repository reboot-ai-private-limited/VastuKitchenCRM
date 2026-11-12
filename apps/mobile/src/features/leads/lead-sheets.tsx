import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import {
  changeLeadStatusBodySchema,
  updateLeadBodySchema,
  type LeadDto,
  type LeadStatus,
  type UpdateLeadBodyDto,
} from '@vastu/contracts';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { STATUS_LABEL } from './lead-meta';
import { useAssignLead, useChangeLeadStatus, useSalesUsers, useUpdateLead } from './use-leads';

const errMsg = (e: unknown, fallback: string) => (e instanceof Error ? e.message : fallback);

/** Move a lead to a status, with an optional note (LOST needs a reason). Queued offline. */
export function StatusSheet({
  leadId,
  target,
  onClose,
}: {
  leadId: string;
  target: LeadStatus | null;
  onClose: () => void;
}) {
  const change = useChangeLeadStatus(leadId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  // Reset the form each time the sheet opens for a (new) target.
  const [prevTarget, setPrevTarget] = useState(target);
  if (prevTarget !== target) {
    setPrevTarget(target);
    setText('');
    setError(null);
  }
  const lost = target === 'LOST';

  const submit = () => {
    if (!target) return;
    const t = text.trim() || undefined;
    const parsed = changeLeadStatusBodySchema.safeParse(
      lost ? { status: target, lostReason: t } : { status: target, note: t },
    );
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? 'Check the details');
    setError(null);
    change.mutate(parsed.data, { onSuccess: onClose, onError: (e) => setError(errMsg(e, 'Could not save')) });
  };

  return (
    <BottomSheet
      visible={target !== null}
      onClose={onClose}
      title={lost ? 'Mark lead as lost' : `Move to ${target ? STATUS_LABEL[target] : ''}`}
      subtitle={lost ? 'Briefly record why this lead did not go ahead' : 'Add a note for the timeline (optional)'}
      footer={
        <Button
          title={lost ? 'Mark as lost' : 'Save'}
          variant={lost ? 'destructive' : 'default'}
          size="lg"
          loading={change.isPending}
          onPress={submit}
          fullWidth
        />
      }
    >
      <View style={{ gap: space[2] }}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={lost ? 'e.g. Budget mismatch, went with carpenter' : 'Note (optional)'}
          placeholderTextColor={colors.placeholder}
          multiline
          maxLength={lost ? 500 : 1000}
          style={[styles.input, { minHeight: 88, textAlignVertical: 'top' }]}
        />
        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

/** ADMIN: pick a salesperson (or unassign). Online only: the server decides who is eligible. */
export function AssignSheet({ lead, visible, onClose }: { lead: LeadDto; visible: boolean; onClose: () => void }) {
  const users = useSalesUsers(visible);
  const assign = useAssignLead(lead.id);
  const [error, setError] = useState<string | null>(null);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    setError(null);
  }
  const pick = (userId: string | null) =>
    assign.mutate(userId, { onSuccess: onClose, onError: (e) => setError(errMsg(e, 'Could not assign')) });

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Assign lead" subtitle="Choose a salesperson">
      <View style={{ gap: space[2] }}>
        {users.isPending ? <Text muted>Loading...</Text> : null}
        {users.isError ? (
          <Button title="Could not load staff. Retry" variant="outline" onPress={() => void users.refetch()} />
        ) : null}
        {users.data?.items.map((u) => {
          const active = lead.assignedTo?.id === u.id;
          return (
            <PressableScale
              key={u.id}
              disabled={assign.isPending}
              onPress={() => pick(u.id)}
              style={[styles.opt, active && { backgroundColor: colors.primary }]}
            >
              <Text color={active ? colors.primaryForeground : colors.foreground}>{u.name}</Text>
            </PressableScale>
          );
        })}
        {lead.assignedTo ? (
          <Button title="Unassign" variant="outline" loading={assign.isPending} onPress={() => pick(null)} />
        ) : null}
        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

/** Edit contact details. Only changed fields are sent; an emptied optional field is cleared. Online only. */
export function EditLeadSheet({ lead, visible, onClose }: { lead: LeadDto; visible: boolean; onClose: () => void }) {
  const update = useUpdateLead(lead.id);
  const [f, setF] = useState({ name: '', phone: '', altPhone: '', email: '', city: '', notes: '' });
  const [error, setError] = useState<string | null>(null);
  const [prevVisible, setPrevVisible] = useState(false);
  if (prevVisible !== visible) {
    setPrevVisible(visible);
    if (visible) {
      setError(null);
      setF({
        name: lead.name,
        phone: lead.phone,
        altPhone: lead.altPhone ?? '',
        email: lead.email ?? '',
        city: lead.city ?? '',
        notes: lead.notes ?? '',
      });
    }
  }

  const submit = () => {
    const body: Record<string, string | null> = {};
    const name = f.name.trim();
    const phone = f.phone.replace(/\D/g, '').slice(-10);
    if (name !== lead.name) body.name = name;
    if (phone !== lead.phone) body.phone = phone;
    (['altPhone', 'email', 'city', 'notes'] as const).forEach((k) => {
      const v = (k === 'altPhone' ? f[k].replace(/\D/g, '').slice(-10) : f[k].trim()) || null;
      if (v !== (lead[k] ?? null)) body[k] = v;
    });
    const parsed = updateLeadBodySchema.safeParse(body);
    if (!parsed.success) {
      return setError(parsed.error.issues[0]?.message ?? 'Nothing to update');
    }
    setError(null);
    update.mutate(parsed.data as UpdateLeadBodyDto, {
      onSuccess: onClose,
      onError: (e) => setError(errMsg(e, 'Could not save')),
    });
  };

  const field = (k: keyof typeof f, label: string, multiline = false, extra: object = {}) => (
    <View style={{ gap: 4 }}>
      <Text variant="caption" muted>
        {label}
      </Text>
      <TextInput
        value={f[k]}
        onChangeText={(v) => setF((p) => ({ ...p, [k]: v }))}
        placeholderTextColor={colors.placeholder}
        multiline={multiline}
        style={[styles.input, multiline && { minHeight: 80, textAlignVertical: 'top' }]}
        {...extra}
      />
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Edit lead"
      footer={<Button title="Save changes" size="lg" loading={update.isPending} onPress={submit} fullWidth />}
    >
      <View style={{ gap: space[3] }}>
        {field('name', 'Name')}
        {field('phone', 'Mobile number', false, { keyboardType: 'number-pad' })}
        {field('altPhone', 'Alternate number', false, { keyboardType: 'number-pad' })}
        {field('email', 'Email', false, { keyboardType: 'email-address', autoCapitalize: 'none' })}
        {field('city', 'City / locality')}
        {field('notes', 'Notes', true)}
        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 44,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
  },
  opt: {
    minHeight: 44,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    justifyContent: 'center',
  },
});
