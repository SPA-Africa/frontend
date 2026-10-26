'use client';

// Learner sign-up in five short steps. The draft is kept on the device (never the password).
// Step 4 calls identity.registerLearner, step 5 confirms the code with identity.verify.

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, HandHeart } from 'lucide-react';
import { Button, Checkbox, Field, Input, Select } from '@/components/ui';
import { useToast } from '@/components/ui/client';
import { API_MODE } from '@/lib/api/config';
import { ApiError } from '@/lib/api/http';
import { errorMessage } from '@/lib/api/hooks';
import { identity } from '@/lib/api/services';
import type { RegisterLearnerRequest } from '@/lib/api/services/core/identity';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import type { PillarId } from '@/lib/types';
import { ChoiceCard, CodeInput, OfflineNotice, Steps, useOnline } from './auth';
import { safeNext } from './LoginForm';
import { ageOn, countries, isEmail, isPhone } from './options';
import { PillarIcon } from './pillar-icon';

const DRAFT_KEY = 'spa-register-draft';
const MIN_AGE = 15;
const PILLARS: PillarId[] = ['technology', 'education', 'leadership', 'young_startups', 'agriculture'];
const GENDERS = ['female', 'male', 'prefer_not'] as const;
const LANGS = ['en', 'fr', 'rw'] as const;

interface Form {
  name: string; contact: string; password: string;
  dob: string; gender: RegisterLearnerRequest['gender'] | ''; country: string; region: string;
  pillars: PillarId[]; language: RegisterLearnerRequest['language'] | '';
  consentTerms: boolean; consentData: boolean; consentAi: boolean; consentUpdates: boolean;
}
const empty: Form = {
  name: '', contact: '', password: '', dob: '', gender: '', country: '', region: '',
  pillars: [], language: '', consentTerms: false, consentData: false, consentAi: false, consentUpdates: false,
};
type Errors = Partial<Record<keyof Form | 'code' | 'form', string>>;

