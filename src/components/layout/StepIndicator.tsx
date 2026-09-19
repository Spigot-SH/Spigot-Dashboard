'use client';

import React from 'react';
import { Check } from 'lucide-react';

interface Step {
  id: number;
  name: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({ steps, currentStep }) => {
  return (
    <div className="flex flex-col gap-4 relative">
      {steps.map((step, index) => {
        const isCompleted = step.id < currentStep;
        const isActive = step.id === currentStep;

        return (
          <div
            key={step.id}
            className={`flex items-start gap-4 relative z-10 ${isActive ? 'opacity-100' : isCompleted ? 'opacity-70' : 'opacity-40'}`}
          >
            <div
              className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium z-10 border-2
              ${
                isCompleted
                  ? 'bg-main text-bg border-main'
                  : isActive
                    ? 'bg-transparent text-main border-main shadow-[0_0_10px_rgba(255,255,255,0.1)]'
                    : 'bg-panel text-muted border-border'
              }`}
            >
              {isCompleted ? <Check size={14} strokeWidth={3} /> : step.id}
            </div>
            <div className="flex flex-col mt-0.5">
              <div
                className={`text-xs uppercase tracking-wider mb-1 ${isActive ? 'text-main' : 'text-muted'}`}
              >
                Step {step.id}
              </div>
              <div className={`text-sm ${isActive ? 'text-main' : 'text-muted'}`}>{step.name}</div>
            </div>
            {index < steps.length - 1 && (
              <div
                className={`absolute left-4 top-8 w-px h-6 -translate-x-1/2 ${isCompleted ? 'bg-main' : 'bg-border'}`}
              ></div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default StepIndicator;
