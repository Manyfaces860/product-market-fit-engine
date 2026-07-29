'use client';

import { useState, useEffect } from 'react';
import { APP_COPY } from '@/lib/config/copy';
import { ButtonSpinner, PageScanner } from '@/components/Loader';
import { fetchWithRetry } from '@/lib/fetch-retry';
import AlertModal from '@/components/AlertModal';
import { useAuth, SignInButton, Show } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { 
  Plus, 
  ArrowRight, 
  Layers, 
  AlertTriangle, 
  Check, 
  Sparkles, 
  HelpCircle, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Database
} from 'lucide-react';

const MAX_QUERY_CHARS = 500;

interface Cluster {
  id: string;
  category: string;
  categoryLabel: string;
  categoryDescription: string;
  canonicalText: string;
  memberCount: number;
  sampleVariants: string[];
}

interface DraftResult {
  mode: 'match' | 'new';
  proposedCategory: string;
  proposedCategoryLabel: string;
  proposedCategoryDescription: string;
  proposedCanonicalText: string;
  cluster?: Cluster;
}

const DEFAULT_TAXONOMY = [
  { id: 'software-devtools', label: 'Developer Tools & DX', description: 'Problems related to developer experience, API integrations, build tools, and local workflows' },
  { id: 'software-saas', label: 'SaaS & B2B Productivity', description: 'Administrative bottlenecks, SaaS subscription issues, collaboration overhead, and calendar sync issues' },
  { id: 'hardware-iot', label: 'Hardware & Smart Devices', description: 'Smart device connectivity, localized network pairing, specialized hardware adapters, and firmware bugs' },
  { id: 'ecommerce-ops', label: 'E-commerce & Shipping Ops', description: 'Multi-channel inventory syncing, custom label bottlenecks, and automated return processing' },
  { id: 'ai-operations', label: 'AI & Data Infrastructure', description: 'High LLM latencies, vector storage sync, parsing unstructured data, and token limit cost controls' },
];

