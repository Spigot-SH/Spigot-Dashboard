'use client';

import type { OnboardingData } from '../../types/onboarding';
import { apiErrorMessage } from '../../lib/errors';
import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Button } from '../common/Button';
import { apiClient, type AuthConfig } from '../../api/client';

interface ApiInfoProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const ApiInfo: React.FC<ApiInfoProps> = ({ data, updateData, onNext, onBack }) => {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const authType = data.authType || 'NONE';

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!data.apiName) newErrors.apiName = 'API Name is required';
    if (!data.apiVersion) newErrors.apiVersion = 'Version is required';
    if (!data.baseUrl) {
      newErrors.baseUrl = 'Base URL is required';
    } else if (!/^https?:\/\//.test(data.baseUrl)) {
      newErrors.baseUrl = 'Must start with http:// or https://';
    }

    if (authType === 'API_KEY' && !data.apiKeyHeader)
      newErrors.apiKeyHeader = 'Header name is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateData({ [field]: e.target.value });
      if (errors[field]) setErrors({ ...errors, [field]: '' });
    };

  const [loading, setLoading] = useState(false);
  // A failed request is not a problem with the API Name field, which is where this used to
  // be printed.
  const [error, setError] = useState('');

  const handleContinue = async () => {
    if (validate()) {
      setLoading(true);
      setError('');
      try {
        const authConfig: AuthConfig = {};
        if (authType === 'API_KEY') {
          authConfig.header = data.apiKeyHeader;
          authConfig.value = data.apiKeyValue;
        } else if (authType === 'BEARER') {
          authConfig.token = data.bearerToken;
        } else if (authType === 'BASIC') {
          authConfig.username = data.basicUser;
          authConfig.password = data.basicPass;
        }

        const result = await apiClient.createApi({
          publisherId: data.publisherId,
          name: data.apiName,
          version: data.apiVersion,
          baseUrl: data.baseUrl,
          authType,
          authConfig,
          docsUrl: data.apiDocsUrl,
          rateLimitConfig: data.rateLimit
            ? { limit: parseInt(String(data.rateLimit)), window: 1 }
            : undefined,
        });

        updateData({ apiId: result.id, apiSlug: result.slug || result.id });
        onNext();
      } catch (err) {
        console.error('Failed to create API:', err);
        setError(apiErrorMessage(err, 'Could not save this API configuration.'));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card header="API Configuration" padding="lg">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col gap-4">
            <Input
              label="API Name *"
              placeholder="e.g., Weather Data API"
              value={data.apiName || ''}
              onChange={handleChange('apiName')}
              error={errors.apiName}
            />
            <Input
              label="Version *"
              placeholder="v1"
              value={data.apiVersion || ''}
              onChange={handleChange('apiVersion')}
              error={errors.apiVersion}
            />
            <Input
              label="Base URL *"
              placeholder="https://api.example.com/v1"
              type="url"
              value={data.baseUrl || ''}
              onChange={handleChange('baseUrl')}
              error={errors.baseUrl}
              helperText="The root URL where your endpoints reside."
            />
            <Input
              label="Documentation URL (Optional)"
              placeholder="https://docs.example.com"
              type="url"
              value={data.apiDocsUrl || ''}
              onChange={handleChange('apiDocsUrl')}
            />
          </div>

          <div className="flex flex-col gap-4">
            <Select
              label="Authentication Type"
              value={authType}
              onChange={handleChange('authType')}
            >
              {/*
                OAuth 2.0 and Custom used to be offered here, with a note saying they were
                configured "in the developer portal post-publishing". There is no such portal,
                and `PUT /apis/:id/publish` refuses both
                (`Spigot-Algorand/backend/src/routes/apis.ts:390`), because the gateway settles
                payment before it proxies: the caller would pay and then receive the upstream's
                401. Offering them cost a publisher every step up to publish before saying no.
              */}
              <option value="NONE">None (Public)</option>
              <option value="API_KEY">API Key</option>
              <option value="BEARER">Bearer Token</option>
              <option value="BASIC">Basic Auth</option>
            </Select>

            {/* Dynamic Auth Fields */}
            <div className="p-4 bg-bg border border-border rounded-lg mt-2">
              {authType === 'NONE' && (
                <p className="text-sm text-muted">
                  No authentication required to access your backend API. Spigot will still handle
                  publisher billing.
                </p>
              )}

              {authType === 'API_KEY' && (
                <div className="flex flex-col gap-4">
                  <Input
                    label="Header Name *"
                    placeholder="x-api-key"
                    value={data.apiKeyHeader || ''}
                    onChange={handleChange('apiKeyHeader')}
                    error={errors.apiKeyHeader}
                  />
                  <Input
                    label="API Key Value (for Gateway)"
                    type="password"
                    placeholder="Enter the key gateway should use"
                    value={data.apiKeyValue || ''}
                    onChange={handleChange('apiKeyValue')}
                  />
                </div>
              )}

              {authType === 'BEARER' && (
                <div className="flex flex-col gap-4">
                  <Input
                    label="Bearer Token"
                    type="password"
                    placeholder="ey..."
                    value={data.bearerToken || ''}
                    onChange={handleChange('bearerToken')}
                    helperText="Token to be sent in Authorization header"
                  />
                </div>
              )}

              {authType === 'BASIC' && (
                <div className="flex flex-col gap-4">
                  <Input
                    label="Username"
                    value={data.basicUser || ''}
                    onChange={handleChange('basicUser')}
                  />
                  <Input
                    label="Password"
                    type="password"
                    value={data.basicPass || ''}
                    onChange={handleChange('basicPass')}
                  />
                </div>
              )}
            </div>

            <div className="mt-4">
              <Input
                label="Global Rate Limit (req/sec)"
                type="number"
                placeholder="100"
                value={data.rateLimit || ''}
                onChange={handleChange('rateLimit')}
                helperText="Leave empty for unlimited"
              />
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <div className="p-3 bg-accent/10 text-accent text-sm rounded border border-accent/20 mt-4">
          {error}
        </div>
      )}

      <div className="flex justify-between mt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button variant="primary" onClick={handleContinue} disabled={loading} isLoading={loading}>
          Continue to Endpoints
        </Button>
      </div>
    </div>
  );
};

export default ApiInfo;
