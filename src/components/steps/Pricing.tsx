'use client';

import type { OnboardingData } from '../../types/onboarding';
import { errorMessage } from '../../lib/errors';
import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Wallet } from 'lucide-react';
import { apiClient } from '../../api/client';

interface PricingProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const Pricing: React.FC<PricingProps> = ({ data, updateData, onNext, onBack }) => {
  const [model, setModel] = useState<'PayPerUse' | 'Subscription'>(
    data.pricingModel || 'PayPerUse',
  );
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (model === 'PayPerUse' && !data.pricePerRequest) {
      newErrors.pricePerRequest = 'Price per request is required';
    }

    if (model === 'Subscription') {
      if (!data.monthlyPrice) newErrors.monthlyPrice = 'Monthly price is required';
      if (!data.includedRequests) newErrors.includedRequests = 'Included requests is required';
    }

    const chain = data.settlementChain || 'Algorand';
    if (!data.settlementAddress) {
      newErrors.settlementAddress = 'Address is required';
    } else if (chain === 'Algorand') {
      if (data.settlementAddress.length !== 58) {
        newErrors.settlementAddress = 'Algorand address must be exactly 58 characters';
      }
    } else if (chain === 'Solana') {
      if (data.settlementAddress.length < 32 || data.settlementAddress.length > 44) {
        newErrors.settlementAddress = 'Solana address must be between 32 and 44 characters';
      }
    } else if (chain === 'Stellar') {
      if (!/^G[A-Z0-9]{55}$/.test(data.settlementAddress)) {
        newErrors.settlementAddress = 'Stellar address must start with G and be 56 characters';
      }
    } else {
      if (!/^0x[0-9a-fA-F]{40}$/.test(data.settlementAddress)) {
        newErrors.settlementAddress = 'Must be a valid 42-character EVM address (e.g. 0x...)';
      }
    }