export default function Home() {
  const { isSignedIn } = useAuth();
  const [inputText, setInputText] = useState('');
  const [trending, setTrending] = useState<Cluster[]>([]);
  // const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [trendingLoading, setTrendingLoading] = useState(true);
  const [seedElapsed, setSeedElapsed] = useState<number | null>(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submittingMessage, setSubmittingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Custom Alert Modal states
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    type: 'success' as 'success' | 'error' | 'info',
    title: '',
    message: ''
  });

  const sanitizeError = (error: any, defaultMessage: string): string => {
    const msg = error?.message || '';
    const name = error?.name || '';
    
    // Catch rate limiting and convert to friendly guidance, preserving dynamic countdowns
    if (msg.toLowerCase().includes('try again in')) {
      return msg;
    }
    if (msg.includes('429') || msg.includes('Too Many Requests') || msg.includes('rate limit')) {
      return 'You are making requests too quickly. Please wait a moment before trying again to keep usage fair!';
    }

    // Catch abort/timeout errors and convert to friendly guidance
    const isTimeout = name === 'AbortError' || msg.includes('aborted') || msg.includes('abort') || msg.includes('timeout') || msg.includes('timed out');
    if (isTimeout) {
      return 'The request took too long to respond. Please check your network connection and try again.';
    }

    const isCodeError = 
      msg.includes('fetch failed') ||
      msg.includes('Topology') ||
      msg.includes('ReplicaSet') ||
      msg.includes('SSL') ||
      msg.includes('connect') ||
      msg.includes('NetworkError') ||
      msg.includes('status 5') ||
      msg.includes('Server Error');
    
    if (isCodeError) {
      return `${defaultMessage} Please check your connection and manually try again.`;
    }
    return msg || defaultMessage;
  };
  
  // Submission flow states
  const [draft, setDraft] = useState<DraftResult | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCanonical, setCustomCanonical] = useState('');
  const [successResult, setSuccessResult] = useState<{ joinedCluster: boolean; cluster: Cluster } | null>(null);

  useEffect(() => {
    async function loadInitialData() {
      setTrendingLoading(true);
      try {
        const clustersRes = await fetch('/api/clusters')

        if (clustersRes.ok) {
          const clusters = await clustersRes.json();
          setTrending(clusters.slice(0, 4));
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        setTrendingLoading(false);
      }
    }
    loadInitialData();
  }, []);

  // Character validation
  const isQueryTooLong = inputText.length > MAX_QUERY_CHARS;

  // Step 1: Submit Draft (Embed -> Similarity check -> Classify if no match)
  const handleSubmitDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSignedIn) return;
    if (inputText.trim() === '') return;
    if (isQueryTooLong) return;

    setLoading(true);
    setLoadingMessage(APP_COPY.home.submitButtonLoading);
    setError(null);
    setDraft(null);
    setSuccessResult(null);

    try {
      const response = await fetchWithRetry('/api/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          draft: true,
        }),
        onRetry: (attempt) => setLoadingMessage(`Retrying... (Attempt ${attempt}/3)`),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'An error occurred during draft creation.');
      }

      setDraft(data);
      setSelectedCategory(data.proposedCategory);
      setCustomCanonical(data.proposedCanonicalText);
    } catch (err: any) {
      console.error(err);
      setError(sanitizeError(err, 'We are experiencing temporary database latency.'));
    } finally {
      setLoading(false);
      setLoadingMessage('');
    }
  };

  // Step 2: Confirm & Finalize (Write to DB)
  const handleConfirmSubmission = async () => {
    if (!isSignedIn || !draft) return;

    setSubmitting(true);
    setSubmittingMessage(APP_COPY.draftResult.publishButtonLoading);
    setError(null);

    const matchingCategoryObj = DEFAULT_TAXONOMY.find(c => c.id === selectedCategory) || {
      id: selectedCategory,
      label: draft.proposedCategoryLabel,
      description: draft.proposedCategoryDescription
    };

    try {
      const response = await fetchWithRetry('/api/problems', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: inputText,
          draft: false,
          confirmedCategory: selectedCategory,
          confirmedCategoryLabel: matchingCategoryObj.label,
          confirmedCategoryDescription: matchingCategoryObj.description,
          confirmedCanonicalText: customCanonical,
        }),
        onRetry: (attempt) => setSubmittingMessage(`Retrying... (Attempt ${attempt}/3)`),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'An error occurred while publishing.');
      }

      setSuccessResult({
        joinedCluster: data.joinedCluster,
        cluster: data.cluster
      });
      
      // Refresh home data
      const clustersRes = await fetchWithRetry('/api/clusters');
      if (clustersRes.ok) {
        const clusters = await clustersRes.json();
        setTrending(clusters.slice(0, 4));
      }

      // Reset submission flow fields
      setInputText('');
      setDraft(null);
    } catch (err: any) {
      console.error(err);
      setError(sanitizeError(err, 'We could not complete publishing.'));
    } finally {
      setSubmitting(false);
      setSubmittingMessage('');
    }
  };

  const handleSeedDatabase = async () => {
    setLoading(true);
    setSeedElapsed(0);
    const startTime = Date.now();
    
    const intervalId = setInterval(() => {
      setSeedElapsed(Math.round((Date.now() - startTime) / 1000));
    }, 1000);

    try {
      const res = await fetchWithRetry('/api/seed', {}, 30000);
      if (res.ok) {
        const clustersRes = await fetchWithRetry('/api/clusters');
        if (clustersRes.ok) {
          const clusters = await clustersRes.json();
          setTrending(clusters.slice(0, 4));
        }
        setAlertModal({
          isOpen: true,
          type: 'success',
          title: 'Seeding Completed!',
          message: 'The Pinecone index has been populated with 5 professional, high-signal niches and their phrasing variants.'
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      clearInterval(intervalId);
      setLoading(false);
      setSeedElapsed(null);
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-start py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Seed Helper for empty DBs */}
      {/* {(
        <div className="mb-8 w-full max-w-xl p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg flex items-center justify-between gap-4">
          <div className="flex gap-2">
            <Database className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-mono text-xs text-amber-400 font-bold">{APP_COPY.home.seedToolkitTitle}</p>
              <p className="text-xs text-slate-300">{APP_COPY.home.seedToolkitDesc}</p>
            </div>
          </div>
          <button 
            onClick={handleSeedDatabase}
            disabled={loading}
            className="shrink-0 font-mono text-[10px] uppercase font-bold tracking-wider bg-amber-500 text-slate-950 px-3 py-1.5 rounded hover:bg-amber-600 cursor-pointer disabled:opacity-50"
          >
            {loading 
              ? `${APP_COPY.home.seedButtonLoading} (${seedElapsed !== null ? `${seedElapsed}s` : 'loading...'})` 
              : APP_COPY.home.seedButtonText}
          </button>
        </div>
      )} */}

      {/* Main Submission Form Section */}
      <div className="w-full max-w-4xl text-center mt-6 mb-16 relative">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <span className="font-mono text-[10px] tracking-[0.3em] bg-white/5 border border-white/10 px-3 py-1 rounded-full uppercase text-slate-400">
            {APP_COPY.home.badge}
          </span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-display font-bold tracking-tight leading-tight py-2 bg-gradient-to-r from-amber-400 via-coral-400 to-teal-400 bg-clip-text text-transparent italic select-none">
            {APP_COPY.home.heroTitle}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-slate-400 text-sm sm:text-base leading-relaxed">
            {APP_COPY.home.heroSubtitle}
          </p>
        </motion.div>

        {/* Input Form Box */}
        <motion.div 
          className="mx-auto mt-10 max-w-2xl"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          <AnimatePresence mode="wait">
            {!draft && !successResult ? (
              <motion.form 
                onSubmit={handleSubmitDraft}
                className="relative p-2 bg-slate-900/60 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl flex flex-col md:flex-row gap-2"
                exit={{ opacity: 0, scale: 0.95 }}
              >
                <div className="flex-grow flex flex-col items-start px-3 py-2">
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={APP_COPY.home.inputPlaceholder}
                    className="w-full bg-transparent text-slate-100 placeholder-slate-500 focus:outline-none resize-none h-20 text-sm py-1"
                    disabled={loading}
                  />
                  
                  {/* Character Counter & Warnings */}
                  <div className="w-full flex items-center justify-between font-mono text-[10px] text-slate-500 select-none mt-1">
                    <span>
                      {isQueryTooLong ? (
                        <span className="text-red-500 flex items-center gap-1">
                          <AlertTriangle className="h-3 w-3 inline" /> {APP_COPY.home.characterWarning}
                        </span>
                      ) : (
                        <span>{APP_COPY.home.inputContextHelp}</span>
                      )}
                    </span>
                    <span className={isQueryTooLong ? 'text-red-500 font-bold' : ''}>
                      {inputText.length}/{MAX_QUERY_CHARS}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 flex items-center md:justify-end justify-center px-2 py-1">
                  {isSignedIn ? (
                    <button
                      type="submit"
                      disabled={loading || inputText.trim() === '' || isQueryTooLong}
                      className="w-full md:w-auto h-12 flex items-center justify-center gap-2 font-mono text-xs tracking-wider uppercase font-bold bg-gradient-to-r from-brand-amber to-brand-coral text-slate-950 px-6 rounded-xl hover:opacity-90 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <ButtonSpinner size="sm" />
                          {loadingMessage || APP_COPY.home.submitButtonLoading}
                        </span>
                      ) : (
                        <>
                          {APP_COPY.home.submitButtonText} <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  ) : (
                      <Show when={'signed-out'}>
                        <SignInButton mode="modal">
                          <button
                              type="button"
                              className="w-full md:w-auto h-12 flex items-center justify-center gap-2 font-mono text-xs tracking-wider uppercase font-bold bg-white/10 hover:bg-white/15 text-slate-100 px-6 rounded-xl active:scale-95 transition-all cursor-pointer"
                          >
                            {APP_COPY.home.signInToSubmitText}
                          </button>
                        </SignInButton>
                      </Show>

                  )}
                </div>
              </motion.form>
            ) : draft && !successResult ? (
              // STEP 2: DRAFT RESOLUTION SCREEN (MEET MATCH OR CREATE NEW)
              <motion.div 
                className="text-left bg-slate-900/95 border-glow border rounded-2xl shadow-2xl p-6 sm:p-8 backdrop-blur-2xl"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
              >
                {draft.mode === 'match' ? (
                  /* CASE A: JOIN EXISTING CLUSTER */
                  <div>
                    <div className="flex items-center gap-2 text-amber-500 font-mono text-xs uppercase tracking-widest font-bold mb-4">
                      <TrendingUp className="h-4 w-4" /> {APP_COPY.draftResult.matchHeader}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-100 leading-tight">
                      {APP_COPY.draftResult.matchTitle}
                    </h2>
                    <p className="text-slate-400 text-sm mt-2">
                      {APP_COPY.draftResult.matchDesc} <span className="font-mono text-xs font-bold text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded bg-amber-500/5">{draft.cluster?.memberCount} {APP_COPY.draftResult.peopleAffected}</span>.
                    </p>

                    {/* Matched Cluster Details Box */}
                    <div className="mt-6 p-5 rounded-xl border border-white/5 bg-slate-950/60 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-2 text-[10px] font-mono tracking-widest text-slate-600 bg-white/5 uppercase rounded-bl border-l border-b border-white/5">
                        {APP_COPY.draftResult.clusterLabel}
                      </div>
                      <div className="font-mono text-[10px] text-amber-500 tracking-wider font-bold mb-1 uppercase">
                        {draft.cluster?.categoryLabel}
                      </div>
                      <p className="text-slate-200 text-base font-semibold leading-relaxed pr-12">
                        &quot;{draft.cluster?.canonicalText}&quot;
                      </p>

                      <div className="mt-4 border-t border-white/5 pt-4">
                        <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider block mb-2">HOW OTHERS EXPRESSED IT:</span>
                        <ul className="space-y-1 text-xs text-slate-400 italic">
                          {draft.cluster?.sampleVariants.slice(0, 3).map((variant, i) => (
                            <li key={i} className="line-clamp-1">
                              • "{variant}"
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 justify-end">
                      <button
                        onClick={() => { setDraft(null); setError(null); }}
                        className="w-full sm:w-auto px-5 py-2.5 font-mono text-xs tracking-wider uppercase text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmSubmission}
                        disabled={submitting}
                        className="w-full sm:w-auto h-11 flex items-center justify-center gap-2 font-mono text-xs tracking-wider uppercase font-bold bg-gradient-to-r from-brand-amber to-brand-coral text-slate-950 px-6 rounded-xl hover:opacity-90 transition-all cursor-pointer"
                      >
                        {submitting ? submittingMessage || APP_COPY.draftResult.publishButtonLoading : APP_COPY.draftResult.publishButtonText}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* CASE B: NEW SEED CLUSTER (LLM Auto-classification + User Correction) */
                  <div>
                    <div className="flex items-center gap-2 text-teal-500 font-mono text-xs uppercase tracking-widest font-bold mb-4">
                      <Sparkles className="h-4 w-4 animate-pulse" /> {APP_COPY.draftResult.newHeader}
                    </div>
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-100 leading-tight">
                      {APP_COPY.draftResult.newTitle}
                    </h2>
                    <p className="text-slate-400 text-sm mt-2">
                      {APP_COPY.draftResult.newDesc}
                    </p>

                    {/* Auto-categorization Box */}
                    <div className="mt-6 space-y-6">
                      
                      {/* Canonical representation input */}
                      <div>
                        <label className="font-mono text-[10px] text-slate-400 tracking-wider block uppercase mb-1.5 font-bold">
                          {APP_COPY.draftResult.proposedCanonicalLabel}
                        </label>
                        <input
                          type="text"
                          value={customCanonical}
                          onChange={(e) => setCustomCanonical(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>

                      {/* Dropdown Correction */}
                      <div>
                        <label className="font-mono text-[10px] text-slate-400 tracking-wider block uppercase mb-1.5 font-bold flex justify-between">
                          <span>{APP_COPY.draftResult.proposedCategoryLabel}</span>
                          <span className="text-[9px] text-slate-500 font-normal normal-case">Correct if wrong</span>
                        </label>
                        <select
                          value={selectedCategory}
                          onChange={(e) => setSelectedCategory(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-amber-500/50 cursor-pointer"
                        >
                          {DEFAULT_TAXONOMY.map((cat) => (
                            <option key={cat.id} value={cat.id} className="bg-slate-950">
                              {cat.label}
                            </option>
                          ))}
                          {selectedCategory !== '' && !DEFAULT_TAXONOMY.some(c => c.id === selectedCategory) && (
                            <option value={selectedCategory} className="bg-slate-950">
                              {draft.proposedCategoryLabel} (Auto-Generated)
                            </option>
                          )}
                        </select>
                      </div>

                    </div>

                    <div className="mt-8 flex flex-col sm:flex-row items-center gap-3 justify-end">
                      <button
                        onClick={() => { setDraft(null); setError(null); }}
                        className="w-full sm:w-auto px-5 py-2.5 font-mono text-xs tracking-wider uppercase text-slate-400 hover:text-slate-100 transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleConfirmSubmission}
                        disabled={submitting}
                        className="w-full sm:w-auto h-11 flex items-center justify-center gap-2 font-mono text-xs tracking-wider uppercase font-bold bg-gradient-to-r from-teal-500 to-amber-500 text-slate-950 px-6 rounded-xl hover:from-teal-600 hover:to-amber-600 transition-all cursor-pointer"
                      >
                        {submitting ? submittingMessage || APP_COPY.draftResult.publishButtonLoading : APP_COPY.draftResult.publishButtonText}
                      </button>
                    </div>
                  </div>
                )}
              </motion.div>
            ) : (
              // STEP 3: SUCCESS CONFIRMATION MODAL STATE
              <motion.div 
                className="text-center bg-slate-900/95 border border-teal-500/30 rounded-2xl shadow-2xl p-8 backdrop-blur-2xl max-w-xl mx-auto"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="mx-auto w-12 h-12 bg-teal-500/25 border border-teal-500/50 rounded-full flex items-center justify-center text-teal-400 mb-4 animate-bounce">
                  <Check className="h-6 w-6" />
                </div>
                <h2 className="text-2xl font-bold font-display italic text-slate-100">
                  {APP_COPY.draftResult.successHeader}
                </h2>
                
                {successResult?.joinedCluster ? (
                  <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                    {APP_COPY.draftResult.successMatchedDesc} <span className="text-slate-200 block font-semibold mt-1 italic">&quot;{successResult.cluster.canonicalText}&quot;</span>
                  </p>
                ) : (
                  <p className="text-slate-400 text-sm mt-3 leading-relaxed">
                    {APP_COPY.draftResult.successSeededDesc} <span className="text-slate-200 block font-semibold mt-1 italic">&quot;{successResult?.cluster.canonicalText}&quot;</span>
                  </p>
                )}

                <div className="mt-8 flex items-center gap-4 justify-center">
                  <Link
                    href={`/cluster/${successResult?.cluster.id}`}
                    className="font-mono text-xs font-bold uppercase bg-white/10 hover:bg-white/15 px-5 py-2.5 rounded-xl border border-white/5 text-slate-100 flex items-center gap-2 cursor-pointer"
                  >
                    {APP_COPY.draftResult.viewDetailsButton} <ChevronRight className="h-4 w-4" />
                  </Link>
                  <button
                    onClick={() => { setSuccessResult(null); setDraft(null); setInputText(''); setError(null); }}
                    className="font-mono text-xs font-bold uppercase bg-gradient-to-r from-brand-amber to-brand-coral hover:opacity-90 text-slate-950 px-5 py-2.5 rounded-xl cursor-pointer"
                  >
                    {APP_COPY.draftResult.submitAnotherButton}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Local error panel */}
          {error && (
            <motion.div 
              className="mt-4 p-4 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-xs text-left"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* TRENDING CLUSTERS SECTION (BELOW THE FOLD) */}
      <div className="w-full max-w-6xl mt-12 border-t border-white/5 pt-16">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-display font-bold italic flex items-center gap-2.5">
              <TrendingUp className="h-5 w-5 text-amber-500" /> {APP_COPY.home.trendingTitle}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm font-mono tracking-wider mt-1">
              {APP_COPY.home.trendingSubtitle}
            </p>
          </div>
          <Link
            href="/browse"
            className="mt-4 sm:mt-0 font-mono text-[10px] tracking-widest uppercase font-bold text-slate-400 hover:text-slate-100 flex items-center gap-1.5 cursor-pointer group"
          >
            {APP_COPY.home.browseAllLink} <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {trending.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trending.map((cluster, i) => (
              <Link 
                key={cluster.id}
                href={`/cluster/${cluster.id}`}
                className="group relative p-6 bg-slate-900/40 border border-white/5 rounded-2xl hover:bg-slate-900/60 hover:border-white/10 transition-all duration-300 shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] tracking-widest uppercase mb-3">
                    <span className="text-amber-500 font-bold">{cluster.categoryLabel}</span>
                    <span className="text-slate-500 bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                      {APP_COPY.home.signalSizeLabel} <strong className="text-slate-300 font-semibold">{cluster.memberCount}</strong>
                    </span>
                  </div>
                  <p className="text-slate-200 font-medium text-base leading-relaxed group-hover:text-white transition-colors">
                    &quot;{cluster.canonicalText}&quot;
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest italic">
                    {cluster.sampleVariants.length} {APP_COPY.home.distinctPhrasingsSuffix}
                  </span>
                  <span className="text-[10px] font-mono text-amber-500 group-hover:text-amber-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {APP_COPY.home.inspectLink} <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : trendingLoading ? (
          <PageScanner message="Scanning database signals..." size="md" />
        ) : (
          <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl text-slate-500 font-mono text-xs uppercase tracking-widest">
            No active collective signals found.
          </div>
        )}
      </div>

      {/* Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}
