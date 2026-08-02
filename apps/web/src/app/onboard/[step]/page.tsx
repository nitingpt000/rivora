'use client';

import { useProtocol } from '@rivora/protocol-sim';
import { Meter, Page, PageHeader } from '@rivora/ui';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { StepCosts } from '@/components/onboarding/step-costs';
import { StepCustody } from '@/components/onboarding/step-custody';
import { StepEndpoint } from '@/components/onboarding/step-endpoint';
import { StepProfile } from '@/components/onboarding/step-profile';

const STEPS = {
  1: { title: 'Register a service', component: StepProfile },
  2: { title: 'Endpoint and binding', component: StepEndpoint },
  3: { title: 'Custody and router', component: StepCustody },
  4: { title: 'Costs, wallet, terms', component: StepCosts },
} as const;

/**
 * S-10 … S-13 — the four onboarding steps. screens.md §7
 *
 * One route with a step parameter rather than four pages: the progress header,
 * the measure and the back/continue contract are identical, and the steps share
 * a single draft in the store. PRD §22.1 targets under ten minutes end to end —
 * a flow that reloads its own chrome four times does not help.
 */
export default function OnboardingPage() {
  const params = useParams<{ step: string }>();
  const router = useRouter();
  const step = Number(params.step);
  const setStep = useProtocol((s) => s.setOnboarding);
  const currentStep = useProtocol((s) => s.onboarding.step);

  // Keep the store's step in sync when the user navigates by URL.
  useEffect(() => {
    if (step >= 1 && step <= 4 && step !== currentStep) {
      setStep('step', step as 1 | 2 | 3 | 4);
    }
  }, [step, currentStep, setStep]);

  if (!Number.isInteger(step) || step < 1 || step > 4) notFound();

  const definition = STEPS[step as 1 | 2 | 3 | 4];
  const Component = definition.component;

  const goTo = (next: number) => router.push(`/onboard/${next}`);

  return (
    <Page measure="tight" paddingTop={36}>
      <PageHeader
        title={definition.title}
        aside={
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-neutral-600)',
              fontFamily: 'var(--font-heading)',
              letterSpacing: '0.08em',
            }}
          >
            STEP {step} OF 4
          </span>
        }
      />
      <Meter ratio={step / 4} height={4} style={{ marginBottom: 28 }} />
      <Component onNext={() => goTo(step + 1)} onBack={() => goTo(step - 1)} />
    </Page>
  );
}
