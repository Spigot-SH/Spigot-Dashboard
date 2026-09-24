'use client';

import type { OnboardingData } from '../../types/onboarding';
import { apiErrorMessage } from '../../lib/errors';
import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { apiClient, setPublisherId } from '../../api/client';

interface BasicInfoProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
}

const BasicInfo: React.FC<BasicInfoProps> = ({ data, updateData, onNext }) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!data.publisherName) newErrors.publisherName = 'Publisher name is required';
    if (!data.domain) {
      newErrors.domain = 'Domain is required';
    } else {
      // Strip protocol and path to validate the hostname
      const hostname = data.domain.replace(/^https?:\/\//, '').split('/')[0];
      if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(hostname)) {
        newErrors.domain =
          'Invalid domain format (e.g. api.example.com or https://api.example.com/v1)';
      }
    }
    if (!data.email) {
      newErrors.email = 'Email is required';
    } else if (!/^\S+@\S+\.\S+$/.test(data.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (data.website && !/^https?:\/\//.test(data.website)) {
      newErrors.website = 'URL must start with http:// or https://';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange =
    (field: string) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      updateData({ [field]: e.target.value });
      if (errors[field]) setErrors({ ...errors, [field]: '' });
    };

  const [loading, setLoading] = useState(false);
  // A failed request is not a problem with the Publisher Name field, which is where this
  // used to be printed. It belongs beside the button that made the request.
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (validate()) {
      setLoading(true);
      setError('');
      try {
        const result = await apiClient.registerPublisher({
          name: data.publisherName,
          email: data.email,
          type: data.type || 'Company',
          website: data.website || '',
          domain: data.domain,
          description: data.description,
          logoUrl: data.logoUrl,
          githubUrl: data.githubUrl,
        });
        updateData({ publisherId: result.id, apiKey: result.api_key });
        setPublisherId(result.id!);
        onNext();
      } catch (err) {
        console.error(err);
        setError(apiErrorMessage(err, 'Could not create your publisher account.'));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card header="Publisher Details" padding="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <Input
              label="Publisher Name *"
              placeholder="Company or Individual Name"
              value={data.publisherName || ''}
              onChange={handleChange('publisherName')}
              error={errors.publisherName}
            />

            <Select label="Type" value={data.type || 'Company'} onChange={handleChange('type')}>
              <option value="Company">Company</option>
              <option value="Individual">Individual</option>
            </Select>

            <Input
              label="Description"
              as="textarea"
              placeholder="Describe your organization and the APIs you provide..."
              value={data.description || ''}
              onChange={handleChange('description')}
            />
          </div>

          <div className="flex flex-col gap-4">
            <Input
              label="Primary Domain *"
              placeholder="api.example.com"
              value={data.domain || ''}
              onChange={handleChange('domain')}
              error={errors.domain}
              helperText="This domain will be verified in the next step"
            />
            <Input
              label="Contact Email *"
              type="email"
              placeholder="api@example.com"
              value={data.email || ''}
              onChange={handleChange('email')}
              error={errors.email}
            />
            <Input
              label="Website URL"
              placeholder="https://..."
              type="url"
              value={data.website || ''}
              onChange={handleChange('website')}
              error={errors.website}
            />
          </div>
        </div>

        <div className="border-t border-border mt-6 pt-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <Input
            label="Logo URL (Optional)"
            placeholder="https://.../logo.png"
            value={data.logoUrl || ''}
            onChange={handleChange('logoUrl')}
          />
          <Input
            label="GitHub Organization (Optional)"
            placeholder="https://github.com/..."
            value={data.githubUrl || ''}
            onChange={handleChange('githubUrl')}
          />
        </div>
      </Card>

      {error && (
        <div className="p-3 bg-accent/10 text-accent text-sm rounded border border-accent/20 mt-4">
          {error}
        </div>
      )}

      <div className="flex justify-end mt-4">
        <Button variant="primary" onClick={handleContinue} disabled={loading} isLoading={loading}>
          Continue to Verification
        </Button>
      </div>
    </div>
  );
};

export default BasicInfo;
