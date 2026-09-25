'use client';

import type { OnboardingData } from '../types/onboarding';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import StepIndicator from '../components/layout/StepIndicator';
import { Card } from '../components/common/Card';
import { useAuth } from '../auth/AuthContext';
import { authApi } from '../api/auth';
import { ProviderAccessLockedCard } from '../components/dashboard/ProviderAccessLockedCard';
import { runProviderAccessRequestFlow } from './providerAccessFlow';

import BasicInfo from '../components/steps/BasicInfo';
import DomainVerify from '../components/steps/DomainVerify';
import ApiInfo from '../components/steps/ApiInfo';
import ImportEndpoints from '../components/steps/ImportEndpoints';
import SkillSelect from '../components/steps/SkillSelect';
import Pricing from '../components/steps/Pricing';
import ApiTesting from '../components/steps/ApiTesting';
import X402Preview from '../components/steps/X402Preview';
import Publish from '../components/steps/Publish';

/**
 * "Schema Validation" used to sit at step 5. It made no request: a 1500 ms `setTimeout` was
 * the whole check, after which every endpoint was marked Passed against five named criteria.
 * There is no endpoint in `Spigot-Algorand` that validates a schema, so the step is gone
 * rather than rewritten.
 */
const steps = [
  { id: 1, name: 'Publisher Details' },
  { id: 2, name: 'Domain Verification' },
  { id: 3, name: 'API Configuration' },
  { id: 4, name: 'Endpoints' },
  { id: 5, name: 'Skills & Categories' },
  { id: 6, name: 'Pricing & Settlement' },
  { id: 7, name: 'Testing & Health' },
  { id: 8, name: 'x402 Integration' },
  { id: 9, name: 'Review & Publish' },
];

const LAST_STEP = steps.length;

const Onboarding: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const router = useRouter();
  const { providerAccess, loading: authLoading, refresh } = useAuth();
  const [isRequestingAccess, setIsRequestingAccess] = useState(false);

  const handleRequestProviderAccess = async () => {
    setIsRequestingAccess(true);
    try {
      await runProviderAccessRequestFlow(authApi.requestProviderAccess, refresh);
    } finally {
      setIsRequestingAccess(false);
    }
  };

  const handleNext = () => {
    if (currentStep < LAST_STEP) {
      window.scrollTo(0, 0);
      setCurrentStep(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      window.scrollTo(0, 0);
      setCurrentStep(prev => prev - 1);
    }
  };

  const updateData = (updates: Partial<OnboardingData>) => {
    setOnboardingData(prev => ({ ...prev, ...updates }));
  };

  const renderStep = () => {
    const props = { data: onboardingData, updateData, onNext: handleNext, onBack: handleBack };

    switch (currentStep) {
      case 1:
        return <BasicInfo {...props} />;
      case 2:
        return <DomainVerify {...props} />;
      case 3:
        return <ApiInfo {...props} />;
      case 4:
        return <ImportEndpoints {...props} />;
      case 5:
        return <SkillSelect {...props} />;
      case 6:
        return <Pricing {...props} />;
      case 7:
        return <ApiTesting data={onboardingData} onNext={handleNext} onBack={handleBack} />;
      case 8:
        return <X402Preview data={onboardingData} onNext={handleNext} onBack={handleBack} />;
      case 9:
        return (
          <Publish
            data={onboardingData}
            onBack={handleBack}
            // `/dashboard` resolves the signed-in publisher's own console
            // (`src/app/dashboard/page.tsx` renders `publisherId="active"`). The hardcoded
            // `/dashboard/new-pub-123` that stood here belongs to no account, so a nine-step
            // wizard ended on a 403.
            onPublish={() => router.push('/dashboard')}
          />
        );
      default:
        return <BasicInfo {...props} />;
    }
  };

  // The provider side is coming soon: step 1 registers a publisher and later steps create and
  // publish an API, all now refused by the backend for an account that is not
  // provider-approved (index.ts's publisher-registration gate, routes/apis.ts). Show the same
  // lock this wizard's entry points (`/start`, `ApisView`'s "Publish New API") already send
  // people past, rather than let step 1 fail with a bare 403.
  if (!authLoading && providerAccess !== 'approved') {
    return (
      <div className="max-w-2xl mx-auto p-4 sm:p-8">
        <ProviderAccessLockedCard
          providerAccess={providerAccess ?? null}
          onRequestAccess={handleRequestProviderAccess}
          isRequesting={isRequestingAccess}
        />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto p-4 sm:p-8 flex flex-col lg:flex-row gap-6 lg:gap-12">
      <div className="w-full lg:w-[300px] shrink-0 lg:sticky lg:top-24 self-start">
        <Card>
          <h2 className="text-xl mb-6 text-accent">Publish an API</h2>
          <StepIndicator steps={steps} currentStep={currentStep} />
        </Card>
      </div>

      <div className="flex-1">{renderStep()}</div>
    </div>
  );
};

export default Onboarding;
