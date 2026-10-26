'use client';

// Organisation registration (FR-C1.1): organisation details, contact person, then the emailed
// 6-digit code. On success the contact is signed in and sent to the needs assessment.

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Button, Checkbox, Field, Input, Select } from '@/components/ui';
import { identity } from '@/lib/api/services';
import { errorMessage } from '@/lib/api/hooks';
import { useSession } from '@/lib/session';
import { useT } from '@/lib/i18n';
import { CodeInput, OfflineNotice, Steps } from './auth';
import { countries, isEmail, isPhone, sectors, staffSizes } from './options';

interface Form {
  legalName: string; regNumber: string; country: string; region: string; sector: string; staffSize: string;
  contactName: string; contactEmail: string; contactPhone: string; consent: boolean;
}
const empty: Form = { legalName: '', regNumber: '', country: '', region: '', sector: '', staffSize: '', contactName: '', contactEmail: '', contactPhone: '', consent: false };
type Errors = Partial<Record<keyof Form | 'code' | 'form', string>>;

export function OrgRegisterAside() {
  const t = useT();
  return (
    <>
      <p className="font-display text-[clamp(26px,2.4vw,34px)] font-bold leading-tight tracking-tight">{t('org.register.asideTitle')}</p>
      <ol className="mt-8 flex flex-col gap-3 text-[15px]">
        {[t('org.coaching.step1'), t('org.coaching.step2'), t('org.coaching.step3')].map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className="grid size-8 place-items-center rounded-full bg-bg font-display font-bold text-brand">{i + 1}</span>{s}
          </li>
        ))}
      </ol>
    </>
  );
}

