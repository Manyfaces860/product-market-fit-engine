'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useAuth } from '@clerk/nextjs';
import { ArrowLeft, Users, Check, Flame, Share2, Plus, AlertTriangle, ArrowUp, ExternalLink, X, Pencil, Trash2, Globe } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { APP_COPY } from '@/lib/config/copy';
import { PageScanner, ButtonSpinner } from '@/components/Loader';
import { fetchWithRetry } from '@/lib/fetch-retry';
import AlertModal from '@/components/AlertModal';
import ConfirmModal from '@/components/ConfirmModal';

// Custom inline SVG Github Icon to prevent version mismatches in Lucide React 🚀
const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg 
    viewBox="0 0 24 24" 
    width="12" 
    height="12" 
    stroke="currentColor" 
    strokeWidth="2.5" 
    fill="none" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={props.className}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
  </svg>
);

interface Solution {
  id: string;
  name: string;
  url: string;
  description: string;
  builderId: string;
  builderName: string;
  builderBio?: string;       // 🚀 Custom Builder Bio Tagline
  builderGithub?: string;    // 🚀 Custom Builder GitHub Link
  builderWebsite?: string;   // 🚀 Custom Builder Portfolio Link
  upvotes: number;
  votesUserIds: string[];
  downvotedUserIds?: string[];
  createdAt: string;
  iconUrl?: string;
}

interface Review {
  _id?: string;
  clusterId: string;
  solutionId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: string;
}

interface Cluster {
  id: string;
  category: string;
  categoryLabel: string;
  categoryDescription: string;
  canonicalText: string;
  memberCount: number;
  sampleVariants: string[];
  createdAt: string;
  lastUpdatedAt: string;
  userIds?: string[];
  solutions?: Solution[];
}