    if (!data.minPayout) newErrors.minPayout = 'Minimum payout is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange =
    (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      updateData({ [field]: e.target.value });
      if (errors[field]) setErrors({ ...errors, [field]: '' });
    };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleNext = async () => {
    if (validate()) {
      setLoading(true);
      setError('');
      try {
        if (!data.apiId) throw new Error('No API registered yet.');
        await apiClient.setPricing(data.apiId, {
          model: model === 'PayPerUse' ? 'PAY_PER_USE' : 'SUBSCRIPTION',
          price_per_request: parseFloat(String(data.pricePerRequest ?? 0)),
          currency: 'USDC',
          monthly_price: parseFloat(String(data.monthlyPrice ?? 0)),
          included_requests: parseInt(String(data.includedRequests ?? 0)),
          overage_price: parseFloat(String(data.overagePrice ?? 0)),
        });

        if (!data.publisherId) throw new Error('No publisher account yet.');
        // This is where revenue is paid out. An empty address must never reach the server.
        if (!data.settlementAddress) throw new Error('A settlement address is required.');
        await apiClient.setWallet(data.publisherId, {
          address: data.settlementAddress,
          chain: (data.settlementChain || 'ALGORAND').toUpperCase(),
          settlement_frequency: data.settlementFrequency?.toLowerCase() || 'weekly',
          min_payout: parseFloat(String(data.minPayout ?? 10)),
        });

        onNext();
      } catch (err) {
        setError(errorMessage(err, 'Failed to save pricing configuration'));
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card header="Pricing & Settlement Model" padding="lg">
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between p-4 bg-bg rounded-lg border border-border">
            <div>
              <h4 className="font-medium">Pricing Model</h4>
              <p className="text-sm text-muted">Choose how consumers pay for your API.</p>
            </div>
            <div className="flex items-center gap-3 bg-panel p-1 rounded-full border border-border">
              <button
                onClick={() => {
                  setModel('PayPerUse');
                  updateData({ pricingModel: 'PayPerUse' });
                }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium ${model === 'PayPerUse' ? 'bg-accent text-bg shadow' : 'text-muted hover:text-main'}`}
              >
                Pay Per Use
              </button>
              <button
                onClick={() => {
                  setModel('Subscription');
                  updateData({ pricingModel: 'Subscription' });
                }}
                className={`px-4 py-1.5 rounded-full text-sm font-medium ${model === 'Subscription' ? 'bg-accent text-bg shadow' : 'text-muted hover:text-main'}`}
              >
                Subscription
              </button>
            </div>
          </div>

          <div className="p-6 border border-border rounded-lg bg-[rgba(255,255,255,0.02)]">
            {model === 'PayPerUse' ? (
              <div className=" max-w-md">
                <h4 className="mb-4">Pay Per Use Configuration</h4>
                <div className="relative">
                  <Input
                    label="Price per Request (USDC)"
                    type="number"
                    step="0.0001"
                    placeholder="0.001"
                    value={data.pricePerRequest || ''}
                    onChange={handleChange('pricePerRequest')}
                    error={errors.pricePerRequest}
                  />
                  <div className="absolute right-3 top-[34px] text-muted text-sm pointer-events-none">
                    USDC
                  </div>
                </div>
                <p className="text-xs text-muted mt-2">Example: 0.001 USDC per API call.</p>
              </div>
            ) : (
              <div className=" grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="col-span-2">
                  <h4 className="mb-4">Subscription Configuration</h4>
                </div>
                <div className="relative">
                  <Input
                    label="Monthly Price (USDC)"
                    type="number"
                    placeholder="49.99"
                    value={data.monthlyPrice || ''}
                    onChange={handleChange('monthlyPrice')}
                    error={errors.monthlyPrice}
                  />
                  <div className="absolute right-3 top-[34px] text-muted text-sm pointer-events-none">
                    USDC/mo
                  </div>
                </div>
                <Input
                  label="Included Requests per Month"
                  type="number"
                  placeholder="100000"
                  value={data.includedRequests || ''}
                  onChange={handleChange('includedRequests')}
                  error={errors.includedRequests}
                />
                <div className="col-span-2 max-w-md relative">
                  <Input
                    label="Overage Price per Request (USDC)"
                    type="number"
                    step="0.0001"
                    placeholder="0.0005"
                    value={data.overagePrice || ''}
                    onChange={handleChange('overagePrice')}
                  />
                  <div className="absolute right-3 top-[34px] text-muted text-sm pointer-events-none">
                    USDC
                  </div>
                </div>
              </div>
            )}
          </div>

          <div>
            <h4 className="flex items-center gap-2 mb-4">
              <Wallet size={18} className="text-accent" />
              Settlement Configuration
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="col-span-2">
                <Select
                  label="Settlement Chain"
                  value={data.settlementChain || 'Algorand'}
                  onChange={handleChange('settlementChain')}
                >
                  <option>Algorand</option>
                  <option>Solana</option>
                  <option>Stellar</option>
                  <option>Ethereum</option>
                  <option>Base</option>
                  <option>Arbitrum</option>
                  <option>Optimism</option>
                  <option>Avalanche</option>
                  <option>Robinhood</option>
                </Select>
              </div>

              <div className="col-span-2">
                <Input
                  label={
                    data.settlementChain === 'Algorand' || !data.settlementChain
                      ? 'Algorand Settlement Address *'
                      : data.settlementChain === 'Solana'
                        ? 'Solana Settlement Address *'
                        : data.settlementChain === 'Stellar'
                          ? 'Stellar Settlement Address *'
                          : 'EVM Settlement Address *'
                  }
                  placeholder={
                    data.settlementChain === 'Algorand' || !data.settlementChain
                      ? 'ALGO...'
                      : data.settlementChain === 'Solana'
                        ? 'Base58 Solana address...'
                        : data.settlementChain === 'Stellar'
                          ? 'G...'
                          : '0x...'
                  }
                  value={data.settlementAddress || ''}
                  onChange={handleChange('settlementAddress')}
                  error={errors.settlementAddress}
                  helperText={`Earnings will be deposited into this wallet in USDC on ${data.settlementChain || 'Algorand'}.`}
                />
              </div>

              <Select
                label="Settlement Frequency"
                value={data.settlementFrequency || 'Daily'}
                onChange={handleChange('settlementFrequency')}
              >
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </Select>

              <div className="relative">
                <Input
                  label="Minimum Payout Threshold"
                  type="number"
                  placeholder="10"
                  value={data.minPayout || '10'}
                  onChange={handleChange('minPayout')}
                  error={errors.minPayout}
                />
                <div className="absolute right-3 top-[34px] text-muted text-sm pointer-events-none">
                  USDC
                </div>
              </div>
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
        <Button variant="primary" onClick={handleNext} disabled={loading} isLoading={loading}>
          Continue to Testing
        </Button>
      </div>
    </div>
  );
};

export default Pricing;
