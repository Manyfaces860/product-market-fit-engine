'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers, ChevronRight, TrendingUp, Users, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { APP_COPY } from '@/lib/config/copy';
import { PageScanner } from '@/components/Loader';
import staticCategories from '@/lib/ai/static-categories';

interface Cluster {
  id: string;
  category: string;
  categoryLabel: string;
  categoryDescription: string;
  canonicalText: string;
  memberCount: number;
  sampleVariants: string[];
}

export default function CategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = use(params);
  let categoryDes;
  for (let i = 0 ; i < staticCategories.length ; i++) {
    if (staticCategories[i].id == category) {
      categoryDes = staticCategories[i].label
    }
  }
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function loadCategoryClusters() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/clusters?category=${category}`);
        if (!res.ok) {
          throw new Error('Failed to retrieve categories data.');
        }
        const data = await res.json();
        setClusters(data || []);
      } catch (err) {
        console.error('Failed to load category clusters:', err);
        setError('We are experiencing temporary database latency.');
      } finally {
        setLoading(false);
      }
    }
    loadCategoryClusters();
  }, [category, refreshTrigger]);

  const activeCategory = clusters[0] || null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      
      {/* Back navigation */}
      <div className="mb-6">
        <Link
          href="/browse"
          className="inline-flex items-center gap-2 font-mono text-xs text-slate-400 hover:text-slate-100 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          {APP_COPY.browse.backLink}
        </Link>
      </div>

      {/* Header */}
      <div className="mb-12 border-b border-white/5 pb-8">
        <span className="font-mono text-[10px] tracking-[0.3em] text-amber-500 uppercase font-bold flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5" /> Market Segment
        </span>
        <h1 className="mt-2 text-3xl sm:text-5xl font-display font-bold italic tracking-tight text-slate-100">
          {activeCategory?.categoryLabel || category.replace('-', ' ')}
        </h1>
        <p className="mt-3 max-w-3xl text-slate-400 text-sm sm:text-base leading-relaxed">
          {activeCategory?.categoryDescription || 'A collection of shared customer frustrations and product gaps.'}
        </p>
      </div>

      {/* Clusters List */}
      {loading ? (
        <PageScanner message="Querying customer complaints..." />
      ) : error ? (
        <div className="text-center py-20 px-4 select-none animate-fade-in max-w-xl mx-auto">
          <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4 animate-pulse" />
          <h2 className="text-xl font-bold font-sans text-slate-200">Error Loading Opportunities</h2>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">{error}</p>
          <div className="mt-8 flex gap-4 justify-center">
            <Link
              href="/browse"
              className="font-mono text-xs font-bold uppercase bg-white/5 hover:bg-white/10 px-5 py-2.5 rounded-xl border border-white/5 text-slate-200 cursor-pointer"
            >
              Return to Browse
            </Link>
            <button
              onClick={() => {
                setError(null);
                setLoading(true);
                setRefreshTrigger(prev => prev + 1);
              }}
              className="font-mono text-xs font-bold uppercase bg-gradient-to-r from-brand-amber to-brand-coral text-slate-950 px-5 py-2.5 rounded-xl cursor-pointer"
            >
              Retry Load
            </button>
          </div>
        </div>
      ) : clusters.length > 0 ? (
        <div className="space-y-6">
          {clusters.map((cluster, idx) => {
            // Determine a visual "strength indicator" color based on memberCount
            let strengthColor = 'bg-teal-500/20 text-teal-400 border-teal-500/30';
            if (cluster.memberCount > 25) {
              strengthColor = 'bg-red-500/20 text-red-400 border-red-500/30';
            } else if (cluster.memberCount > 10) {
              strengthColor = 'bg-amber-500/20 text-amber-400 border-amber-500/30';
            }

            return (
              <motion.div
                key={cluster.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05, duration: 0.4 }}
              >
                <Link
                  href={`/cluster/${cluster.id}`}
                  className="group block p-6 bg-slate-900/40 border border-white/5 rounded-2xl hover:bg-slate-900/70 hover:border-white/10 transition-all duration-300 shadow-xl"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    
                    {/* Content Section */}
                    <div className="flex-grow space-y-2">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase border ${strengthColor}`}>
                          Signal Count: {cluster.memberCount}
                        </span>
                        
                        {/* Trend indicator */}
                        <span className="font-mono text-[9px] text-slate-500 uppercase flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-emerald-500" /> Active
                        </span>
                      </div>

                      <h2 className="text-lg sm:text-xl font-bold font-sans text-slate-200 group-hover:text-slate-100 transition-colors">
                        "{cluster.canonicalText}"
                      </h2>

                      <p className="font-mono text-[10px] text-slate-500 uppercase tracking-wide">
                        CO-SIGNERS PHRASED THIS IN {cluster.sampleVariants.length} DISTINCT WAYS
                      </p>
                    </div>

                    {/* Action Arrow */}
                    <div className="shrink-0 flex items-center justify-end">
                      <span className="font-mono text-[11px] text-amber-500 group-hover:text-amber-400 flex items-center gap-1 group-hover:translate-x-1 transition-all cursor-pointer">
                        Details <ChevronRight className="h-4 w-4" />
                      </span>
                    </div>

                  </div>
                </Link>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-24 border border-dashed border-white/5 rounded-2xl max-w-xl mx-auto p-8">
          <p className="font-mono text-sm text-slate-400">NeedBoard just opened here. Report the first "{categoryDes}" problem and put this vertical on the map.</p>
          <Link
            href="/submit"
            className="inline-block mt-6 font-mono text-xs font-bold uppercase bg-amber-500 text-slate-950 px-4 py-2 rounded-lg hover:bg-amber-600 transition-all"
          >
            Submit First Problem
          </Link>
        </div>
      )}

    </div>
  );
}
