'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Search, Clock, ShieldCheck } from 'lucide-react';
import { MarketplaceApi } from '../api/client';
import { normaliseApi } from '../api/marketplace';

interface MarketplaceProps {
  /** Fetched server-side in app/page.tsx so the listing is in the HTML for crawlers. */
  initialApis: MarketplaceApi[];
}

const Marketplace: React.FC<MarketplaceProps> = ({ initialApis }) => {
  const [apis, setApis] = useState<MarketplaceApi[]>(initialApis);
  const [search, setSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/apis')
      .then(res => (res.ok ? res.json() : []))
      .then((data: unknown) => {
        if (Array.isArray(data) && data.length > 0) {
          setApis(data.map(item => normaliseApi(item as Record<string, unknown>)));
        }
      })
      .catch(() => null);
  }, []);

  const skills = [
    'Finance',
    'Stellar',
    'Solana',
    'EVM',
    'AI',
    'Data',
    'Blockchain',
    'Weather',
    'Payments',
  ];

  const filteredApis = apis.filter(api => {
    const matchesSearch =
      api.name.toLowerCase().includes(search.toLowerCase()) ||
      api.description.toLowerCase().includes(search.toLowerCase()) ||
      api.skills.some(s => s.toLowerCase().includes(search.toLowerCase()));
    const matchesSkill = selectedSkill
      ? api.skills.some(s => s.toLowerCase() === selectedSkill.toLowerCase())
      : true;
    return matchesSearch && matchesSkill;
  });

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero Section */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-16">
        <h1 className="text-3xl sm:text-4xl md:text-5xl mb-6 tracking-tight text-balance">
          Discover Premium APIs.{' '}
          <span className="text-accent block sm:inline">Pay only for what you call.</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-muted mb-8 text-pretty">
          Browse data and services you can call without a subscription or a signup. Every request is
          metered, so you pay for exactly what you use — nothing more.
        </p>

        <div className="relative max-w-2xl mx-auto">
          <Search
            className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted"
            size={20}
          />
          <input
            type="text"
            placeholder="Search for AI, weather, finance APIs..."
            className="w-full bg-panel border-2 border-border rounded-full py-3 sm:py-4 pl-12 pr-6 text-base sm:text-lg focus:outline-none focus:border-accent shadow-lg"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-10 overflow-x-auto pb-4">
        <span className="text-muted font-medium mr-2 whitespace-nowrap">Filter by Category:</span>
        <button
          onClick={() => setSelectedSkill(null)}
          className={`px-4 py-1.5 rounded-full text-sm font-medium border ${!selectedSkill ? 'bg-accent text-bg border-transparent' : 'bg-panel border-border hover:bg-panel-hover'}`}
        >
          All
        </button>
        {skills.map(skill => (
          <button
            key={skill}
            onClick={() => setSelectedSkill(skill)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border ${selectedSkill === skill ? 'bg-accent text-bg border-transparent' : 'bg-panel border-border hover:bg-panel-hover'}`}
          >
            {skill}
          </button>
        ))}
      </div>

      {/* Grid */}
      {/* No loading branch: the listing arrives with the HTML from app/page.tsx. */}
      {filteredApis.length === 0 ? (
        <div className="text-center py-20 bg-panel rounded-xl border border-border">
          <h3 className="text-xl mb-2">No APIs found</h3>
          <p className="text-muted">Try adjusting your search or filters.</p>
          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => {
              setSearch('');
              setSelectedSkill(null);
            }}
          >
            Clear Filters
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredApis.map(api => (
            <Card key={api.id} hoverable padding="lg" className="flex flex-col h-full">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-lg bg-accent flex items-center justify-center text-bg text-xl shadow-lg">
                  {api.name.substring(0, 1)}
                </div>
                <div className="flex gap-1 flex-wrap justify-end max-w-[120px]">
                  {api.skills.slice(0, 2).map(s => (
                    <span
                      key={s}
                      className="text-[10px] uppercase bg-bg px-2 py-1 rounded border border-border"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              <h3 className="text-lg mb-1">{api.name}</h3>
              <p className="text-xs text-accent mb-3 font-medium">by {api.publisherName}</p>

              <p className="text-sm text-muted mb-6 flex-1">{api.description}</p>

              <div className="grid grid-cols-2 gap-2 mb-6">
                <div className="bg-bg p-2 rounded flex flex-col items-center justify-center border border-border">
                  <div className="flex items-center gap-1 text-xs text-muted mb-1">
                    <Clock size={12} /> Latency
                  </div>
                  <div className="font-mono text-sm">{api.avgLatency}ms</div>
                </div>
                <div className="bg-bg p-2 rounded flex flex-col items-center justify-center border border-border">
                  <div className="flex items-center gap-1 text-xs text-muted mb-1">
                    <ShieldCheck size={12} /> Uptime
                  </div>
                  <div className="font-mono text-sm text-accent">{api.uptime}%</div>
                </div>
              </div>

              <div className="border-t border-border pt-4 mt-auto flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs text-muted">Price per request</span>
                  <span className="font-mono text-accent">{api.pricePerRequest}</span>
                </div>
                <Link href={`/test/${api.slug}`}>
                  <Button size="sm">Try API</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Marketplace;