export function OrgRegisterForm() {
  const t = useT();
  const router = useRouter();
  const { acceptAuth } = useSession();
  const steps = [t('org.register.s1'), t('org.register.s2'), t('org.register.s3')];
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form>(empty);
  const [errors, setErrors] = useState<Errors>({});
  const [code, setCode] = useState('');
  const [verificationId, setVerificationId] = useState('');
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => { setF(p => ({ ...p, [k]: v })); setErrors(e => ({ ...e, [k]: undefined, form: undefined })); };

  const validate = (s: number): Errors => {
    const e: Errors = {};
    if (s === 0) {
      if (!f.legalName.trim()) e.legalName = t('org.register.errName');
      if (!f.country) e.country = t('org.register.errCountry');
      if (!f.region.trim()) e.region = t('org.register.errRegion');
      if (!f.sector) e.sector = t('org.register.errSector');
      if (!f.staffSize) e.staffSize = t('org.register.errSize');
    }
    if (s === 1) {
      if (!f.contactName.trim()) e.contactName = t('org.register.errContact');
      if (!isEmail(f.contactEmail)) e.contactEmail = t('org.prof.errEmail');
      if (!isPhone(f.contactPhone)) e.contactPhone = t('org.register.errPhone');
      if (!f.consent) e.consent = t('org.register.errConsent');
    }
    if (s === 2 && !/^\d{6}$/.test(code)) e.code = t('org.register.errCode');
    return e;
  };

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const e = validate(step);
    setErrors(e);
    if (Object.keys(e).length) { document.getElementById(`org-${Object.keys(e)[0]}`)?.focus(); return; }
    if (step === 0) { setStep(1); window.scrollTo({ top: 0 }); return; }

    setBusy(true);
    try {
      if (step === 1) {
        const r = await identity.registerOrganisation({
          body: {
            legalName: f.legalName.trim(), registrationNumber: f.regNumber.trim() || undefined, country: f.country, region: f.region.trim(),
            sector: f.sector, staffSize: f.staffSize, contact: { name: f.contactName.trim(), email: f.contactEmail.trim(), phone: f.contactPhone.trim() },
          },
        });
        setVerificationId(r.verificationId);
        setStep(2);
        window.scrollTo({ top: 0 });
      } else {
        const auth = await identity.verify({ body: { verificationId, code } });
        acceptAuth(auth);
        router.push('/org/assessment');
      }
    } catch (er) {
      setErrors({ form: errorMessage(er) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <h1 className="text-[clamp(32px,4vw,44px)] font-bold leading-tight">{t('org.register.title')}</h1>
      <p className="mb-8 mt-2 text-muted">
        {t('org.register.already')} <Link href="/login" className="font-semibold text-brand hover:underline">{t('org.register.signIn')}</Link>
      </p>

      <OfflineNotice />
      <Steps steps={steps} current={step} />

      <form onSubmit={submit} noValidate className="flex flex-col gap-5">
        {step === 0 && (
          <>
            <Field label={t('org.register.legalName')} htmlFor="org-legalName" error={errors.legalName}>
              <Input id="org-legalName" autoComplete="organization" value={f.legalName} onChange={e => set('legalName', e.target.value)} aria-invalid={!!errors.legalName} />
            </Field>
            <Field label={t('org.register.regNumber')} htmlFor="org-regNumber" optional hint={t('org.register.regHint')}>
              <Input id="org-regNumber" value={f.regNumber} onChange={e => set('regNumber', e.target.value)} />
            </Field>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('org.prof.f.country')} htmlFor="org-country" error={errors.country}>
                <Select id="org-country" value={f.country} onChange={e => set('country', e.target.value)} aria-invalid={!!errors.country}>
                  <option value="">{t('org.register.choose')}</option>
                  {countries.map(c => <option key={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label={t('org.register.region')} htmlFor="org-region" error={errors.region}>
                <Input id="org-region" value={f.region} onChange={e => set('region', e.target.value)} aria-invalid={!!errors.region} />
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={t('org.prof.f.sector')} htmlFor="org-sector" error={errors.sector}>
                <Select id="org-sector" value={f.sector} onChange={e => set('sector', e.target.value)} aria-invalid={!!errors.sector}>
                  <option value="">{t('org.register.choose')}</option>
                  {sectors.map(s => <option key={s}>{s}</option>)}
                </Select>
              </Field>
              <Field label={t('org.register.staff')} htmlFor="org-staffSize" error={errors.staffSize}>
                <Select id="org-staffSize" value={f.staffSize} onChange={e => set('staffSize', e.target.value)} aria-invalid={!!errors.staffSize}>
                  <option value="">{t('org.register.choose')}</option>
                  {staffSizes.map(s => <option key={s}>{s}</option>)}
                </Select>
              </Field>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <p className="text-muted">{t('org.register.contactLead')}</p>
            <Field label={t('org.prof.fullName')} htmlFor="org-contactName" error={errors.contactName}>
              <Input id="org-contactName" autoComplete="name" value={f.contactName} onChange={e => set('contactName', e.target.value)} aria-invalid={!!errors.contactName} />
            </Field>
            <Field label={t('org.prof.workEmail')} htmlFor="org-contactEmail" error={errors.contactEmail}>
              <Input id="org-contactEmail" type="email" autoComplete="email" value={f.contactEmail} onChange={e => set('contactEmail', e.target.value)} aria-invalid={!!errors.contactEmail} />
            </Field>
            <Field label={t('org.register.phone')} htmlFor="org-contactPhone" error={errors.contactPhone} hint={t('org.register.phoneHint')}>
              <Input id="org-contactPhone" type="tel" autoComplete="tel" value={f.contactPhone} onChange={e => set('contactPhone', e.target.value)} aria-invalid={!!errors.contactPhone} />
            </Field>
            <div>
              <Checkbox id="org-consent" checked={f.consent} onChange={e => set('consent', e.target.checked)} label={t('org.register.consent')} />
              {errors.consent && <p className="ml-8 mt-1 text-sm text-brand">{errors.consent}</p>}
            </div>
          </>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <p>{t('org.register.codeSent')} <span className="break-all font-semibold">{f.contactEmail}</span></p>
            <p className="text-sm text-subtle">{t('org.register.previewCode')}</p>
            <div id="org-code" tabIndex={-1}><CodeInput value={code} onChange={v => { setCode(v); setErrors({}); }} invalid={!!errors.code} /></div>
            {errors.code && <p className="text-sm text-brand">{errors.code}</p>}
            <p className="text-sm text-muted">{t('org.register.nextAssessment')}</p>
          </div>
        )}

        {errors.form && <p role="alert" className="rounded-xl bg-brand-light p-3 text-sm text-ink dark:bg-brand/15">{errors.form}</p>}

        <div className="mt-3 flex items-center justify-between gap-3">
          {step > 0 ? <Button type="button" variant="ghost" onClick={() => { setErrors({}); setStep(s => s - 1); }}><ArrowLeft size={18} aria-hidden="true" /> {t('ui.back')}</Button> : <span />}
          <Button type="submit" size="lg" disabled={busy}>
            {step === 2 ? t('org.register.verify') : step === 1 ? t('org.register.sendCode') : t('org.book.continue')} <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </div>
      </form>

      {step === 0 && (
        <p className="mt-10 text-sm text-muted">
          {t('org.register.forSelf')} <Link href="/register" className="font-semibold text-brand hover:underline">{t('org.register.learner')}</Link>
        </p>
      )}
    </>
  );
}
