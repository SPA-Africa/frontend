'use client';

// Platform-wide defaults (FR-B1.5). Every change is written to the audit log by the backend.

import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { PageHead, Panel, SkeletonPanel, ErrorState } from '@/components/dash';
import { Badge, Button, Field, Input } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { ConfirmDialog, Toggle } from '@/components/admin/kit';
import { API_MODE } from '@/lib/api/config';
import { resetMockDb } from '@/lib/api/mock-db';
import { errorMessage, useApi } from '@/lib/api/hooks';
import { governance } from '@/lib/api/services';
import { SUPPORTED_LANGUAGES, type LanguageCode, type PlatformSettings } from '@/lib/api/services/core/governance';
import { useT } from '@/lib/i18n';

export default function PlatformSettingsPage() {
  const t = useT();
  const state = useApi(() => governance.getSettings(), []);
  const [s, setS] = useState<PlatformSettings | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [reset, setReset] = useState(false);
  const { toast, toastNode } = useToast();

  useEffect(() => { if (state.data) setS(state.data); }, [state.data]);

  const save = async (key: string, body: Partial<PlatformSettings>, ok: string) => {
    setSaving(key);
    try {
      const next = await governance.updateSettings({ body });
      state.setData(next);
      toast(ok);
    } catch (e) {
      toast(errorMessage(e));
      if (state.data) setS(state.data);
    } finally {
      setSaving(null);
    }
  };

  if (state.error) return <div><PageHead title={t('nav.settings')} /><ErrorState error={state.error} onRetry={state.reload} /></div>;

  return (
    <div className="space-y-6">
      <PageHead title={t('nav.settings')} />

      {!s ? <div className="grid gap-6 lg:grid-cols-2">{[0, 1, 2, 3].map(i => <SkeletonPanel key={i} rows={2} />)}</div> : (
        <div className="grid gap-6 lg:grid-cols-2">
          <Panel title={t('admin.settings.quizzes')}>
            <form onSubmit={e => { e.preventDefault(); save('quiz', { quizPassMark: s.quizPassMark, maxQuizAttempts: s.maxQuizAttempts }, t('admin.settings.quizSaved')); }}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('admin.settings.passMark')} htmlFor="pass" hint={t('admin.settings.passMarkHint')}>
                  <Input id="pass" type="number" min={1} max={100} value={Math.round(s.quizPassMark * 100)} onChange={e => setS({ ...s, quizPassMark: Number(e.target.value) / 100 })} />
                </Field>
                <Field label={t('admin.settings.attempts')} htmlFor="attempts">
                  <Input id="attempts" type="number" min={1} max={10} value={s.maxQuizAttempts} onChange={e => setS({ ...s, maxQuizAttempts: Number(e.target.value) })} />
                </Field>
              </div>
              <Button type="submit" className="mt-5" disabled={!!saving}>{t('ui.save')}</Button>
            </form>
          </Panel>

          <Panel title={t('admin.settings.languages')}>
            <ul className="divide-y divide-line">
              {SUPPORTED_LANGUAGES.map(code => {
                const on = s.languages.includes(code);
                return (
                  <li key={code} className="py-3 first:pt-0 last:pb-0">
                    <Toggle id={`lang-${code}`} label={t(`admin.lang.${code}`)} checked={on} disabled={code === 'en' || !!saving}
                      description={code === 'en' ? t('admin.settings.defaultLang') : t(on ? 'admin.settings.enabled' : 'admin.settings.notEnabled')}
                      onChange={v => {
                        const languages = (v ? [...s.languages, code] : s.languages.filter(l => l !== code)) as LanguageCode[];
                        setS({ ...s, languages });
                        save('lang', { languages }, t(v ? 'admin.settings.langOn' : 'admin.settings.langOff', { lang: t(`admin.lang.${code}`) }));
                      }} />
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title={t('admin.settings.uploads')}>
            <form onSubmit={e => { e.preventDefault(); save('uploads', { uploadLimitsMb: s.uploadLimitsMb }, t('admin.settings.uploadsSaved')); }}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label={t('admin.settings.docLimit')} htmlFor="doc" hint={t('admin.settings.docHint')}>
                  <Input id="doc" type="number" min={1} max={200} value={s.uploadLimitsMb.businessPlan} onChange={e => setS({ ...s, uploadLimitsMb: { ...s.uploadLimitsMb, businessPlan: Number(e.target.value) } })} />
                </Field>
                <Field label={t('admin.settings.deckLimit')} htmlFor="deck" hint={t('admin.settings.deckHint')}>
                  <Input id="deck" type="number" min={1} max={200} value={s.uploadLimitsMb.pitchDeck} onChange={e => setS({ ...s, uploadLimitsMb: { ...s.uploadLimitsMb, pitchDeck: Number(e.target.value) } })} />
                </Field>
              </div>
              <Button type="submit" className="mt-5" disabled={!!saving}>{t('ui.save')}</Button>
            </form>
          </Panel>

          <Panel title={t('admin.settings.privacy')}>
            <form onSubmit={e => { e.preventDefault(); save('privacy', { deletionSlaDays: s.deletionSlaDays }, t('admin.settings.privacySaved')); }}>
              <Field label={t('admin.settings.sla')} htmlFor="sla" hint={t('admin.settings.slaHint')}>
                <Input id="sla" type="number" min={1} max={90} value={s.deletionSlaDays} onChange={e => setS({ ...s, deletionSlaDays: Number(e.target.value) })} />
              </Field>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!!saving}>{t('ui.save')}</Button>
                {s.deletionSlaDays > 30 && <Badge tone="gold">{t('admin.settings.slaWarning')}</Badge>}
              </div>
            </form>
            <div className="mt-6 border-t border-line pt-5">
              <Toggle id="verify" label={t('admin.settings.verify')} description={t('admin.settings.verifyHint')} checked={s.certificateVerification} disabled={!!saving}
                onChange={v => { setS({ ...s, certificateVerification: v }); save('verify', { certificateVerification: v }, t(v ? 'admin.settings.verifyOn' : 'admin.settings.verifyOff')); }} />
            </div>
          </Panel>
        </div>
      )}

      {API_MODE === 'mock' && (
        <Panel title={t('admin.settings.demo')}>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">{t('admin.settings.demoText')}</p>
            <Button variant="danger" onClick={() => setReset(true)}><RotateCcw size={16} /> {t('admin.settings.reset')}</Button>
          </div>
        </Panel>
      )}

      <ConfirmDialog open={reset} onClose={() => setReset(false)} danger title={t('admin.settings.resetTitle')} confirmLabel={t('admin.settings.reset')}
        onConfirm={() => { resetMockDb(); window.location.reload(); }}>
        {t('admin.settings.resetBody')}
      </ConfirmDialog>
      {toastNode}
    </div>
  );
}
