import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useRef, useState, type ComponentProps, type ComponentRef } from 'react';
import {
  Keyboard,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createLeadBodySchema,
  LEAD_PRODUCTS_OF_INTEREST,
  LEAD_SOURCES,
  PHONE_COUNTRIES,
  splitPhone,
  type LeadProductOfInterest,
  type LeadSource,
} from '@vastu/contracts';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { PhoneField } from '@/components/ui/phone-field';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { colors, font, radius, space } from '@/constants/theme';
import { SheetRow } from '@/features/projects/sheet-row';
import { ApiError, NetworkError } from '@/lib/api/client';
import { useSession } from '@/lib/auth/session';
import { PRODUCT_LABEL, SOURCE_LABEL } from './lead-meta';
import { useCreateLead } from './use-leads';

const SOURCE_ICON: Record<LeadSource, ComponentProps<typeof Feather>['name']> = {
  WALK_IN: 'user',
  WEBSITE: 'globe',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
  JUSTDIAL: 'search',
  REFERRAL: 'users',
  EXISTING_CUSTOMER: 'repeat',
  OTHER: 'more-horizontal',
};

export function AddLeadScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSession();
  const create = useCreateLead();

  const nameRef = useRef<ComponentRef<typeof TextInput>>(null);
  const phoneRef = useRef<ComponentRef<typeof TextInput>>(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  // Office staff only record walk-ins here; everyone else has to say where the lead came from.
  const [source, setSource] = useState<LeadSource | null>(user?.role === 'OFFICE' ? 'WALK_IN' : null);
  const [pickingSource, setPickingSource] = useState(false);
  const [products, setProducts] = useState<LeadProductOfInterest[]>([]);
  const [pickingProducts, setPickingProducts] = useState(false);
  const [city, setCity] = useState('');
  const [notes, setNotes] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; phone?: string; source?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);

  const productsSummary =
    products.length === 0
      ? 'Select products (optional)'
      : products.length <= 2
        ? products.map((p) => PRODUCT_LABEL[p]).join(', ')
        : `${PRODUCT_LABEL[products[0]]}, ${PRODUCT_LABEL[products[1]]} +${products.length - 2} more`;

  const submit = () => {
    const parsed = createLeadBodySchema.safeParse({
      name,
      phone,
      source,
      ...(products.length > 0 ? { productsOfInterest: products } : {}),
      city: city.trim() || undefined,
      notes: notes.trim() || undefined,
    });
    if (!parsed.success) {
      const next: { name?: string; phone?: string; source?: string } = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'name' && !next.name) {
          next.name = 'Enter the customer name';
        } else if (field === 'phone' && !next.phone) {
          const country = PHONE_COUNTRIES.find((c) => c.dial === splitPhone(phone).dial) ?? PHONE_COUNTRIES[0];
          next.phone = phone
            ? `Enter a valid ${country.digits}-digit mobile number for ${country.name}`
            : 'Enter the mobile number';
        } else if (field === 'source' && !next.source) {
          next.source = 'Choose a lead source';
        }
      }
      setFieldErrors(next);
      setError(!next.name && !next.phone && !next.source ? (parsed.error.issues[0]?.message ?? 'Enter valid lead details') : null);
      if (next.name) nameRef.current?.focus();
      else if (next.phone) phoneRef.current?.focus();
      else if (next.source) {
        Keyboard.dismiss();
        setPickingSource(true);
      }
      return;
    }
    setFieldErrors({});
    setError(null);
    setExistingId(null);
    create.mutate(parsed.data, {
      onSuccess: ({ lead }) => {
        // Queued (offline): the lead is added when the connection returns.
        if (lead) router.replace({ pathname: '/leads/[id]', params: { id: lead.id } } as Href);
        else router.replace('/leads' as Href);
      },
      onError: (err) => {
        const existing = (err instanceof ApiError ? (err.data as { existingLeadId?: unknown } | undefined) : undefined)
          ?.existingLeadId;
        if (err instanceof ApiError && err.status === 409 && typeof existing === 'string') {
          setExistingId(existing);
          setError('A lead with this phone number already exists.');
          return;
        }
        setError(
          err instanceof NetworkError
            ? 'Connection lost. Check your internet and try again.'
            : err instanceof ApiError
              ? err.message
              : 'Could not create lead',
        );
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
    >
      <Stack.Screen
        options={{
          headerShown: true,
          title: user?.role === 'OFFICE' ? 'Add walk-in lead' : 'New lead',
          headerShadowVisible: false,
          headerTintColor: colors.primary,
        }}
      />
      <ScrollView
        contentContainerStyle={{
          padding: space[4],
          paddingBottom: insets.bottom + space[8],
          gap: space[4],
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text variant="caption" muted>
            Customer name *
          </Text>
          <TextInput
            ref={nameRef}
            value={name}
            onChangeText={(v) => {
              setName(v);
              if (fieldErrors.name) setFieldErrors((cur) => ({ ...cur, name: undefined }));
            }}
            placeholder="e.g. Priya Verma"
            placeholderTextColor={colors.placeholder}
            autoFocus
            style={[styles.input, fieldErrors.name && styles.inputError]}
          />
          {fieldErrors.name ? (
            <Text variant="caption" color={colors.destructive}>
              {fieldErrors.name}
            </Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text variant="caption" muted>
            Mobile number *
          </Text>
          <PhoneField
            inputRef={phoneRef}
            value={phone}
            onChangeText={(v) => {
              setPhone(v);
              if (fieldErrors.phone) setFieldErrors((cur) => ({ ...cur, phone: undefined }));
              if (existingId) setExistingId(null);
            }}
            accessibilityLabel="Mobile number"
          />
          {fieldErrors.phone ? (
            <Text variant="caption" color={colors.destructive}>
              {fieldErrors.phone}
            </Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text variant="caption" muted>
            Lead source *
          </Text>
          <PressableScale
            onPress={() => {
              Keyboard.dismiss();
              setPickingSource(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Lead source, ${source ? SOURCE_LABEL[source] : 'not chosen'}`}
            style={[styles.input, styles.select, fieldErrors.source && styles.inputError]}
          >
            <Text style={styles.selectText} color={source ? colors.foreground : colors.mutedForeground}>
              {source ? SOURCE_LABEL[source] : 'Choose source'}
            </Text>
            <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
          </PressableScale>
          {fieldErrors.source ? (
            <Text variant="caption" color={colors.destructive}>
              {fieldErrors.source}
            </Text>
          ) : null}
        </View>

        <View style={styles.field}>
          <Text variant="caption" muted>
            Product of interest
          </Text>
          <PressableScale
            onPress={() => {
              Keyboard.dismiss();
              setPickingProducts(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={
              products.length > 0
                ? `Product of interest: ${products.map((p) => PRODUCT_LABEL[p]).join(', ')}`
                : 'Product of interest, none selected'
            }
            style={[styles.input, styles.select]}
          >
            <Text
              numberOfLines={1}
              style={[styles.selectText, { flex: 1 }]}
              color={products.length > 0 ? colors.foreground : colors.mutedForeground}
            >
              {productsSummary}
            </Text>
            <Feather name="chevron-down" size={18} color={colors.mutedForeground} />
          </PressableScale>
        </View>

        <View style={styles.field}>
          <Text variant="caption" muted>
            City / Locality
          </Text>
          <TextInput
            value={city}
            onChangeText={setCity}
            placeholder="Optional"
            placeholderTextColor={colors.placeholder}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text variant="caption" muted>
            Notes
          </Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Requirement, layout or budget notes"
            placeholderTextColor={colors.placeholder}
            multiline
            style={[styles.input, styles.textarea]}
          />
        </View>

        {error ? (
          <Text variant="caption" color={colors.destructive}>
            {error}
          </Text>
        ) : null}

        {existingId ? (
          <Button
            title="Open existing lead"
            variant="outline"
            onPress={() => router.replace({ pathname: '/leads/[id]', params: { id: existingId } } as Href)}
            fullWidth
          />
        ) : null}

        <Button title="Save lead" size="lg" loading={create.isPending} onPress={submit} fullWidth />
      </ScrollView>

      <BottomSheet visible={pickingSource} onClose={() => setPickingSource(false)} title="Lead source">
        {LEAD_SOURCES.map((s) => (
          <SheetRow
            key={s}
            icon={SOURCE_ICON[s]}
            label={SOURCE_LABEL[s]}
            selected={s === source}
            onPress={() => {
              setSource(s);
              if (fieldErrors.source) setFieldErrors((cur) => ({ ...cur, source: undefined }));
              setError(null);
              setPickingSource(false);
            }}
          />
        ))}
      </BottomSheet>
      <BottomSheet
        visible={pickingProducts}
        onClose={() => setPickingProducts(false)}
        title="Product of interest"
        footer={<Button title="Done" size="lg" onPress={() => setPickingProducts(false)} fullWidth />}
      >
        <View style={{ gap: 2 }}>
          {LEAD_PRODUCTS_OF_INTEREST.map((p) => {
            const active = products.includes(p);
            return (
              <SheetRow
                key={p}
                icon="tag"
                label={PRODUCT_LABEL[p]}
                selected={active}
                onPress={() =>
                  setProducts((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))
                }
              />
            );
          })}
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 48,
    paddingHorizontal: space[3],
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.input,
    backgroundColor: colors.background,
    fontFamily: font.regular,
    fontSize: 16,
    color: colors.foreground,
  },
  textarea: {
    height: 96,
    paddingTop: space[3],
    textAlignVertical: 'top',
  },
  field: { gap: space[1] },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectText: { fontSize: 16 },
  inputError: { borderColor: colors.destructive },
});
