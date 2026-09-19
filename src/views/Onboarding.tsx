'use client';

import type { OnboardingData } from '../types/onboarding';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import StepIndicator from '../components/layout/StepIndicator';
import { Card } from '../components/common/Card';

import BasicInfo from '../components/steps/BasicInfo';
import DomainVerify from '../components/steps/DomainVerify';
import ApiInfo from '../components/steps/ApiInfo';
import ImportEndpoints from '../components/steps/ImportEndpoints';
import SchemaValidation from '../components/steps/SchemaValidation';
import SkillSelect from '../components/steps/SkillSelect';
import Pricing from '../components/steps/Pricing';
import ApiTesting from '../components/steps/ApiTesting';
import X402Preview from '../components/steps/X402Preview';
import Publish from '../components/steps/Publish';

const steps = [
  { id: 1, name: 'Publisher Details' },
  { id: 2, name: 'Domain Verification' },
  { id: 3, name: 'API Configuration' },
  { id: 4, name: 'Endpoints' },
  { id: 5, name: 'Schema Validation' },
  { id: 6, name: 'Skills & Categories' },
  { id: 7, name: 'Pricing & Settlement' },
  { id: 8, name: 'Testing & Health' },
  { id: 9, name: 'x402 Integration' },
  { id: 10, name: 'Review & Publish' },
];

const Onboarding: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({});
  const router = useRouter();

  const handleNext = () => {
    if (currentStep < 10) {
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
        return <SchemaValidation data={onboardingData} onNext={handleNext} onBack={handleBack} />;
      case 6:
        return <SkillSelect {...props} />;
      case 7:
        return <Pricing {...props} />;
      case 8:
        return <ApiTesting data={onboardingData} onNext={handleNext} onBack={handleBack} />;
      case 9:
        return <X402Preview data={onboardingData} onNext={handleNext} onBack={handleBack} />;
      case 10:
        return (
          <Publish
            data={onboardingData}
            onBack={handleBack}
            onPublish={() => router.push('/dashboard/new-pub-123')}
          />
        );
      default:
        return <BasicInfo {...props} />;
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto p-8 flex gap-12">
      <div className="w-[300px] shrink-0 sticky top-24 self-start">
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
