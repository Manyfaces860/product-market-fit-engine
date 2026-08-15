'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, ArrowRight, AlertTriangle, ChevronRight, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_COPY } from '@/lib/config/copy';
import { PageScanner } from '@/components/Loader';
import { useAuth, SignInButton } from '@/lib/clerk';

const MAX_QUERY_CHARS = 500;

interface Cluster {
  id: string;
  category: string;
  categoryLabel: string;
  categoryDescription: string;
  canonicalText: string;
  memberCount: number;
  sampleVariants: string[];
  score?: number;
}

export default function SearchPage() {
  const { isSignedIn } = useAuth();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isQueryTooLong = query.length > MAX_QUERY_CHARS;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim() === '') return;
    if (isQueryTooLong) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'An error occurred during semantic matching.');
      }
      const contentType = res.headers.get("content-type");

      if (contentType && !contentType.includes("application/json")) {
        console.log("error happend without sign in")
        throw new Error("You must be signed in to perform searches.");
      }

      setResults(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      
      {/* Header */}
      <div className="mb-10 text-center">
        <span className="font-mono text-[10px] tracking-[0.3em] text-teal-500 uppercase font-bold">
          Validation Search
        </span>
        <h1 className="mt-2 text-3xl sm:text-5xl font-display font-bold italic tracking-tight text-slate-100">
          {APP_COPY.search.title}
        </h1>
        <p className="mt-3 mx-auto max-w-xl text-slate-400 text-sm">
          {APP_COPY.search.subtitle}
        </p>
      </div>

      {/* Search Input Box */}
      <div className="max-w-2xl mx-auto mb-16">
        <form 
          onSubmit={handleSearch}
          className="relative p-1.5 bg-slate-900/60 border border-white/10 focus-within:border-teal-500/50 hover:border-white/20 rounded-2xl shadow-2xl backdrop-blur-xl flex items-center transition-all duration-300 focus-within:shadow-[0_0_30px_rgba(20,184,166,0.15)] focus-within:bg-slate-900/80"
        >
          <div className="flex-grow flex items-center pl-3">
            <Search className="h-5 w-5 text-slate-500 shrink-0" />
            <input
              data-testid="search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={APP_COPY.search.inputPlaceholder}
              className="w-full bg-transparent border-none text-slate-100 placeholder-slate-500 focus:outline-none text-sm py-3 pl-2"
              disabled={loading}
            />
          </div>

          {isSignedIn ? (
            <button
              type="submit"
              disabled={loading || query.trim() === '' || isQueryTooLong}
              className="h-10 w-28 shrink-0 font-mono text-[10px] tracking-wider uppercase font-bold bg-white/10 hover:bg-white/15 text-slate-100 rounded-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1 disabled:opacity-50 disabled:pointer-events-none"
            >
              {loading ? APP_COPY.search.searchingText : 'Search'}
            </button>
          ) : (
            <SignInButton mode="modal">
              <button
                type="button"
                className="h-10 w-30 shrink-0 font-mono text-[10px] tracking-wider uppercase font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1"
              >
                Search
              </button>
            </SignInButton>
          )}
        </form>

        {/* Character Check & Counter */}
        <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-500 px-2 select-none">
          <span>
            {isQueryTooLong ? (
              <span className="text-red-500 flex items-center gap-1 font-bold">
                <AlertTriangle className="h-3 w-3" /> Search description exceeds max character limits. Shorten it!
              </span>
            ) : (
              <span>Calculates cosine similarity to cluster centroids.</span>
            )}
          </span>
          <span className={isQueryTooLong ? 'text-red-500 font-bold' : ''}>
            {query.length}/{MAX_QUERY_CHARS}
          </span>
        </div>

        {/* Local Error message */}
        {error && (
          <div className="mt-4 p-4 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-xs text-left">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Search Results list */}
      <div className="space-y-6">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div 
              className="py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <PageScanner message={APP_COPY.search.searchingText} />
            </motion.div>
          ) : results.length > 0 ? (
            <div 
              className="space-y-6"
            >
              <h3 className="font-mono text-xs text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">
                {APP_COPY.search.resultsTitle}:
              </h3>
              
              <div className="space-y-4">
                {results && results.map((cluster) => {
                  // Display match score percentage
                  const similarityPct = cluster.score ? Math.round(cluster.score * 100) : 0;
                  
                  return (
                    <Link
                      key={cluster.id}
                      href={`/cluster/${cluster.id}`}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-6 bg-slate-900/40 border border-white/5 rounded-2xl hover:bg-slate-900/60 hover:border-white/10 transition-all duration-300 shadow-xl gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-[9px] text-amber-500 uppercase tracking-widest font-bold">
                            {cluster.categoryLabel}
                          </span>
                          <span className="font-mono text-[9px] text-slate-500 uppercase bg-white/5 px-2 py-0.5 rounded">
                            Match Score: {similarityPct}%
                          </span>
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-slate-200 group-hover:text-slate-100 transition-colors">
                          "{cluster.canonicalText}"
                        </h2>
                        <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest block">
                          Validated by {cluster.memberCount} active reports
                        </span>
                      </div>

                      <div className="shrink-0 flex items-center justify-end">
                        <span className="font-mono text-[10px] text-amber-500 group-hover:text-amber-400 flex items-center gap-1 group-hover:translate-x-1 transition-all">
                          Inspect <ChevronRight className="h-4 w-4" />
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : query !== '' && !loading ? (
            <div 
              className="text-center py-16 border border-dashed border-white/5 rounded-2xl font-mono text-xs uppercase text-slate-500 tracking-widest px-4"
            >
              {APP_COPY.search.noResults}
            </div>
          ) : (
            <motion.div 
              className="text-center py-16 border border-dashed border-white/5 rounded-2xl text-slate-500 font-mono text-[10px] tracking-[0.2em] uppercase select-none flex flex-col items-center justify-center gap-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <HelpCircle className="h-6 w-6 text-slate-600 mb-1" />
              <span>Input a query above to validate your product idea</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