export function RegisterForm() {
  const t = useT();
  const params = useSearchParams();
  const mentor = params.get('as') === 'mentor';
  const next = safeNext(params.get('next'));
  const router = useRouter();
  const { acceptAuth } = useSession();
  const online = useOnline();
  const { toast, toastNode } = useToast();
  const steps = [t('public.auth.stepAccount'), t('public.auth.stepAbout'), t('public.auth.stepInterests'), t('public.auth.stepConsent'), t('public.auth.stepVerify')];

  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [code, setCode] = useState('');
  const [show, setShow] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [verificationId, setVerificationId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Partial<Form>;
        setF(prev => ({
          ...prev, ...d, password: '',
          gender: GENDERS.includes(d.gender as never) ? d.gender! : '',
          language: LANGS.includes(d.language as never) ? d.language! : '',
        }));
      }
    } catch {}
    setLoaded(true);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { const { password: _p, ...rest } = f; localStorage.setItem(DRAFT_KEY, JSON.stringify(rest)); } catch {}
  }, [f, loaded]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: undefined, form: undefined })); };
  const togglePillar = (id: PillarId) => set('pillars', f.pillars.includes(id) ? f.pillars.filter(p => p !== id) : [...f.pillars, id]);

  const validate = (s: number): Errors => {
    const e: Errors = {};
    if (s === 0) {
      if (!f.name.trim()) e.name = t('public.auth.err.name');
      if (!f.contact.trim()) e.contact = t('public.auth.err.identifierRequired');
      else if (!isEmail(f.contact) && !isPhone(f.contact)) e.contact = t('public.auth.err.identifierInvalid');
      if (f.password.length < 8) e.password = t('public.auth.err.passwordShort');
    }
    if (s === 1) {
      if (!f.dob) e.dob = t('public.auth.err.dob');
      else if (new Date(f.dob + 'T00:00:00') > new Date()) e.dob = t('public.auth.err.dobFuture');
      else if (ageOn(f.dob) < MIN_AGE) e.dob = t('public.auth.err.tooYoung', { n: MIN_AGE });
      if (!f.gender) e.gender = t('public.auth.err.choose');
      if (!f.country) e.country = t('public.auth.err.country');
      if (!f.region.trim()) e.region = t('public.auth.err.region');
    }
    if (s === 2) {
      if (!f.pillars.length) e.pillars = t('public.auth.err.pillars');
      if (!f.language) e.language = t('public.auth.err.language');
    }
    if (s === 3) {
      if (!f.consentTerms) e.consentTerms = t('public.auth.err.terms');
      if (!f.consentData) e.consentData = t('public.auth.err.data');
    }
    if (s === 4 && !/^\d{6}$/.test(code)) e.code = t('public.auth.err.code');
    return e;
  };

  const register = async () => {
    const body: RegisterLearnerRequest = {
      name: f.name.trim(), identifier: f.contact.trim(), password: f.password, dateOfBirth: f.dob,
      gender: f.gender as RegisterLearnerRequest['gender'], country: f.country, region: f.region.trim(), pillars: f.pillars,
      language: f.language as RegisterLearnerRequest['language'],
      consents: { dataProcessing: f.consentData, aiRecommendations: f.consentAi, news: f.consentUpdates },
      intent: mentor ? 'mentor' : 'learner',
    };
    const pending = await identity.registerLearner({ body });
    setVerificationId(pending.verificationId);
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) {
      document.getElementById(`reg-${Object.keys(e)[0]}`)?.focus();
      return;
    }
    if (step < 3) { setStep(step + 1); window.scrollTo({ top: 0 }); return; }
    if (!online) { setErrors({ form: t('public.auth.err.offlineSend') }); return; }
    setBusy(true);
    try {
      if (step === 3) {
        if (!f.password) { setStep(0); setErrors({ password: t('public.auth.err.passwordAgain') }); return; }
        await register();
        setStep(4);
        window.scrollTo({ top: 0 });
        return;
      }
      const user = acceptAuth(await identity.verify({ body: { verificationId: verificationId!, code } }));
      try { localStorage.removeItem(DRAFT_KEY); } catch {}
      router.push(next ?? (user.role === 'beneficiary' ? '/app' : '/'));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'under_minimum_age') { setStep(1); setErrors({ dob: t('public.auth.err.tooYoung', { n: MIN_AGE }) }); }
      else setErrors({ form: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    setBusy(true);
    try { await register(); toast(t('public.auth.codeResent')); } catch (err) { setErrors({ form: errorMessage(err) }); } finally { setBusy(false); }
  };
  const back = () => { setErrors({}); setStep(s => Math.max(0, s - 1)); };

  return (
    <>
      <h1 className="text-[clamp(32px,4vw,44px)] font-bold leading-tight">{mentor ? t('public.auth.mentorTitle') : t('public.auth.registerTitle')}</h1>
      <p className="mb-8 mt-2 text-muted">
        {t('public.auth.haveAccount')} <Link href={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-semibold text-brand hover:underline">{t('public.auth.signIn')}</Link>
      </p>

      {mentor && step === 0 && (
        <div className="mb-6 flex items-start gap-3 rounded-2xl bg-surface p-4 text-sm">
          <HandHeart size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-brand" />
          <span>{t('public.auth.mentorNote')}</span>
        </div>
      )}

      <OfflineNotice />
      <Steps steps={steps} current={step} />

      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {errors.form && <p role="alert" className="rounded-2xl bg-brand-light px-4 py-3 text-sm font-semibold text-brand-dark dark:bg-brand/15 dark:text-brand-light">{errors.form}</p>}

        {step === 0 && (
          <>
            <Field label={t('public.auth.fullName')} htmlFor="reg-name" error={errors.name}>
              <Input id="reg-name" autoComplete="name" value={f.name} onChange={e => set('name', e.target.value)} aria-invalid={!!errors.name} />
            </Field>
            <Field label={t('public.auth.contact')} htmlFor="reg-contact" error={errors.contact} hint={t('public.auth.contactHint')}>
              <Input id="reg-contact" autoComplete="email" value={f.contact} onChange={e => set('contact', e.target.value)} aria-invalid={!!errors.contact} placeholder="you@example.com" />
            </Field>
            <Field label={t('public.auth.password')} htmlFor="reg-password" error={errors.password} hint={t('public.auth.passwordHint')}>
              <div className="relative">
                <Input id="reg-password" type={show ? 'text' : 'password'} autoComplete="new-password" value={f.password} onChange={e => set('password', e.target.value)} aria-invalid={!!errors.password} className="pr-12" />
                <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? t('public.auth.hidePassword') : t('public.auth.showPassword')} aria-pressed={show}
                  className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface hover:text-ink">
                  {show ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label={t('public.auth.dob')} htmlFor="reg-dob" error={errors.dob} hint={t('public.auth.dobHint', { n: MIN_AGE })}>
              <Input id="reg-dob" type="date" autoComplete="bday" value={f.dob} max={new Date().toISOString().slice(0, 10)} onChange={e => set('dob', e.target.value)} aria-invalid={!!errors.dob} />
            </Field>
            <Field label={t('public.auth.gender')} htmlFor="reg-gender" error={errors.gender} hint={t('public.auth.genderHint')}>
              <Select id="reg-gender" value={f.gender} onChange={e => set('gender', e.target.value as Form['gender'])} aria-invalid={!!errors.gender}>
                <option value="">{t('public.auth.choose')}</option>
                {GENDERS.map(g => <option key={g} value={g}>{t(`public.auth.gender.${g}`)}</option>)}
              </Select>
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('public.auth.country')} htmlFor="reg-country" error={errors.country}>
                <Select id="reg-country" autoComplete="country-name" value={f.country} onChange={e => set('country', e.target.value)} aria-invalid={!!errors.country}>
                  <option value="">{t('public.auth.choose')}</option>
                  {countries.map(c => <option key={c} value={c}>{c === 'Other' ? t('public.auth.otherCountry') : c}</option>)}
                </Select>
              </Field>
              <Field label={t('public.auth.region')} htmlFor="reg-region" error={errors.region}>
                <Input id="reg-region" autoComplete="address-level1" value={f.region} onChange={e => set('region', e.target.value)} aria-invalid={!!errors.region} />
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <fieldset>
              <legend id="reg-pillars" tabIndex={-1} className="mb-1 text-sm font-semibold">{mentor ? t('public.auth.pillarsMentor') : t('public.auth.pillarsLearner')}</legend>
              <p className="mb-3 text-sm text-subtle">{t('public.auth.pillarsHint')}</p>
              <div className="grid gap-2.5">
                {PILLARS.map(p => (
                  <ChoiceCard key={p} checked={f.pillars.includes(p)} onChange={() => togglePillar(p)}
                    title={t(`pillar.${p}`)} text={t(`public.auth.pillarText.${p}`)} icon={<PillarIcon id={p} size={20} />} />
                ))}
              </div>
              {errors.pillars && <p className="mt-2 text-sm text-brand">{errors.pillars}</p>}
            </fieldset>
            <Field label={t('public.auth.language')} htmlFor="reg-language" error={errors.language}>
              <Select id="reg-language" value={f.language} onChange={e => set('language', e.target.value as Form['language'])} aria-invalid={!!errors.language}>
                <option value="">{t('public.auth.choose')}</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
                <option value="rw">Ikinyarwanda</option>
              </Select>
            </Field>
          </>
        )}

        {step === 3 && (
          <fieldset className="flex flex-col gap-4">
            <legend className="mb-1 text-sm text-muted">{t('public.auth.consentIntro')}</legend>
            <div>
              <Checkbox id="reg-consentTerms" checked={f.consentTerms} onChange={e => set('consentTerms', e.target.checked)}
                label={<>{t('public.auth.consentTerms')} <span className="text-subtle">{t('public.auth.required')}</span></>} />
              {errors.consentTerms && <p className="ml-8 mt-1 text-sm text-brand">{errors.consentTerms}</p>}
            </div>
            <div>
              <Checkbox id="reg-consentData" checked={f.consentData} onChange={e => set('consentData', e.target.checked)}
                label={<>{t('public.auth.consentData')} <span className="text-subtle">{t('public.auth.required')}</span></>} />
              {errors.consentData && <p className="ml-8 mt-1 text-sm text-brand">{errors.consentData}</p>}
            </div>
            <Checkbox id="reg-consentAi" checked={f.consentAi} onChange={e => set('consentAi', e.target.checked)}
              label={<>{t('public.auth.consentAi')} <span className="text-subtle">{t('public.auth.optional')}</span></>} />
            <Checkbox id="reg-consentUpdates" checked={f.consentUpdates} onChange={e => set('consentUpdates', e.target.checked)}
              label={<>{t('public.auth.consentNews')} <span className="text-subtle">{t('public.auth.optional')}</span></>} />
            <p className="rounded-2xl bg-surface p-4 text-sm text-muted">{t('public.auth.rights')}</p>
          </fieldset>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-3">
            <p>{t('public.auth.codeSent')} <span className="break-all font-semibold">{f.contact}</span></p>
            {API_MODE === 'mock' && <p className="text-sm text-subtle">{t('public.auth.anyCode')}</p>}
            <div id="reg-code" tabIndex={-1}><CodeInput value={code} onChange={v => { setCode(v); setErrors({}); }} invalid={!!errors.code} /></div>
            {errors.code && <p className="text-sm text-brand">{errors.code}</p>}
            <button type="button" onClick={resend} disabled={busy} className="self-start text-sm font-semibold text-brand hover:underline disabled:opacity-50">{t('public.auth.resend')}</button>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          {step > 0 && step < 4 ? (
            <Button type="button" variant="ghost" onClick={back}><ArrowLeft size={18} aria-hidden="true" /> {t('ui.back')}</Button>
          ) : <span />}
          <Button type="submit" size="lg" disabled={busy}>
            {step === 4 ? t('public.auth.verifyFinish') : step === 3 ? t('public.auth.sendCode') : t('public.auth.continue')} <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      </form>

      {step === 0 && (
        <p className="mt-10 text-sm text-muted">
          {t('public.auth.orgQuestion')} <Link href="/register/organisation" className="font-semibold text-brand hover:underline">{t('public.auth.orgLink')}</Link>
        </p>
      )}
      {toastNode}
    </>
  );
}
