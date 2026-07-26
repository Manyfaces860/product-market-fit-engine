'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Layers, ChevronRight, Activity, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { APP_COPY } from '@/lib/config/copy';
import { PageScanner } from '@/components/Loader';

interface Category {
  id: string;
  label: string;
  description: string;
  clusterCount: number;
  problemCount: number;
}

export default function BrowsePage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCategories() {
      try {
        const res = await fetch('/api/categories');
        if (res.ok) {
          const data = await res.json();
          setCategories(data);
        }
      } catch (err) {
        console.error('Failed to load categories:', err);
      } finally {
        setLoading(false);
      }
    }
    loadCategories();
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      
      {/* Header */}
      <div className="mb-12 text-center md:text-left">
        <span className="font-mono text-[10px] tracking-[0.3em] text-amber-500 uppercase font-bold">
          Market Verticals
        </span>
        <h1 className="mt-2 text-3xl sm:text-5xl font-display font-bold italic tracking-tight text-slate-100">
          {APP_COPY.browse.title}
        </h1>
        <p className="mt-3 max-w-2xl text-slate-400 text-sm">
          {APP_COPY.browse.subtitle}
        </p>
      </div>

      {/* Grid */}
      {loading ? (
        <PageScanner message="Compiling niche market counts..." />
      ) : categories.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.map((cat, idx) => (
            <motion.div
              key={cat.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05, duration: 0.4 }}
            >
              <Link
                href={`/browse/${cat.id}`}
                className="group flex flex-col justify-between h-56 p-6 bg-slate-900/40 border border-white/5 rounded-2xl hover:bg-slate-900/75 hover:border-white/10 transition-all duration-300 shadow-xl"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="p-2.5 rounded-lg bg-white/5 text-amber-500 group-hover:bg-amber-500/10 group-hover:text-amber-400 transition-colors">
                      <Layers className="h-5 w-5" />
                    </div>
                    
                    {/* Stats Pill */}
                    <div className="flex items-center gap-3 font-mono text-[10px] tracking-wider text-slate-500 uppercase">
                      <span className="text-slate-400 font-semibold bg-white/5 px-2 py-0.5 rounded">
                        {cat.clusterCount} {cat.clusterCount === 1 ? 'cluster' : 'clusters'}
                      </span>
                    </div>
                  </div>

                  <h2 className="text-lg font-bold font-sans text-slate-200 group-hover:text-slate-100 transition-colors">
                    {cat.label}
                  </h2>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed line-clamp-2">
                    {cat.description}
                  </p>
                </div>

                <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between font-mono text-[9px] tracking-widest uppercase">
                  <span className="text-slate-500 flex items-center gap-1">
                    <Activity className="h-3 w-3 text-teal-500" />
                    {cat.problemCount} combined voices
                  </span>
                  <span className="text-amber-500 group-hover:text-amber-400 flex items-center gap-0.5 group-hover:translate-x-0.5 transition-all">
                    Open <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="text-center py-24 border border-dashed border-white/5 rounded-2xl p-8 max-w-xl mx-auto">
          <p className="font-mono text-sm text-slate-400">No active categories found.</p>
          <p className="text-xs text-slate-500 mt-2">Submit a problem on the home page or click "Seed Data" to populate sample clusters.</p>
          <Link
            href="/"
            className="inline-block mt-6 font-mono text-xs font-bold uppercase bg-amber-500 text-slate-950 px-4 py-2 rounded-lg hover:bg-amber-600 transition-all"
          >
            Submit First Problem
          </Link>
        </div>
      )}

    </div>
  );
}
