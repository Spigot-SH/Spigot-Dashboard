'use client';

import type { OnboardingData } from '../../types/onboarding';
import React from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';

interface SkillSelectProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const AVAILABLE_SKILLS = [
  'AI',
  'LLM',
  'Vision',
  'OCR',
  'Audio',
  'Search',
  'Blockchain',
  'Payments',
  'Finance',
  'Translation',
  'Security',
  'Analytics',
  'Developer Tools',
  'Data',
  'Weather',
  'Social',
  'Communication',
  'Storage',
  'Maps',
];

const SkillSelect: React.FC<SkillSelectProps> = ({ data, updateData, onNext, onBack }) => {
  const selectedSkills: string[] = data.skills || [];

  const toggleSkill = (skill: string) => {
    if (selectedSkills.includes(skill)) {
      updateData({ skills: selectedSkills.filter(s => s !== skill) });
    } else {
      updateData({ skills: [...selectedSkills, skill] });
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card header="Skills & Categories" padding="lg">
        <div className="flex flex-col gap-6">
          <div>
            <p className="text-muted mb-2">
              Select the categories that best describe your API capabilities. This helps consumers
              discover your endpoints in the marketplace.
            </p>
            <p className="text-sm font-medium text-accent">(select at least 1)</p>
          </div>

          <div className="flex flex-wrap gap-3">
            {AVAILABLE_SKILLS.map(skill => (
              <div
                key={skill}
                onClick={() => toggleSkill(skill)}
                className={`chip ${selectedSkills.includes(skill) ? 'selected' : ''}`}
              >
                {skill}
              </div>
            ))}
          </div>

          {selectedSkills.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <span className="text-sm text-muted">Selected ({selectedSkills.length}): </span>
              <span className="text-sm font-medium">{selectedSkills.join(', ')}</span>
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-between mt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={onNext} disabled={selectedSkills.length === 0}>
          Continue to Pricing
        </Button>
      </div>
    </div>
  );
};

export default SkillSelect;