export default function ClusterDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { userId } = useAuth();
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [adjacent, setAdjacent] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const voted = !!(userId && cluster?.userIds?.includes(userId));

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

  // Me Too workflow states
  const [submitting, setSubmitting] = useState(false);
  const [customPhrasing, setCustomPhrasing] = useState('');
  const [showPhrasingInput, setShowPhrasingInput] = useState(false);
  const [meTooError, setMeTooError] = useState<string | null>(null);

  // Custom Alert Modal states
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    type: 'success' as 'success' | 'error' | 'info',
    title: '',
    message: ''
  });

  // Custom Confirm Modal states (Yes/Cancel) 🚀
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    solutionId: '',
  });

  useEffect(() => {
    async function loadDetails() {
      try {
        const res = await fetchWithRetry(`/api/clusters/${id}`);
        if (!res.ok) {
          throw new Error('Failed to retrieve cluster metrics.');
        }
        const data = await res.json();
        setCluster(data.cluster);
        setAdjacent(data.adjacent || []);
      } catch (err: any) {
        console.error(err);
        setError(sanitizeError(err, 'We could not retrieve details for this problem group.'));
      } finally {
        setLoading(false);
      }
    }
    loadDetails();
  }, [id, refreshTrigger]);

  // Solution workflow states
  const [showSolutionForm, setShowSolutionForm] = useState(false);
  const [solName, setSolName] = useState('');
  const [solUrl, setSolUrl] = useState('');
  const [solDesc, setSolDesc] = useState('');
  const [solBuilderName, setSolBuilderName] = useState('');
  const [solIconUrl, setSolIconUrl] = useState('');
  const [editingSolutionId, setEditingSolutionId] = useState<string | null>(null);
  const [submittingSolution, setSubmittingSolution] = useState(false);
  const [solutionError, setSolutionError] = useState<string | null>(null);
  const [solutionSuccess, setSolutionSuccess] = useState(false);

  // Upvote state helper
  const [upvotingIds, setUpvotingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());

  const handleSolutionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingSolution(true);
    setSolutionError(null);

    const isEditing = !!editingSolutionId;
    const endpoint = isEditing 
      ? `/api/clusters/${id}/solutions/${editingSolutionId}`
      : `/api/clusters/${id}/solutions`;
    const method = isEditing ? 'PATCH' : 'POST';

    // Generate client-side Idempotency Key for brand new solution listings.
    // This locks the submission ID so that network retries are perfectly deduplicated server-side!
    const clientSolutionId = isEditing 
      ? undefined 
      : `sol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    try {
      const res = await fetchWithRetry(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: solName,
          url: solUrl,
          description: solDesc,
          builderName: solBuilderName,
          iconUrl: solIconUrl,
          solutionId: clientSolutionId, // Transmit Idempotency Key to server
        }),
        timeoutMs: 15000, // Extend write-and-blast timeout limit to 15 seconds
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit solution.');
      }

      setCluster(data.cluster);
      setSolutionSuccess(true);
      setSolName('');
      setSolUrl('');
      setSolDesc('');
      setSolBuilderName('');
      setSolIconUrl('');
      setEditingSolutionId(null);
    } catch (err: any) {
      console.error(err);
      setSolutionError(sanitizeError(err, 'We could not publish your product solution listing.'));
    } finally {
      setSubmittingSolution(false);
    }
  };

  const triggerSolutionDelete = (solutionId: string) => {
    setConfirmModal({
      isOpen: true,
      solutionId,
    });
  };

  const executeSolutionDelete = async () => {
    const solutionId = confirmModal.solutionId;
    if (!solutionId) return;

    const nextDeleting = new Set(deletingIds);
    nextDeleting.add(solutionId);
    setDeletingIds(nextDeleting);

    try {
      const res = await fetchWithRetry(`/api/clusters/${id}/solutions/${solutionId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to delete solution.');
      }

      setCluster(data.cluster);
      setAlertModal({
        isOpen: true,
        type: 'success',
        title: 'Solution Deleted',
        message: 'Your listed product solution has been successfully removed from this problem group.'
      });
    } catch (err: any) {
      console.error(err);
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Deletion Failed',
        message: sanitizeError(err, 'Failed to delete the listed product.')
      });
    } finally {
      const nextDeleting = new Set(deletingIds);
      nextDeleting.delete(solutionId);
      setDeletingIds(nextDeleting);
    }
  };

  const handleSolutionEditStart = (sol: Solution) => {
    setEditingSolutionId(sol.id);
    setSolName(sol.name);
    setSolUrl(sol.url);
    setSolDesc(sol.description);
    setSolBuilderName(sol.builderName);
    setSolIconUrl(sol.iconUrl || '');
    setSolutionSuccess(false);
    setSolutionError(null);
    setShowSolutionForm(true);
  };

  const handleSolutionVote = async (solutionId: string, voteType: 'up' | 'down') => {
    if (!userId) {
      setAlertModal({
        isOpen: true,
        type: 'info',
        title: 'Authentication Required',
        message: 'You must be signed in to rate listed product solutions!'
      });
      return;
    }
    
    // Prevent double-clicking on client side
    if (upvotingIds.has(solutionId)) return;
    
    const updatedUpvoting = new Set(upvotingIds);
    updatedUpvoting.add(solutionId);
    setUpvotingIds(updatedUpvoting);

    try {
      const res = await fetchWithRetry(`/api/clusters/${id}/solutions/${solutionId}/upvote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteType })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit vote.');
      }

      setCluster(data.cluster);
    } catch (err: any) {
      console.error(err);
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Vote Failed',
        message: sanitizeError(err, 'Failed to record your vote.')
      });
    } finally {
      const finishedUpvoting = new Set(upvotingIds);
      finishedUpvoting.delete(solutionId);
      setUpvotingIds(finishedUpvoting);
    }
  };

  // Reviews Layer states
  const [expandedSolutionId, setExpandedSolutionId] = useState<string | null>(null);
  const [solutionReviews, setSolutionReviews] = useState<Record<string, Review[]>>({});
  const [loadingReviews, setLoadingReviews] = useState<Record<string, boolean>>({});
  const [showReviewForm, setShowReviewForm] = useState<string | null>(null);
  
  // Review inputs
  const [revRating, setRevRating] = useState(5);
  const [revText, setRevText] = useState('');
  const [revName, setRevName] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const fetchReviews = async (solutionId: string) => {
    setLoadingReviews(prev => ({ ...prev, [solutionId]: true }));
    try {
      const res = await fetchWithRetry(`/api/clusters/${id}/solutions/${solutionId}/reviews`);
      const data = await res.json();
      if (res.ok) {
        setSolutionReviews(prev => ({ ...prev, [solutionId]: data.reviews || [] }));
      }
    } catch (err) {
      console.error('Failed to load reviews:', err);
    } finally {
      setLoadingReviews(prev => ({ ...prev, [solutionId]: false }));
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent, solutionId: string) => {
    e.preventDefault();
    setSubmittingReview(true);
    setReviewError(null);

    try {
      const res = await fetchWithRetry(`/api/clusters/${id}/solutions/${solutionId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: revRating,
          text: revText,
          userName: revName,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit review.');
      }

      // Add the new review dynamically to local list
      setSolutionReviews(prev => {
        const currentList = prev[solutionId] || [];
        return {
          ...prev,
          [solutionId]: [data.review, ...currentList],
        };
      });

      setRevRating(5);
      setRevText('');
      setRevName('');
      setShowReviewForm(null);
    } catch (err: any) {
      console.error(err);
      setReviewError(sanitizeError(err, 'Could not post your product review.'));
    } finally {
      setSubmittingReview(false);
    }
  };

  const toggleReviewsExpansion = (solutionId: string) => {
    if (expandedSolutionId === solutionId) {
      setExpandedSolutionId(null);
      setShowReviewForm(null);
    } else {
      setExpandedSolutionId(solutionId);
      // Fetch reviews only on first expansion to save resources
      if (!solutionReviews[solutionId]) {
        fetchReviews(solutionId);
      }
    }
  };

  const handleMeTooSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMeTooError(null);

    try {
      const res = await fetchWithRetry(`/api/clusters/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phrasing: customPhrasing,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit me too.');
      }

      setCluster(data.cluster);
      setCustomPhrasing('');
      setShowPhrasingInput(false);
    } catch (err: any) {
      console.error(err);
      setMeTooError(sanitizeError(err, 'Could not register your co-sign feedback.'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <PageScanner message="Loading problem details..." />
    );
  }

  if (error || !cluster) {
    return (
      <div className="mx-auto max-w-xl text-center py-32 px-4 select-none animate-fade-in">
        <AlertTriangle className="mx-auto h-12 w-12 text-red-500 mb-4 animate-pulse" />
        <h1 className="text-xl font-bold font-sans text-slate-200">Error Loading Pain Point</h1>
        <p className="text-slate-400 text-xs mt-2 leading-relaxed">{error || 'Problem group not found in index.'}</p>
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
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      
      {/* Back nav */}
      <div className="mb-6">
        <Link
          href={`/browse/${cluster.category}`}
          className="inline-flex items-center gap-2 font-mono text-xs text-slate-400 hover:text-slate-100 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          {APP_COPY.clusterDetail.backToNiche} ({cluster.categoryLabel})
        </Link>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* Main Details (Col Span 2) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Canonical cluster block */}
          <div className="p-8 bg-slate-900/60 border border-white/5 rounded-2xl shadow-xl relative overflow-hidden">
            
            {/* Ambient subtle glow background */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between gap-4 font-mono text-[10px] tracking-widest uppercase mb-4 text-slate-400 select-none">
              <span className="text-amber-500 font-bold">{cluster.categoryLabel}</span>
              <span>{APP_COPY.clusterDetail.matchHeader} ({cluster.memberCount} Reports)</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-display font-bold text-slate-100 italic leading-relaxed pr-6">
              &quot;{cluster.canonicalText}&quot;
            </h1>

            {/* Variants lists */}
            <div className="mt-8 pt-8 border-t border-white/5">
              <span className="font-mono text-[10px] text-slate-500 uppercase tracking-widest block mb-4 font-bold">
                {APP_COPY.clusterDetail.evidenceSubtitle}
              </span>
              <ul className="space-y-4">
                {cluster.sampleVariants.map((variant, i) => (
                  <motion.li 
                    key={i} 
                    className="p-4 bg-slate-950/40 rounded-xl border border-white/5 text-sm text-slate-300 italic leading-relaxed hover:border-white/10 transition-colors"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    • &quot;{variant}&quot;
                  </motion.li>
                ))}
              </ul>
            </div>
          </div>

          {/* Active Solutions Section */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-display font-bold text-slate-300 italic flex items-center gap-2">
                  {APP_COPY.solutions.tabTitle}
                </h3>
                <p className="text-slate-400 text-xs font-mono uppercase tracking-wider">
                  {APP_COPY.solutions.tabSubtitle}
                </p>
              </div>
              <button
                onClick={() => {
                  if (!userId) {
                    setAlertModal({
                      isOpen: true,
                      type: 'info',
                      title: 'Authentication Required',
                      message: 'You must be signed in to list your product solution!'
                    });
                    return;
                  }
                  setSolutionSuccess(false);
                  setSolutionError(null);
                  setShowSolutionForm(true);
                }}
                className="self-start sm:self-center shrink-0 font-mono text-[10px] uppercase font-bold tracking-wider bg-teal-500 hover:bg-teal-600 text-slate-950 px-4 py-2 rounded-xl transition-all cursor-pointer"
              >
                {APP_COPY.solutions.addSolutionButton}
              </button>
            </div>

            {cluster.solutions && cluster.solutions.length > 0 ? (
              <div className="space-y-4">
                {[...cluster.solutions]
                  .sort((a, b) => b.upvotes - a.upvotes)
                  .map((sol) => {
                    const hasUpvoted = userId && sol.votesUserIds?.includes(userId);
                    const hasDownvoted = userId && sol.downvotedUserIds?.includes(userId);
                    const isUpvoting = upvotingIds.has(sol.id);
                    const isExpanded = expandedSolutionId === sol.id;

                    return (
                      <motion.div
                        key={sol.id}
                        className="p-6 bg-slate-900/40 border border-white/5 rounded-2xl flex flex-col gap-4 hover:border-white/10 transition-all duration-300 shadow-xl animate-fade-in"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                      >
                        {/* Top Solution Info Row */}
                        <div className="flex flex-row items-start gap-6">
                          {/* Vote Stack Column (Reddit / StackOverflow style) 🚀 */}
                          <div className="flex flex-col items-center gap-1.5 shrink-0 select-none">
                            {/* Upvote Arrow */}
                            <button
                              onClick={() => handleSolutionVote(sol.id, 'up')}
                              disabled={isUpvoting}
                              className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all cursor-pointer ${
                                hasUpvoted
                                  ? 'bg-amber-500/20 text-brand-amber border-brand-amber/35'
                                  : 'bg-slate-950/40 text-slate-500 border-white/5 hover:bg-slate-950/80 hover:text-slate-200 animate-pulse-subtle'
                              }`}
                              title={hasUpvoted ? "Remove Upvote" : "Upvote"}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </button>

                            {/* Score Display / Spinner */}
                            <span className={`font-mono text-[11px] font-bold w-8 text-center transition-colors ${
                              hasUpvoted ? 'text-brand-amber' : hasDownvoted ? 'text-rose-500' : 'text-slate-400'
                            }`}>
                              {isUpvoting ? (
                                <div className="flex justify-center"><ButtonSpinner size="xs" /></div>
                              ) : (
                                (sol.upvotes || 0) > 0 ? `+${sol.upvotes}` : sol.upvotes
                              )}
                            </span>

                            {/* Downvote Arrow (Flipped ArrowUp) */}
                            <button
                              onClick={() => handleSolutionVote(sol.id, 'down')}
                              disabled={isUpvoting}
                              className={`flex items-center justify-center w-8 h-8 rounded-lg border transition-all cursor-pointer ${
                                hasDownvoted
                                  ? 'bg-rose-500/20 text-rose-500 border-rose-500/35'
                                  : 'bg-slate-950/40 text-slate-500 border-white/5 hover:bg-slate-950/80 hover:text-slate-200 animate-pulse-subtle'
                              }`}
                              title={hasDownvoted ? "Remove Downvote" : "Downvote"}
                            >
                              <ArrowUp className="h-4 w-4 rotate-180" />
                            </button>
                          </div>

                          {/* Product Content Column */}
                          <div className="flex-grow space-y-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <img
                                src={sol.iconUrl || "/placeholder-solution-icon.png"}
                                alt={`${sol.name} icon`}
                                className="w-10 h-10 rounded-xl bg-slate-950 border border-white/10 shrink-0 object-contain select-none"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="text-base font-bold text-slate-200">{sol.name}</h4>
                                  <a
                                    href={sol.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-amber-500 p-1 rounded hover:bg-white/5 transition-all"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                  {sol.builderId === userId && (
                                    <div className="flex items-center gap-1.5 ml-2">
                                      <button
                                        onClick={() => handleSolutionEditStart(sol)}
                                        className="p-1.5 rounded-lg bg-white/5 border border-white/5 hover:border-amber-500/35 hover:bg-amber-500/10 text-slate-400 hover:text-amber-400 cursor-pointer transition-all"
                                        title="Edit Listing"
                                      >
                                        <Pencil className="h-3.5 w-3.5" />
                                      </button>
                                      <button
                                        onClick={() => triggerSolutionDelete(sol.id)}
                                        disabled={deletingIds.has(sol.id)}
                                        className="p-1.5 rounded-lg bg-white/5 border border-white/5 hover:border-red-500/35 hover:bg-red-500/10 text-slate-400 hover:text-red-400 cursor-pointer transition-all"
                                        title="Delete Listing"
                                      >
                                        {deletingIds.has(sol.id) ? (
                                          <ButtonSpinner size="xs" />
                                        ) : (
                                          <Trash2 className="h-3.5 w-3.5" />
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                                <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest block flex flex-wrap items-center gap-x-2 gap-y-1">
                                  <span>Listed by {sol.builderName}</span>
                                  {sol.builderBio && (
                                    <span className="text-slate-400 italic normal-case font-sans">
                                      ({sol.builderBio})
                                    </span>
                                  )}
                                  {sol.builderGithub && (
                                    <a 
                                      href={sol.builderGithub} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-slate-500 hover:text-slate-300 p-0.5 transition-colors"
                                      title="Builder GitHub Profile"
                                    >
                                      <GithubIcon className="h-3 w-3 inline -mt-0.5" />
                                    </a>
                                  )}
                                  {sol.builderWebsite && (
                                    <a 
                                      href={sol.builderWebsite} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="text-slate-500 hover:text-slate-300 p-0.5 transition-colors"
                                      title="Builder Personal Website"
                                    >
                                      <Globe className="h-3 w-3 inline -mt-0.5" />
                                    </a>
                                  )}
                                </span>
                              </div>
                            </div>
                            <p className="text-slate-300 text-sm leading-relaxed font-sans pt-2">{sol.description}</p>
                          </div>
                        </div>

                        {/* Card Footer: Reviews toggle and dynamic stars rating */}
                        <div className="flex items-center gap-4 pt-3 border-t border-white/5 flex-wrap">
                          <button
                            onClick={() => toggleReviewsExpansion(sol.id)}
                            className={`font-mono text-[9px] uppercase tracking-widest font-bold cursor-pointer flex items-center gap-1 px-3 py-1.5 rounded-lg transition-all ${
                              isExpanded 
                                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' 
                                : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-100 border border-transparent'
                            }`}
                          >
                            💬 Reviews ({solutionReviews[sol.id] ? solutionReviews[sol.id].length : 'View'})
                          </button>

                          {solutionReviews[sol.id] && solutionReviews[sol.id].length > 0 && (
                            <div className="flex items-center gap-1.5 font-mono text-[9px] text-amber-500 uppercase tracking-widest">
                              <span>
                                {Array.from({ length: 5 }).map((_, starIdx) => {
                                  const avg = solutionReviews[sol.id].reduce((acc, r) => acc + r.rating, 0) / solutionReviews[sol.id].length;
                                  return starIdx < Math.round(avg) ? '★' : '☆';
                                }).join('')}
                              </span>
                              <span className="text-slate-400">
                                ({(solutionReviews[sol.id].reduce((acc, r) => acc + r.rating, 0) / solutionReviews[sol.id].length).toFixed(1)} / 5.0)
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Collapsible Reviews Panel */}
                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div 
                              className="space-y-4 pt-4 border-t border-white/5 text-left overflow-hidden"
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                            >
                              <div className="flex items-center justify-between gap-4">
                                <h5 className="font-mono text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                                  {APP_COPY.reviews.title}
                                </h5>
                                {userId && showReviewForm !== sol.id && !(solutionReviews[sol.id] || []).some(r => r.userId === userId) && (
                                  <button
                                    onClick={() => {
                                      setRevRating(5);
                                      setRevText('');
                                      setRevName('');
                                      setReviewError(null);
                                      setShowReviewForm(sol.id);
                                    }}
                                    className="font-mono text-[8px] uppercase tracking-wider font-bold bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 px-2.5 py-1 rounded-lg transition-all cursor-pointer"
                                  >
                                    {APP_COPY.reviews.addReviewButton}
                                  </button>
                                )}
                              </div>

                              {/* Write a Review Inline Form */}
                              {showReviewForm === sol.id && (
                                <motion.form
                                  onSubmit={(e) => handleReviewSubmit(e, sol.id)}
                                  className="p-4 bg-slate-950/40 rounded-xl border border-white/5 space-y-4"
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                >
                                  {/* Rating selection */}
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-[9px] text-slate-400 uppercase tracking-widest font-bold">
                                      {APP_COPY.reviews.ratingLabel}:
                                    </span>
                                    <div className="flex gap-1.5">
                                      {[1, 2, 3, 4, 5].map((star) => (
                                        <button
                                          key={star}
                                          type="button"
                                          onClick={() => setRevRating(star)}
                                          className={`text-base transition-colors cursor-pointer ${
                                            star <= revRating ? 'text-amber-500' : 'text-slate-600 hover:text-slate-400'
                                          }`}
                                        >
                                          ★
                                        </button>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Experience text area */}
                                  <div className="space-y-1">
                                    <label className="font-mono text-[9px] text-slate-400 uppercase tracking-widest font-bold block">
                                      {APP_COPY.reviews.reviewTextLabel}
                                    </label>
                                    <textarea
                                      value={revText}
                                      onChange={(e) => setRevText(e.target.value)}
                                      placeholder={APP_COPY.reviews.reviewTextPlaceholder}
                                      className="w-full bg-slate-905/40 bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 h-16 resize-none"
                                      required
                                    />
                                  </div>

                                  {/* Optional Name input */}
                                  <div className="flex flex-col sm:flex-row gap-3 items-end justify-between">
                                    <div className="w-full sm:w-1/2 space-y-1">
                                      <label className="font-mono text-[9px] text-slate-400 uppercase tracking-widest font-bold block flex justify-between">
                                        <span>{APP_COPY.reviews.reviewerNameLabel}</span>
                                        <span className="text-[8px] text-slate-500 font-normal lowercase normal-case">Optional</span>
                                      </label>
                                      <input
                                        type="text"
                                        value={revName}
                                        onChange={(e) => setRevName(e.target.value)}
                                        placeholder={APP_COPY.reviews.reviewerNamePlaceholder}
                                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                                      />
                                    </div>

                                    {reviewError && (
                                      <div className="p-2 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-1.5 text-red-300 text-[10px] text-left">
                                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                        <span>{reviewError}</span>
                                      </div>
                                    )}

                                    <div className="flex gap-2">
                                      <button
                                        type="button"
                                        onClick={() => setShowReviewForm(null)}
                                        className="font-mono text-[9px] uppercase text-slate-400 py-2 px-3 border border-white/5 rounded-lg hover:text-slate-100 cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="submit"
                                        disabled={submittingReview}
                                        className="h-8 flex items-center justify-center gap-1 font-mono text-[9px] tracking-wider uppercase font-bold bg-gradient-to-r from-teal-500 to-amber-500 text-slate-950 px-4 rounded-lg hover:opacity-95 cursor-pointer disabled:opacity-50"
                                      >
                                        {submittingReview ? (
                                          <span className="flex items-center gap-1">
                                            <ButtonSpinner size="xs" />
                                            {APP_COPY.reviews.submitButtonLoading}
                                          </span>
                                        ) : (
                                          APP_COPY.reviews.submitButton
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </motion.form>
                              )}

                              {/* Reviews Loader state */}
                              {loadingReviews[sol.id] ? (
                                <div className="flex justify-center py-4">
                                  <ButtonSpinner size="sm" />
                                </div>
                              ) : solutionReviews[sol.id] && solutionReviews[sol.id].length > 0 ? (
                                /* Reviews List */
                                <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                                  {solutionReviews[sol.id].map((rev) => (
                                    <div key={rev._id || rev.createdAt} className="p-3.5 bg-slate-950/30 border border-white/5 rounded-xl space-y-1.5 text-left">
                                      <div className="flex items-center justify-between gap-4 flex-wrap">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-bold text-slate-300">{rev.userName}</span>
                                          <span className="text-amber-500 text-xs select-none">
                                            {'★'.repeat(rev.rating) + '☆'.repeat(5 - rev.rating)}
                                          </span>
                                        </div>
                                        <span className="font-mono text-[8px] text-slate-500 uppercase">
                                          {new Date(rev.createdAt).toLocaleDateString()}
                                        </span>
                                      </div>
                                      <p className="text-slate-300 text-xs font-sans leading-relaxed">
                                        {rev.text}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-xs text-slate-400 font-sans italic py-2">
                                  {APP_COPY.reviews.noReviews}
                                </p>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
              </div>
            ) : (
              <div className="p-8 border border-dashed border-white/5 rounded-2xl text-center flex flex-col items-center justify-center gap-3">
                <p className="text-xs text-slate-400 max-w-md font-sans leading-relaxed">
                  {APP_COPY.solutions.noSolutions}
                </p>
                <button
                  onClick={() => {
                    if (!userId) {
                      setAlertModal({
                        isOpen: true,
                        type: 'info',
                        title: 'Authentication Required',
                        message: 'You must be signed in to list your product solution!'
                      });
                      return;
                    }
                    setSolutionSuccess(false);
                    setSolutionError(null);
                    setShowSolutionForm(true);
                  }}
                  className="font-mono text-[9px] uppercase tracking-wider font-bold bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5 px-4 py-2 rounded-xl transition-all cursor-pointer"
                >
                  List Your Product Now
                </button>
              </div>
            )}
          </div>

          {/* Related / Adjacent Clusters list */}
          {adjacent.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-display font-bold text-slate-300 italic">
                {APP_COPY.clusterDetail.adjacentTitle}
              </h3>
              <p className="text-slate-400 text-xs font-mono uppercase tracking-wider mb-2">
                {APP_COPY.clusterDetail.adjacentSubtitle}
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {adjacent.map((adj) => (
                  <Link
                    key={adj.id}
                    href={`/cluster/${adj.id}`}
                    className="p-5 bg-slate-900/30 border border-white/5 rounded-xl hover:bg-slate-900/50 hover:border-white/10 transition-colors block"
                  >
                    <div className="flex justify-between font-mono text-[8px] text-slate-500 uppercase mb-2">
                      <span>{adj.categoryLabel}</span>
                      <span>Signal: {adj.memberCount}</span>
                    </div>
                    <p className="text-slate-300 text-xs italic font-medium line-clamp-2">
                      &quot;{adj.canonicalText}&quot;
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Interactions (Col Span 1) */}
        <div className="space-y-6">
          
          {/* Me Too Interactive card */}
          <div className="p-6 bg-slate-900/80 border-glow border rounded-2xl shadow-xl backdrop-blur-xl relative">
            <div className="absolute top-0 right-0 p-2.5">
              <Flame className="h-5 w-5 text-amber-500 animate-pulse" />
            </div>

            <h3 className="text-lg font-bold text-slate-100 font-sans">
              {APP_COPY.clusterDetail.meTooTitle}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {APP_COPY.clusterDetail.meTooDesc}
            </p>

            <div className="mt-6">
              <AnimatePresence mode="wait">
                {!voted ? (
                  <motion.div key="vote-actions" className="space-y-4">
                    
                    {!showPhrasingInput ? (
                      <div className="space-y-2">
                        <button
                          onClick={() => {
                            // Direct quick Me Too
                            handleMeTooSubmit({ preventDefault: () => {} } as any);
                          }}
                          disabled={submitting}
                          className="w-full h-11 bg-gradient-to-r from-brand-amber to-brand-coral text-slate-950 font-mono text-xs uppercase tracking-wider font-bold rounded-xl active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                          {submitting ? (
                            <span className="flex items-center gap-2">
                              <ButtonSpinner size="sm" />
                              {APP_COPY.clusterDetail.meTooButtonLoading}
                            </span>
                          ) : (
                            APP_COPY.clusterDetail.meTooButtonText
                          )}
                        </button>
                        <button
                          onClick={() => setShowPhrasingInput(true)}
                          className="w-full text-center font-mono text-[10px] text-slate-400 hover:text-slate-100 uppercase tracking-widest cursor-pointer py-1"
                        >
                          + Add custom phrasing variant
                        </button>
                      </div>
                    ) : (
                      <motion.form 
                        onSubmit={handleMeTooSubmit}
                        className="space-y-3"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                      >
                        <textarea
                          value={customPhrasing}
                          onChange={(e) => setCustomPhrasing(e.target.value)}
                          placeholder={APP_COPY.clusterDetail.meTooInputPlaceholder}
                          className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500"
                          rows={3}
                          required
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setShowPhrasingInput(false)}
                            className="w-1/2 font-mono text-[10px] uppercase text-slate-400 py-2 border border-white/5 rounded-lg hover:text-slate-100 cursor-pointer"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={submitting || customPhrasing.trim() === ''}
                            className="w-1/2 h-9 bg-gradient-to-r from-brand-amber to-brand-coral text-slate-950 font-mono text-[10px] uppercase tracking-wider font-bold rounded-lg active:scale-95 transition-all flex items-center justify-center cursor-pointer"
                          >
                            {submitting ? 'Submitting...' : 'Add & Publish'}
                          </button>
                        </div>
                      </motion.form>
                    )}

                  </motion.div>
                ) : (
                  <motion.div 
                    key="voted-success" 
                    className="p-4 bg-teal-500/10 border border-teal-500/25 rounded-xl text-center text-teal-400"
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                  >
                    <Check className="mx-auto h-6 w-6 text-teal-400 mb-1" />
                    <span className="font-mono text-xs uppercase font-bold block">Voice Logged</span>
                    <span className="text-[10px] text-slate-300 leading-normal block mt-1">
                      {APP_COPY.clusterDetail.meTooSuccess}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Local Me Too action error panel */}
              {meTooError && (
                <motion.div 
                  className="mt-4 p-3.5 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-[10px] text-left"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
                  <span>{meTooError}</span>
                </motion.div>
              )}
            </div>
          </div>

          {/* Share metadata */}
          <div className="p-4 bg-slate-900/30 border border-white/5 rounded-xl font-mono text-[9px] tracking-wide text-slate-500 space-y-2 select-none uppercase">
            <div>CLUSTER REFERENCE ID: {cluster.id}</div>
            <div>CREATED COORDINATES: {new Date(cluster.createdAt).toLocaleDateString()}</div>
            <div>LAST SIGNAL FORTIFY: {new Date(cluster.lastUpdatedAt).toLocaleDateString()}</div>
          </div>

        </div>

      </div>

      {/* ADD SOLUTION DIALOG MODAL */}
      <AnimatePresence>
        {showSolutionForm && (
          <div className="fixed inset-0 z-[2147483646] flex items-center justify-center p-4">
            {/* Modal Backdrop */}
            <motion.div
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSolutionForm(false)}
            />

            {/* Modal Dialog Content */}
            <motion.div
              className="relative bg-slate-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl overflow-hidden text-left"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowSolutionForm(false);
                  setEditingSolutionId(null);
                }}
                className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-white/5 cursor-pointer transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              <AnimatePresence mode="wait">
                {solutionSuccess ? (
                  /* Case A: Launch Success screen */
                  <motion.div
                    key="solution-success"
                    className="text-center space-y-4 py-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div className="mx-auto w-12 h-12 bg-teal-500/25 border border-teal-500/50 rounded-full flex items-center justify-center text-teal-400 mb-4 animate-bounce">
                      <Check className="h-6 w-6" />
                    </div>
                    <h2 className="text-xl font-bold font-sans text-slate-100 italic">
                      {editingSolutionId ? "Solution Updated Successfully!" : APP_COPY.solutions.successHeader}
                    </h2>
                    <p className="text-xs text-slate-400 leading-relaxed font-sans max-w-sm mx-auto">
                      {editingSolutionId 
                        ? "Your product listing updates have been published and are active immediately."
                        : APP_COPY.solutions.successDesc}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowSolutionForm(false);
                        setEditingSolutionId(null);
                      }}
                      className="mt-6 font-mono text-xs uppercase font-bold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/5 px-6 py-2.5 rounded-xl transition-all cursor-pointer"
                    >
                      Close Window
                    </button>
                  </motion.div>
                ) : (
                  /* Case B: Launch Submission Form */
                  <motion.form
                    key="solution-form"
                    onSubmit={handleSolutionSubmit}
                    className="space-y-5"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <div>
                      <h3 className="text-lg font-bold text-slate-100 font-sans">
                        {editingSolutionId ? "Update Your Solution Listing" : APP_COPY.solutions.formTitle}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 font-sans leading-relaxed">
                        {editingSolutionId 
                          ? "Modify your listed link, icon, and problem-solving description to match your product's latest features."
                          : APP_COPY.solutions.formSubtitle}
                      </p>
                    </div>

                    {/* Name input */}
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] text-slate-400 tracking-wider block uppercase font-bold">
                        {APP_COPY.solutions.productNameLabel}
                      </label>
                      <input
                        type="text"
                        value={solName}
                        onChange={(e) => setSolName(e.target.value)}
                        placeholder={APP_COPY.solutions.productNamePlaceholder}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 select-text"
                        required
                      />
                    </div>

                    {/* URL input */}
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] text-slate-400 tracking-wider block uppercase font-bold">
                        {APP_COPY.solutions.productUrlLabel}
                      </label>
                      <input
                        type="url"
                        value={solUrl}
                        onChange={(e) => setSolUrl(e.target.value)}
                        placeholder={APP_COPY.solutions.productUrlPlaceholder}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 select-text"
                        required
                      />
                    </div>

                    {/* Icon URL input */}
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] text-slate-400 tracking-wider block uppercase font-bold flex justify-between">
                        <span>Product Icon Logo URL</span>
                        <span className="text-[9px] text-slate-500 font-normal lowercase normal-case">Optional</span>
                      </label>
                      <input
                        type="url"
                        value={solIconUrl}
                        onChange={(e) => setSolIconUrl(e.target.value)}
                        placeholder="e.g., https://my-app.com/logo.png"
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 select-text"
                      />
                    </div>

                    {/* Description textarea */}
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] text-slate-400 tracking-wider block uppercase font-bold">
                        {APP_COPY.solutions.descriptionLabel}
                      </label>
                      <textarea
                        value={solDesc}
                        onChange={(e) => setSolDesc(e.target.value)}
                        placeholder={APP_COPY.solutions.descriptionPlaceholder}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-amber-500 select-text resize-none h-20"
                        required
                      />
                    </div>

                    {/* Founder name input */}
                    <div className="space-y-1.5">
                      <label className="font-mono text-[10px] text-slate-400 tracking-wider block uppercase font-bold flex justify-between">
                        <span>{APP_COPY.solutions.founderNameLabel}</span>
                        <span className="text-[9px] text-slate-500 font-normal lowercase normal-case">Optional</span>
                      </label>
                      <input
                        type="text"
                        value={solBuilderName}
                        onChange={(e) => setSolBuilderName(e.target.value)}
                        placeholder={APP_COPY.solutions.founderNamePlaceholder}
                        className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-amber-500 select-text"
                      />
                    </div>

                    {solutionError && (
                      <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl flex items-center gap-2 text-red-300 text-xs">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{solutionError}</span>
                      </div>
                    )}

                    <div className="pt-2 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSolutionForm(false);
                          setEditingSolutionId(null);
                        }}
                        className="font-mono text-xs uppercase text-slate-400 px-5 py-2.5 rounded-xl hover:text-slate-100 cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={submittingSolution}
                        className="h-11 flex items-center justify-center gap-2 font-mono text-xs tracking-wider uppercase font-bold bg-gradient-to-r from-teal-500 to-amber-500 text-slate-950 px-6 rounded-xl hover:opacity-95 cursor-pointer"
                      >
                        {submittingSolution ? (
                          <span className="flex items-center gap-2">
                            <ButtonSpinner size="sm" />
                            {APP_COPY.solutions.submitButtonLoading}
                          </span>
                        ) : (
                          editingSolutionId ? "Update Solution" : APP_COPY.solutions.submitButtonText
                        )}
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Custom Operations Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Custom Operations Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        type="warning"
        title="Delete Listed Product?"
        message="Are you sure you want to permanently delete your listed solution? This action is irreversible and will remove all associated reviews."
        confirmText="Yes, Delete"
        cancelText="Cancel"
        onConfirm={executeSolutionDelete}
        onClose={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
      />

    </div>
  );
}
