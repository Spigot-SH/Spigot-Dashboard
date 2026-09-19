'use client';

import type { OnboardingData } from '../../types/onboarding';
import { errorMessage } from '../../lib/errors';
import React, { useState } from 'react';
import { Card } from '../common/Card';
import { Button } from '../common/Button';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Table, Th, Td } from '../common/Table';
import { Plus, Trash2 } from 'lucide-react';
import { ApiEndpoint, apiClient } from '../../api/client';
import { FileUpload } from '../common/FileUpload';

interface ImportEndpointsProps {
  data: OnboardingData;
  updateData: (updates: Partial<OnboardingData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const ImportEndpoints: React.FC<ImportEndpointsProps> = ({ data, updateData, onNext, onBack }) => {
  const [activeTab, setActiveTab] = useState<'import' | 'manual'>('import');
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>(data.endpoints || []);
  const [specUrl, setSpecUrl] = useState('');

  // Manual entry state
  const [mName, setMName] = useState('');
  const [mMethod, setMMethod] = useState<HttpMethod>('GET');
  const [mPath, setMPath] = useState('');
  const [mDesc, setMDesc] = useState('');

  const handleAddManual = () => {
    if (!mName || !mPath) return;
    const newEndpoint: ApiEndpoint = {
      name: mName,
      method: mMethod,
      path: mPath,
      description: mDesc,
    };
    const updated = [...endpoints, newEndpoint];
    setEndpoints(updated);
    updateData({ endpoints: updated });

    // Reset manual form
    setMName('');
    setMPath('');
    setMDesc('');
  };

  const removeEndpoint = (index: number) => {
    const updated = [...endpoints];
    updated.splice(index, 1);
    setEndpoints(updated);
    updateData({ endpoints: updated });
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSpecFile = async (file: File) => {
    if (!data.apiId) {
      setError('Register the API first — the import needs somewhere to attach the endpoints.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      const result = await apiClient.importEndpoints(data.apiId, await file.text());
      const updated = [...endpoints, ...(result.endpoints || [])];
      setEndpoints(updated);
      updateData({ endpoints: updated });
    } catch (err) {
      setError(errorMessage(err, 'Failed to read that specification'));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!specUrl || !data.apiId) return;
    try {
      setLoading(true);
      setError('');
      const result = await apiClient.importEndpoints(data.apiId, specUrl);
      const newEndpoints = result.endpoints || [];
      const updated = [...endpoints, ...newEndpoints];
      setEndpoints(updated);
      updateData({ endpoints: updated });
    } catch (err) {
      setError(errorMessage(err, 'Failed to import endpoints'));
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (endpoints.length === 0) return;
    try {
      setLoading(true);
      setError('');
      if (!data.apiId) {
        throw new Error('No API registered yet — complete the API configuration step first.');
      }
      await apiClient.updateApiEndpoints(data.apiId, endpoints);
      onNext();
    } catch (err) {
      setError(errorMessage(err, 'Failed to save endpoints'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card padding="none">
        <div className="flex border-b border-border">
          <button
            className={`px-6 py-4 font-medium ${activeTab === 'import' ? 'text-accent border-b-2 border-accent bg-accent/5' : 'text-muted hover:text-main'}`}
            onClick={() => setActiveTab('import')}
          >
            Import OpenAPI
          </button>
          <button
            className={`px-6 py-4 font-medium ${activeTab === 'manual' ? 'text-accent border-b-2 border-accent bg-accent/5' : 'text-muted hover:text-main'}`}
            onClick={() => setActiveTab('manual')}
          >
            Manual Entry
          </button>
        </div>

        <div className="p-6">
          {activeTab === 'import' ? (
            <div className="flex flex-col gap-6">
              {/* This was a dashed box whose Button had no handler, with no file input behind
                  it anywhere: it looked droppable and did nothing. `importEndpoints` accepts
                  the spec body as well as a URL, so the file contents go straight through the
                  endpoint that already exists. */}
              <FileUpload
                accept=".json,.yaml,.yml"
                maxBytes={2_000_000}
                label="OpenAPI Specification"
                hint="JSON or YAML (Swagger 2.0 / OpenAPI 3.0), up to 2 MB"
                disabled={loading}
                onFile={handleSpecFile}
              />

              <div className="flex items-center gap-4">
                <div className="h-px bg-border flex-1"></div>
                <span className="text-sm text-muted uppercase tracking-wider">or</span>
                <div className="h-px bg-border flex-1"></div>
              </div>

              <div className="flex gap-4 items-end">
                <div className="flex-1">
                  <Input
                    label="OpenAPI Spec URL"
                    placeholder="https://..."
                    value={specUrl}
                    onChange={e => setSpecUrl(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleImport}
                  disabled={loading}
                  isLoading={loading}
                  className="mb-4"
                >
                  Import URL
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4 bg-bg p-4 border border-border rounded-lg">
              <div className="grid grid-cols-[120px_1fr] gap-4">
                <Select
                  label="Method"
                  value={mMethod}
                  onChange={e => setMMethod(e.target.value as HttpMethod)}
                >
                  {HTTP_METHODS.map(m => (
                    <option key={m}>{m}</option>
                  ))}
                </Select>
                <Input
                  label="Path"
                  placeholder="/api/v1/resource"
                  value={mPath}
                  onChange={e => setMPath(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Endpoint Name"
                  placeholder="Get Resource"
                  value={mName}
                  onChange={e => setMName(e.target.value)}
                />
                <Input
                  label="Description"
                  placeholder="What does this do?"
                  value={mDesc}
                  onChange={e => setMDesc(e.target.value)}
                />
              </div>
              <div className="flex justify-end">
                <Button variant="secondary" onClick={handleAddManual} disabled={!mName || !mPath}>
                  <Plus size={16} /> Add Endpoint
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {endpoints.length > 0 && (
        <Card header={`Added Endpoints (${endpoints.length})`} padding="md">
          <Table className="rounded-lg border border-border bg-panel">
            <thead>
              <tr>
                <Th>Method</Th>
                <Th>Path</Th>
                <Th>Name</Th>
                <Th>Action</Th>
              </tr>
            </thead>
            <tbody>
              {endpoints.map((ep, i) => (
                <tr key={i}>
                  <Td>
                    {/* Read-only methods stay neutral; only the destructive and
                          state-changing ones earn a colour. `text-bg` here was black text on
                          a 10%-white fill, which is invisible in dark mode. */}
                    <span
                      className={`px-2 py-1 rounded text-xs font-mono ${
                        ep.method === 'GET'
                          ? 'bg-panel-hover text-main'
                          : ep.method === 'POST'
                            ? 'bg-accent/20 text-accent'
                            : ep.method === 'DELETE'
                              ? 'bg-error/20 text-error'
                              : 'bg-warning/20 text-warning'
                      }`}
                    >
                      {ep.method}
                    </span>
                  </Td>
                  <Td mono>{ep.path}</Td>
                  <Td>{ep.name}</Td>
                  <Td>
                    <button
                      onClick={() => removeEndpoint(i)}
                      className="text-muted hover:text-accent"
                    >
                      <Trash2 size={16} />
                    </button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {endpoints.length < 5 && (
            <p className="text-sm text-accent-dim mt-4">
              Note: Minimum 5 endpoints recommended for publication.
            </p>
          )}
        </Card>
      )}

      {error && (
        <div className="p-3 bg-accent/10 text-accent text-sm rounded border border-accent/20 mt-4">
          {error}
        </div>
      )}

      <div className="flex justify-between mt-4">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button
          variant="primary"
          onClick={handleContinue}
          disabled={endpoints.length === 0 || loading}
          isLoading={loading}
        >
          Continue to Configuration
        </Button>
      </div>
    </div>
  );
};

/* The options and the state share one source. Previously the handler was typed `any`,
 * which hid the fact that `e.target.value` is a plain string and cannot be assigned to
 * the state's union. */
const HTTP_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const;
type HttpMethod = (typeof HTTP_METHODS)[number];

export default ImportEndpoints;
