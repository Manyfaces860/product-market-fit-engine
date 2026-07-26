'use client';

import { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import { 
  BarChart3, 
  Layers, 
  TrendingUp, 
  Users, 
  Database, 
  DollarSign, 
  Activity, 
  FileText, 
  Check, 
  ShieldAlert, 
  ArrowLeft, 
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { motion } from 'framer-motion';
import { PageScanner, ButtonSpinner } from '@/components/Loader';

interface AdminStats {
  totalClustersCount: number;
  totalSolutionsCount: number;
  totalReviewsCount: number;
  totalTransactions: number;
  totalCostEstimated: number;
  avgProblemCharCount: number;
  avgProblemWordCount: number;
  avgProblemTokenCount: number;
  avgCostPerSubmission: number;
  costsByType: {
    submission: number;
    search: number;
    'me-too': number;
  };
  categoryPopularity: Record<string, number>;
}

interface ProblemRecord {
  id: string;
  rawText: string;
  category: string;
  clusterId: string;
  createdAt: string;
}

interface ClusterRecord {
  id: string;
  category: string;
  categoryLabel: string;
  categoryDescription: string;
  canonicalText: string;
  memberCount: number;
  sampleVariants: string[];
  createdAt: string;
  lastUpdatedAt: string;
}

export default function AdminDashboardPage() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Read role claim securely
  const role = (user?.publicMetadata?.role as string) || 'user';
  const isAdmin = role === 'admin';

  // Curation panel states
  const [allClusters, setAllClusters] = useState<ClusterRecord[]>([]);
  const [selectedClusterId, setSelectedClusterId] = useState<string>('');
  const [problemsCache, setProblemsCache] = useState<Record<string, ProblemRecord[]>>({});
  const [rawProblems, setRawProblems] = useState<ProblemRecord[]>([]);
  const [loadingProblems, setLoadingProblems] = useState(false);
  const [reassigningId, setReassigningId] = useState<string | null>(null);
  const [reassignTargets, setReassignTargets] = useState<Record<string, string>>({}); // problemId -> targetClusterId

  // Load all clusters on mount for the selection lists
  useEffect(() => {
    if (!isAdmin) return;
    async function loadAllClusters() {
      try {
        const res = await fetch('/api/clusters');
        if (res.ok) {
          const data = await res.json();
          setAllClusters(data || []);
        }
      } catch (err) {
        console.error('Failed to load clusters list:', err);
      }
    }
    loadAllClusters();
  }, [isAdmin]);

  // Load raw problems dynamically (using client-side cache fallback)
  useEffect(() => {
    if (!selectedClusterId) {
      setRawProblems([]);
      return;
    }

    // Pull instantly from client-side cache if present!
    if (problemsCache[selectedClusterId]) {
      setRawProblems(problemsCache[selectedClusterId]);
      return;
    }

    // Cache miss: execute background network fetch
    async function loadProblems() {
      setLoadingProblems(true);
      try {
        const res = await fetch(`/api/admin/problems?clusterId=${selectedClusterId}`);
        if (res.ok) {
          const data = await res.json();
          const problemsList = data.problems || [];
          setProblemsCache(prev => ({ ...prev, [selectedClusterId]: problemsList }));
          setRawProblems(problemsList);
        }
      } catch (err) {
        console.error('Failed to load raw problems:', err);
      } finally {
        setLoadingProblems(false);
      }
    }
    loadProblems();
  }, [selectedClusterId, problemsCache]);

  const forceRefreshProblems = async () => {
    if (!selectedClusterId) return;
    setLoadingProblems(true);
    try {
      const res = await fetch(`/api/admin/problems?clusterId=${selectedClusterId}`);
      if (res.ok) {
        const data = await res.json();
        const problemsList = data.problems || [];
        setProblemsCache(prev => ({ ...prev, [selectedClusterId]: problemsList }));
        setRawProblems(problemsList);
        alert('Curation list successfully synchronized with live database records!');
      }
    } catch (err) {
      console.error('Failed to refresh problems:', err);
      alert('Failed to refresh data.');
    } finally {
      setLoadingProblems(false);
    }
  };

  const handleReassignSubmit = async (problemId: string) => {
    const targetClusterId = reassignTargets[problemId];
    if (!targetClusterId) {
      alert('Please select a target group first!');
      return;
    }

    setReassigningId(problemId);
    try {
      const res = await fetch('/api/admin/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          problemId,
          sourceClusterId: selectedClusterId,
          targetClusterId,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Failed to reassign problem.');
      }

      // Success: update both the local view AND the client-side cache to keep them aligned
      const updatedList = rawProblems.filter(p => p.id !== problemId);
      setRawProblems(updatedList);
      setProblemsCache(prev => ({
        ...prev,
        [selectedClusterId]: updatedList
      }));
      
      // Clean up dropdown target map
      setReassignTargets(prev => {
        const next = { ...prev };
        delete next[problemId];
        return next;
      });

      // Update statistics card counts locally
      if (stats) {
        setStats({
          ...stats,
          costsByType: {
            ...stats.costsByType,
            // Reassign has small re-embedding cost
            'me-too': stats.costsByType['me-too'] + 0.00000002 * 2 // two re-embeddings
          }
        });
      }

      alert('Problem successfully reassigned and parent statistics updated!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setReassigningId(null);
    }
  };

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !isAdmin) return;

    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.message || 'Failed to retrieve administrative data.');
        }
        setStats(data.stats);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [isLoaded, isSignedIn, isAdmin]);

  if (!isLoaded) {
    return <PageScanner message="Resolving secure credentials..." />;
  }

  // 1. GATED ACCESS SCREEN (Unauthorized)
  if (!isSignedIn || !isAdmin) {
    return (
      <div className="mx-auto max-w-xl text-center py-32 px-4 select-none">
        <div className="mx-auto w-14 h-12 bg-red-500/10 border border-red-500/35 rounded-full flex items-center justify-center text-red-500 mb-6 animate-pulse">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold font-sans text-slate-100">Access Denied</h1>
        <p className="text-slate-400 text-sm mt-3 leading-relaxed">
          You are not authorized to view this page. This dashboard is restricted strictly to verified Administrators. 
          If you are the owner, please log in with your Admin account.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Link
            href="/"
            className="font-mono text-xs font-bold uppercase bg-white/5 hover:bg-white/10 px-6 py-2.5 rounded-xl border border-white/5 text-slate-200 flex items-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Home
          </Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return <PageScanner message="Calculating cost metrics & database counts..." />;
  }

  if (error || !stats) {
    return (
      <div className="mx-auto max-w-xl text-center py-32 px-4">
        <ShieldAlert className="mx-auto h-12 w-12 text-red-500 mb-4" />
        <h1 className="text-xl font-bold font-sans text-slate-200">Database Connection Failed</h1>
        <p className="text-slate-400 text-xs mt-2">{error || 'Unable to fetch admin statistics.'}</p>
        <Link
          href="/"
          className="inline-block mt-6 font-mono text-xs font-bold uppercase bg-white/10 hover:bg-white/15 px-4 py-2 rounded-lg"
        >
          Return Home
        </Link>
      </div>
    );
  }

  // Calculate costs breakout ratios for the charts
  const totalCost = stats.totalCostEstimated || 0.0001;
  const subRatio = ((stats.costsByType.submission || 0) / totalCost) * 100;
  const searchRatio = ((stats.costsByType.search || 0) / totalCost) * 100;
  const metooRatio = ((stats.costsByType['me-too'] || 0) / totalCost) * 100;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-10">
      
      {/* Back Link */}
      <div className="flex items-center justify-between border-b border-white/5 pb-6">
        <div>
          <span className="font-mono text-[10px] tracking-[0.3em] text-red-500 uppercase font-bold">
            Executive Admin Console
          </span>
          <h1 className="mt-1 text-2xl sm:text-4xl font-display font-bold italic tracking-tight text-slate-100">
            System Operations Dashboard
          </h1>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-xs text-slate-400 hover:text-slate-100 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Home
        </Link>
      </div>

      {/* Grid: 4 Core Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1: Total Groups */}
        <div className="p-6 bg-slate-900/50 border border-white/5 rounded-2xl relative overflow-hidden shadow-xl">
          <div className="absolute top-4 right-4 p-2 bg-amber-500/10 rounded-xl text-amber-500">
            <Database className="h-5 w-5" />
          </div>
          <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-bold">Active Problem Groups</p>
          <h3 className="mt-2 text-3xl font-display font-bold italic text-slate-100">{stats.totalClustersCount}</h3>
          <p className="text-xs text-slate-500 mt-2">Unique centroids in Pinecone</p>
        </div>

        {/* Card 2: Total Solutions */}
        <div className="p-6 bg-slate-900/50 border border-white/5 rounded-2xl relative overflow-hidden shadow-xl">
          <div className="absolute top-4 right-4 p-2 bg-teal-500/10 rounded-xl text-teal-400">
            <Activity className="h-5 w-5" />
          </div>
          <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-bold">Product Solutions Launched</p>
          <h3 className="mt-2 text-3xl font-display font-bold italic text-slate-100">{stats.totalSolutionsCount}</h3>
          <p className="text-xs text-slate-500 mt-2">Active products validated by upvotes</p>
        </div>

        {/* Card 3: User Reviews */}
        <div className="p-6 bg-slate-900/50 border border-white/5 rounded-2xl relative overflow-hidden shadow-xl">
          <div className="absolute top-4 right-4 p-2 bg-blue-500/10 rounded-xl text-blue-400">
            <Users className="h-5 w-5" />
          </div>
          <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-bold">Vetting Reviews Submitted</p>
          <h3 className="mt-2 text-3xl font-display font-bold italic text-slate-100">{stats.totalReviewsCount}</h3>
          <p className="text-xs text-slate-500 mt-2">Relational feedback stored in MongoDB</p>
        </div>

        {/* Card 4: Estimated Cost */}
        <div className="p-6 bg-slate-900/50 border border-white/5 rounded-2xl relative overflow-hidden shadow-xl bg-gradient-to-r from-red-500/5 to-transparent">
          <div className="absolute top-4 right-4 p-2 bg-red-500/10 rounded-xl text-red-500">
            <DollarSign className="h-5 w-5" />
          </div>
          <p className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-bold">Estimated AI API Spend</p>
          <h3 className="mt-2 text-3xl font-display font-bold italic text-red-400">${stats.totalCostEstimated.toFixed(4)}</h3>
          <p className="text-xs text-slate-500 mt-2">{stats.totalTransactions} Total Vector / LLM requests</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Left Column: Cost Breakouts & Token Stats */}
        <div className="space-y-8">
          
          {/* Section: AI Cost Allocations */}
          <div className="p-6 bg-slate-900/30 border border-white/5 rounded-2xl shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-display font-bold text-slate-200 italic flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-red-500" /> AI API Budget Allocations
              </h3>
              <p className="text-slate-400 text-xs font-mono uppercase tracking-wider">
                DISTRIBUTION OF SPEND BY COMPLETED PIPELINE ACTIONS
              </p>
            </div>

            {/* Horizontal Stacked Chart bar */}
            <div className="space-y-4">
              <div className="h-4 w-full bg-slate-950 rounded-full overflow-hidden flex">
                <div style={{ width: `${subRatio}%` }} className="h-full bg-gradient-to-r from-amber-500 to-amber-600" title="Draft submissions" />
                <div style={{ width: `${searchRatio}%` }} className="h-full bg-gradient-to-r from-teal-400 to-teal-500" title="Semantic searches" />
                <div style={{ width: `${metooRatio}%` }} className="h-full bg-gradient-to-r from-red-400 to-red-500" title="Me Too co-signs" />
              </div>

              {/* Legends with costs */}
              <div className="grid grid-cols-3 gap-2 text-xs font-mono select-none">
                <div className="space-y-1 text-left">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" />
                    <span className="text-slate-400 uppercase text-[9px] font-bold">Submissions</span>
                  </div>
                  <p className="text-slate-200 font-semibold text-xs">${stats.costsByType.submission.toFixed(4)}</p>
                  <p className="text-[9px] text-slate-500">{subRatio.toFixed(1)}% of budget</p>
                </div>

                <div className="space-y-1 text-center border-x border-white/5 px-2">
                  <div className="flex items-center gap-1.5 justify-center">
                    <span className="w-2.5 h-2.5 bg-teal-400 rounded-full" />
                    <span className="text-slate-400 uppercase text-[9px] font-bold">Searches</span>
                  </div>
                  <p className="text-slate-200 font-semibold text-xs">${stats.costsByType.search.toFixed(4)}</p>
                  <p className="text-[9px] text-slate-500">{searchRatio.toFixed(1)}% of budget</p>
                </div>

                <div className="space-y-1 text-right">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="w-2.5 h-2.5 bg-red-400 rounded-full" />
                    <span className="text-slate-400 uppercase text-[9px] font-bold">Co-signs</span>
                  </div>
                  <p className="text-slate-200 font-semibold text-xs">${stats.costsByType['me-too'].toFixed(4)}</p>
                  <p className="text-[9px] text-slate-500">{metooRatio.toFixed(1)}% of budget</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section: Tokens & Problem Sizing */}
          <div className="p-6 bg-slate-900/30 border border-white/5 rounded-2xl shadow-xl space-y-6">
            <div>
              <h3 className="text-lg font-display font-bold text-slate-200 italic flex items-center gap-2">
                <FileText className="h-5 w-5 text-amber-500" /> Input Payload & Token Statistics
              </h3>
              <p className="text-slate-400 text-xs font-mono uppercase tracking-wider">
                RAW USER DESCRIPTION SIZES TO ASSESS MAX CHARACTER BOUNDARIES
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 font-mono border-t border-white/5 pt-6 text-center">
              <div>
                <span className="text-slate-500 text-[9px] uppercase tracking-widest block font-bold">Avg Character Count</span>
                <span className="text-2xl font-bold text-slate-200 block mt-1">{stats.avgProblemCharCount}</span>
                <span className="text-[8px] text-slate-500 lowercase mt-1 block">chars per problem</span>
              </div>
              
              <div className="border-y sm:border-y-0 sm:border-x border-white/5 py-4 sm:py-0">
                <span className="text-slate-500 text-[9px] uppercase tracking-widest block font-bold">Avg Word Count</span>
                <span className="text-2xl font-bold text-slate-200 block mt-1">{stats.avgProblemWordCount}</span>
                <span className="text-[8px] text-slate-500 lowercase mt-1 block">words per problem</span>
              </div>

              <div>
                <span className="text-slate-500 text-[9px] uppercase tracking-widest block font-bold">Estimated Tokens</span>
                <span className="text-2xl font-bold text-slate-200 block mt-1">{stats.avgProblemTokenCount}</span>
                <span className="text-[8px] text-slate-500 lowercase mt-1 block">tokens per input</span>
              </div>
            </div>

            <div className="p-4 bg-slate-950/40 border border-white/5 rounded-xl font-mono text-[9px] text-slate-400 leading-normal uppercase">
              💡 <strong className="text-slate-200">Strategic insight:</strong> Your character limit is set to <strong className="text-slate-200">500</strong>. 
              With an average input size of <strong className="text-slate-200">{stats.avgProblemCharCount} characters</strong>, users are utilizing <strong className="text-slate-200">{((stats.avgProblemCharCount / 500) * 100).toFixed(0)}%</strong> of their space. Your limits are perfectly sized for semantic clarity without token waste.
            </div>
          </div>

        </div>

        {/* Right Column: Niche Popularity & Growth Areas */}
        <div className="p-6 bg-slate-900/30 border border-white/5 rounded-2xl shadow-xl space-y-6">
          <div>
            <h3 className="text-lg font-display font-bold text-slate-200 italic flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-teal-400" /> Market Vertical Interest Map
            </h3>
            <p className="text-slate-400 text-xs font-mono uppercase tracking-wider">
              NICHES RANKED BY NUMBER OF TOTAL CUSTOMER REPORTS AND COMPLAINTS
            </p>
          </div>

          <div className="space-y-4 pt-4 border-t border-white/5">
            {Object.keys(stats.categoryPopularity).length > 0 ? (
              Object.entries(stats.categoryPopularity)
                .sort((a, b) => b[1] - a[1])
                .map(([category, count]) => (
                  <div key={category} className="space-y-1 text-xs">
                    <div className="flex justify-between items-center text-slate-300 font-mono text-[10px] tracking-wide font-semibold">
                      <span>{category}</span>
                      <span>{count} Reports</span>
                    </div>
                    <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden">
                      <div 
                        style={{ width: `${Math.min((count / Math.max(...Object.values(stats.categoryPopularity))) * 100, 100)}%` }} 
                        className="h-full bg-teal-400/80 rounded-full" 
                      />
                    </div>
                  </div>
                ))
            ) : (
              <div className="text-center font-mono text-[10px] text-slate-500 py-6">
                No market data recorded yet.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* MANUAL PROBLEM CURATION & OVERRIDES */}
      <div className="p-6 bg-slate-900/30 border border-white/5 rounded-2xl shadow-xl space-y-6 text-left">
        <div>
          <h3 className="text-xl font-display font-bold text-slate-200 italic flex items-center gap-2">
            <Layers className="h-5 w-5 text-amber-500" /> Manual Problem Curation & Overrides
          </h3>
          <p className="text-slate-400 text-xs font-mono uppercase tracking-wider">
            REASSIGN MISCLASSIFIED USER FRUSTRATIONS TO OPTIMIZE CLUSTER COEFFICIENTS
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {/* Selector column */}
          <div className="space-y-2">
            <label className="font-mono text-[10px] text-slate-400 tracking-wider block uppercase font-bold">
              1. Select Problem Group (Cluster)
            </label>
            <select
              value={selectedClusterId}
              onChange={(e) => setSelectedClusterId(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl px-2 py-2.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value=""> Choose a group to inspect </option>
              {allClusters.map((c) => (
                <option key={c.id} value={c.id} className="bg-slate-950">
                  [{c.categoryLabel}] {c.canonicalText.substring(0, 50)}...
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 font-sans leading-normal leading-relaxed pt-1.5">
              Choose an active group above. The dashboard will query all individual developer complaints currently mapped to this centroid coordinates.
            </p>
          </div>

          {/* Problems list & re-assign tool column (Col Span 2) */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex justify-between items-center h-5">
              <label className="font-mono text-[10px] text-slate-400 tracking-wider block uppercase font-bold">
                2. Mapped Complaints & Reassignment
              </label>
              {selectedClusterId && !loadingProblems && (
                <button
                  onClick={forceRefreshProblems}
                  className="font-mono text-[8px] uppercase tracking-widest font-bold text-slate-500 hover:text-amber-500 transition-colors cursor-pointer flex items-center gap-1.5 p-1 bg-white/5 hover:bg-white/10 rounded-lg px-2.5 py-1"
                  title="Force Sync with Live Database"
                >
                  <RefreshCw className="h-2.5 w-2.5 animate-pulse" />
                  <span>Sync DB</span>
                </button>
              )}
            </div>

            {loadingProblems ? (
              <div className="text-center py-10 font-mono text-[10px] text-slate-500 uppercase tracking-widest animate-pulse">
                Fetching individual complaints...
              </div>
            ) : selectedClusterId === '' ? (
              <div className="text-center py-12 border border-dashed border-white/5 rounded-2xl text-slate-500 font-mono text-[9px] uppercase tracking-widest">
                Select a problem group on the left to show user complaints
              </div>
            ) : rawProblems.length === 0 ? (
              <p className="text-xs text-slate-400 font-sans italic py-4">
                No individual complaints are mapped to this group anymore (perhaps they were all reassigned!).
              </p>
            ) : (
              <div className="space-y-4 max-h-[450px] overflow-y-auto pr-1">
                {rawProblems.map((prob) => {
                  const targetId = reassignTargets[prob.id] || '';
                  const isReassigning = reassigningId === prob.id;

                  return (
                    <div 
                      key={prob.id} 
                      className="p-4 bg-slate-950/40 border border-white/5 rounded-xl space-y-3 text-left hover:border-white/10 transition-colors"
                    >
                      <div>
                        <div className="flex justify-between items-center text-[9px] font-mono text-slate-500 uppercase pb-1.5">
                          <span>Complaint ID: {prob.id}</span>
                          <span>{new Date(prob.createdAt).toLocaleDateString()}</span>
                        </div>
                        <p className="text-slate-200 text-sm font-sans leading-relaxed">
                          "{prob.rawText}"
                        </p>
                      </div>

                      {/* Dropdown to reassign */}
                      <div className="flex items-center gap-3 pt-2.5 border-t border-white/5 flex-wrap">
                        <span className="font-mono text-[9px] text-slate-400 uppercase font-bold">
                          Move to:
                        </span>
                        <select
                          value={targetId}
                          onChange={(e) => {
                            const val = e.target.value;
                            setReassignTargets(prev => ({ ...prev, [prob.id]: val }));
                          }}
                          className="bg-slate-950 border border-white/5 hover:border-white/10 rounded-lg px-2.5 py-1 text-[10px] text-slate-300 focus:outline-none cursor-pointer max-w-[220px]"
                        >
                          <option value=""> Choose target group </option>
                          {allClusters
                            .filter(c => c.id !== selectedClusterId)
                            .map(c => (
                              <option key={c.id} value={c.id}>
                                [{c.categoryLabel}] {c.canonicalText.substring(0, 35)}...
                              </option>
                            ))}
                        </select>
                        <button
                          onClick={() => handleReassignSubmit(prob.id)}
                          disabled={!targetId || isReassigning}
                          className="h-7 px-3.5 bg-gradient-to-r from-brand-amber to-brand-coral text-slate-950 font-mono text-[9px] uppercase tracking-wider font-bold rounded-lg active:scale-95 transition-all cursor-pointer disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 ml-auto"
                        >
                          {isReassigning ? (
                            <>
                              <ButtonSpinner size="xs" />
                              <span>Moving...</span>
                            </>
                          ) : (
                            'Execute Move'
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
