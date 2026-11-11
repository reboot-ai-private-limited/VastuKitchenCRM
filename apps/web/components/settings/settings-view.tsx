'use client';

import { Save } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api/client';
import { useResetSetting, useSaveSettings, useSettings } from '@/lib/api/settings';
import {
  changedValues,
  currentFieldValue,
  groupSettings,
  settingErrorsFromApi,
  validateDraft,
  type Draft,
} from '@/lib/settings';
import { SettingField } from './setting-field';

/** A copy of `obj` without `key`. */
function without<T>(obj: Record<string, T>, key: string): Record<string, T> {
  const copy = { ...obj };
  delete copy[key];
  return copy;
}

/** Scroll to the first field with a problem and put the cursor there. */
function focusField(key: string) {
  const el = document.getElementById(`setting-${key}`);
  el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el?.focus({ preventScroll: true });
}

export function SettingsView() {
  const q = useSettings();
  const save = useSaveSettings();
  const reset = useResetSetting();
  const [draft, setDraft] = useState<Draft>({});
  const [serverErrors, setServerErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [resetting, setResetting] = useState<string | null>(null);
  const list = useMemo(() => q.data ?? [], [q.data]);

  const changes = useMemo(() => changedValues(list, draft), [list, draft]);
  const clientErrors = useMemo(() => validateDraft(list, draft), [list, draft]);
  const errors = { ...serverErrors, ...clientErrors };
  const dirty = Object.keys(changes).length > 0;
  const blocked = Object.keys(clientErrors).length > 0;

  // Unsaved edits are the one thing a settings page must not lose silently.
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const edit = (key: string, value: string | boolean) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setServerErrors((e) => without(e, key));
    setBanner(null);
  };

  function submit() {
    setBanner(null);
    const first = Object.keys(clientErrors)[0];
    if (first) return focusField(first);
    save.mutate(changes, {
      onSuccess: () => {
        setDraft({});
        setServerErrors({});
        toast.success('Settings saved');
      },
      onError: (e) => {
        const byKey = e instanceof ApiError ? settingErrorsFromApi(e.fieldErrors) : {};
        setServerErrors(byKey);
        const key = Object.keys(byKey)[0];
        if (key) {
          setBanner('Nothing was saved. Fix the marked setting and save again.');
          // Wait a frame so the error message is in the DOM before we scroll to it.
          requestAnimationFrame(() => focusField(key));
        } else
          setBanner(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      },
    });
  }

  function resetOne(key: string) {
    setResetting(key);
    reset.mutate(key, {
      onSuccess: () => {
        setDraft((d) => without(d, key));
        setServerErrors((e) => without(e, key));
        toast.success('Back to the default');
      },
      onError: (e) =>
        toast.error(e instanceof ApiError ? e.message : 'Couldn’t reset that setting.'),
      onSettled: () => setResetting(null),
    });
  }

  return (
    <PageBody>
      <PageHeader
        title="Settings"
        description="Changes apply straight away. Everything saves together or not at all."
        actions={
          <>
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setDraft({});
                  setServerErrors({});
                  setBanner(null);
                }}
                disabled={save.isPending}
              >
                Discard
              </Button>
            )}
            <Button onClick={submit} disabled={!dirty || save.isPending || blocked}>
              <Save />{' '}
              {save.isPending
                ? 'Saving…'
                : dirty
                  ? `Save ${Object.keys(changes).length} ${Object.keys(changes).length === 1 ? 'change' : 'changes'}`
                  : 'Save'}
            </Button>
          </>
        }
      />

      {banner && (
        <p role="alert" className="bg-danger-soft text-danger rounded-md p-3 text-sm">
          {banner}
        </p>
      )}

      {q.isPending ? (
        <div className="space-y-4" aria-hidden>
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      ) : q.isError ? (
        <div className="bg-card shadow-card rounded-xl border">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : (
        groupSettings(list).map(({ group, items }) => (
          <section
            key={group}
            aria-labelledby={`group-${group}`}
            className="bg-card shadow-card overflow-hidden rounded-xl border"
          >
            <h2
              id={`group-${group}`}
              className="bg-muted/70 border-b px-4 py-2.5 text-sm font-semibold"
            >
              {group}
            </h2>
            <div className="divide-y">
              {items.map((s) => (
                <SettingField
                  key={s.key}
                  setting={s}
                  value={currentFieldValue(s, draft)}
                  error={errors[s.key]}
                  edited={s.key in changes}
                  resetting={resetting === s.key}
                  onChange={(v) => edit(s.key, v)}
                  onReset={() => resetOne(s.key)}
                />
              ))}
            </div>
          </section>
        ))
      )}
    </PageBody>
  );
}
