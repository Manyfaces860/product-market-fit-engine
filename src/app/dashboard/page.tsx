'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, useUser, SignInButton } from '@/lib/clerk';
import { 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  ArrowUp, 
  Users, 
  MessageSquare, 
  Globe, 
  Lock, 
  FileText, 
  CheckCircle, 
  TrendingUp, 
  ChevronRight, 
  User, 
  Award,
  BookOpen,
  Zap,
  Save,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PageScanner } from '@/components/Loader';
import AlertModal from '@/components/AlertModal';

// Custom inline SVG Github Icon to prevent version mismatches in Lucide React 🚀
const GithubIcon = (props: React.SVGProps<SVGSVGElement>) => (
  <svg 
    viewBox="0 0 24 24" 
    width="20" 
    height="20" 
    stroke="currentColor" 
    strokeWidth="2" 
    fill="none" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={props.className}
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
  </svg>
);

interface ProblemRecord {
  id: string;
  clusterId: string;
  category: string;
  rawText: string;
  createdAt: string;
}

interface ClusterRecord {
  id: string;
  category: string;
  categoryLabel: string;
  canonicalText: string;
  memberCount: number;
  variantCount?: number;
}

interface SolutionRecord {
  id: string;
  clusterId: string;
  name: string;
  url: string;
  description: string;
  upvotes: number;
  reviewsCount: number;
  averageRating: number;
}

interface ReviewRecord {
  clusterId: string;
  solutionId: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: string;
}

interface UserProfile {
  userId: string;
  email: string;
  name: string;
  role: 'reporter' | 'builder' | 'admin';
  createdAt: string;
  customBio?: string;
  githubUrl?: string;
  websiteUrl?: string;
}

interface RolePerks {
  role: 'reporter' | 'builder' | 'admin';
  label: string;
  badgeColor: string;
  rateLimitPerMin: number;
  rateLimitPerDay: number;
  canListSolutions: boolean;
  canEditSolutions: boolean;
  allowExternalLinks: boolean;
  customLinksEnabled: boolean;
  launchNotificationsQuota: number;
  perksHighlights: string[];
}

export default function UserDashboard() {
  const { isLoaded: isAuthLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [perks, setPerks] = useState<RolePerks | null>(null);
  const [reporterProblems, setReporterProblems] = useState<ProblemRecord[]>([]);
  const [supportedClusters, setSupportedClusters] = useState<ClusterRecord[]>([]);
  const [builderSolutions, setBuilderSolutions] = useState<SolutionRecord[]>([]);
  const [builderReviews, setReviewFeed] = useState<ReviewRecord[]>([]);
  const [totalUpvotes, setTotalUpvotes] = useState(0);

  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [activeTab, setActiveTab] = useState<'reporter' | 'builder'>('reporter');

  // Interactive profile editor states
  const [bioInput, setBioInput] = useState('');
  const [githubInput, setGithubInput] = useState('');
  const [websiteInput, setWebsiteInput] = useState('');

  // Toast / Alert State
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    type: 'success' as 'success' | 'error' | 'info',
    title: '',
    message: ''
  });

  // 1. Fetch consolidated dashboard state from database
  useEffect(() => {
    if (!isAuthLoaded || !isSignedIn) return;

    async function loadDashboard() {
      setLoading(true);
      try {
        const res = await fetch('/api/user/dashboard');
        if (res.ok) {
          const data = await res.json();
          setProfile(data.profile);
          setPerks(data.perks);
          setReporterProblems(data.reporter.problems || []);
          setSupportedClusters(data.reporter.supportedClusters || []);
          setBuilderSolutions(data.builder.solutions || []);
          setReviewFeed(data.builder.reviews || []);
          setTotalUpvotes(data.builder.totalUpvotesScore || 0);

          // Pre-populate profile editor fields
          setBioInput('');
          setGithubInput('');
          setWebsiteInput('');

          // If they are builders or admins, default their dashboard focus to their Builder Console!
          if (data.profile.role === 'builder' || data.profile.role === 'admin') {
            setActiveTab('builder');
          }
        } else {
          const errorData = await res.json();
          console.error('Failed to load dashboard:', errorData);
        }
      } catch (err) {
        console.error('Error fetching dashboard payload:', err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [isAuthLoaded, isSignedIn]);

  // 2. Submit Builder Profile Customizations
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !perks || !perks.customLinksEnabled) return;

    setSavingProfile(true);
    try {
      const res = await fetch('/api/user/dashboard', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customBio: bioInput,
          githubUrl: githubInput,
          websiteUrl: websiteInput
        })
      });

      const data = await res.json();
      if (res.ok) {
        setProfile(prev => prev ? {
          ...prev,
          customBio: data.updatedFields.customBio ? data.updatedFields.customBio : profile.customBio,
          githubUrl: data.updatedFields.githubUrl ? data.updatedFields.githubUrl : profile.githubUrl,
          websiteUrl: data.updatedFields.websiteUrl ? data.updatedFields.websiteUrl : profile.websiteUrl,
        } : null);

        setAlertModal({
          isOpen: true,
          type: 'success',
          title: 'Profile Updated!',
          message: 'Your Builder Portfolio links and custom bio tagline have been successfully saved to MongoDB.'
        });
      } else {
        throw new Error(data.message || 'Unable to update profile.');
      }
    } catch (err: any) {
      setAlertModal({
        isOpen: true,
        type: 'error',
        title: 'Update Failed',
        message: err.message || 'An error occurred while saving your portfolio changes.'
      });
    } finally {
      setSavingProfile(false);
    }
  };

  // Auth loading screen
  if (!isAuthLoaded) {
    return <PageScanner message="Resolving secure credentials..." />;
  }

  // 1. GATED ACCESS SCREEN (Prompt sign in)
  if (!isSignedIn) {
    return (
      <div className="mx-auto max-w-xl text-center py-32 px-4 select-none flex flex-col items-center justify-center space-y-6">
        <div className="mx-auto w-14 h-12 bg-amber-500/10 border border-amber-500/35 rounded-full flex items-center justify-center text-amber-500 animate-pulse">
          <Lock className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-sans text-slate-100">Secure Console Access</h1>
          <p className="text-slate-400 text-xs mt-2 leading-relaxed">
            Please log in with your account to access your personalized reported history, supported waiting lists, and builder consoles.
          </p>
        </div>
        <SignInButton mode="modal">
          <button className="h-11 px-8 font-mono text-xs uppercase tracking-wider font-bold bg-gradient-to-r from-brand-amber to-brand-coral text-slate-950 rounded-xl hover:opacity-95 active:scale-95 transition-all shadow-[0_0_15px_rgba(245,158,11,0.2)] cursor-pointer">
            Sign In to System Console
          </button>
        </SignInButton>
      </div>
    );
  }

  // Database loading screen
  if (loading || !profile || !perks) {
    return <PageScanner message="Assembling your dynamic workspaces & logs..." />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-10 bg-slate-950 text-slate-100 min-h-screen relative selection:bg-teal-500/25 selection:text-teal-200">
      
      {/* Dynamic Background Glowing Blobs */}
      <div className={`absolute top-10 right-1/4 w-[300px] h-[300px] rounded-full blur-3xl pointer-events-none transition-all duration-1000 ${
        profile.role === 'builder' ? 'bg-teal-500/5' : 'bg-amber-500/5'
      }`} />

      {/* =========================================================================
          📰 HEADER CARD (AVATAR + ROLE BADGE)
         ========================================================================= */}
      <div className="p-8 bg-slate-900/40 border border-white/5 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6 relative overflow-hidden shadow-2xl backdrop-blur-3xl">
        <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          {/* Avatar frame */}
          <div className={`w-16 h-16 rounded-full border-2 flex items-center justify-center relative overflow-hidden select-none shrink-0 ${
            profile.role === 'builder' ? 'border-teal-400/50 shadow-[0_0_20px_rgba(20,184,166,0.15)]' : 'border-amber-500/35'
          }`}>
            {clerkUser?.imageUrl ? (
              <img src={clerkUser.imageUrl} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <User className="h-7 w-7 text-slate-400" />
            )}
            
            {/* Pulsing indicator for active builder */}
            {profile.role === 'builder' && (
              <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-teal-400 border-2 border-slate-900 rounded-full flex items-center justify-center animate-pulse" />
            )}
          </div>

          <div className="space-y-1">
            <h1 className="text-xl sm:text-2xl font-bold font-sans capitalize text-slate-100 flex flex-wrap items-center gap-3 justify-center sm:justify-start">
              {profile.name}
              
              {/* Dynamic Badges */}
              <span className={`px-2.5 py-0.5 rounded-full border text-[9px] font-mono font-bold uppercase tracking-wider ${perks.badgeColor}`}>
                {profile.role === 'builder' && <Award className="h-3 w-3 inline mr-1 -mt-0.5 animate-bounce" />}
                {perks.label}
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-mono tracking-wide">
              Registered Account: <span className="text-slate-300">{new Date(profile.createdAt).toLocaleDateString()}</span>
            </p>
            <span className="text-[12px] font-mono text-slate-500 uppercase tracking-widest block flex flex-wrap items-center gap-x-2 gap-y-1 justify-center sm:justify-start">
              {profile.customBio && (
                <span className="text-slate-400 italic normal-case font-sans">
                  ({profile.customBio})
                </span>
              )}
              {profile.githubUrl && (
                <a 
                  href={profile.githubUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-slate-500 hover:text-slate-300 p-0.5 transition-colors"
                  title="Builder GitHub Profile"
                >
                  <GithubIcon className="h-3 w-3 inline -mt-0.5" />
                </a>
              )}
              {profile.websiteUrl && (
                <a 
                  href={profile.websiteUrl} 
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

        {/* Builder Aggregate Metrics */}
        {(profile.role === 'builder' || profile.role === 'admin') && (
          <div className="flex gap-4 shrink-0 font-mono select-none">
            <div className="px-5 py-3.5 bg-slate-950/70 border border-white/5 rounded-xl text-center min-w-[100px] shadow-lg">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-bold">SOLUTIONS</span>
              <strong className="text-xl font-bold text-teal-400">{builderSolutions.length}</strong>
            </div>
            <div className="px-5 py-3.5 bg-slate-950/70 border border-white/5 rounded-xl text-center min-w-[100px] shadow-lg">
              <span className="text-[9px] text-slate-500 uppercase tracking-widest block font-bold">TOTAL SCORE</span>
              <strong className="text-xl font-bold text-teal-400">+{totalUpvotes}</strong>
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          🎯 TAB SELECTOR (FOR ELEVATED TIER)
         ========================================================================= */}
      {(profile.role === 'builder' || profile.role === 'admin') && (
        <div className="flex gap-2 border-b border-white/5 pb-2">
          <button
            onClick={() => setActiveTab('reporter')}
            className={`px-5 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'reporter'
                ? 'bg-amber-500/10 text-brand-amber border border-brand-amber/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Community Reporter Workspace
          </button>
          <button
            onClick={() => setActiveTab('builder')}
            className={`px-5 py-2 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === 'builder'
                ? 'bg-teal-500/10 text-teal-400 border border-teal-400/20 shadow-[0_0_15px_rgba(20,184,166,0.05)]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            Verified Builder Console
          </button>
        </div>
      )}

      {/* =========================================================================
          📂 TWO COLUMN LAYOUT
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        {/* =========================================================================
            LEFT COLUMN: ROLE HIGHLIGHTS + PORTFOLIO EDITOR
           ========================================================================= */}
        <div className="space-y-6 lg:sticky lg:top-8">
          
          {/* Box 1: Dynamic Perks highlights */}
          <div className="p-6 bg-slate-900/20 border border-white/5 rounded-2xl space-y-4">
            <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest block font-bold flex items-center gap-1.5 border-b border-white/5 pb-3">
              <Zap className="h-4 w-4 text-amber-500 shrink-0" /> Dynamic Role Benefits
            </h3>
            
            <ul className="space-y-3.5 text-xs text-slate-300">
              {perks.perksHighlights.map((perk, idx) => (
                <li key={idx} className="flex gap-2.5 leading-relaxed font-sans">
                  <CheckCircle className="h-4 w-4 text-teal-400 shrink-0 mt-0.5" />
                  <span>{perk}</span>
                </li>
              ))}
            </ul>

            <div className="pt-3 border-t border-white/5 flex flex-col gap-2 font-mono text-[10px] text-slate-500">
              <div className="flex justify-between">
                <span>Speed limits (Minute):</span>
                <strong className="text-slate-300 font-semibold">{perks.rateLimitPerMin} req / min</strong>
              </div>
              <div className="flex justify-between">
                <span>Validation limits (Daily):</span>
                <strong className="text-slate-300 font-semibold">{perks.rateLimitPerDay} req / day</strong>
              </div>
            </div>
          </div>

          {/* Box 2: Portfolio customizer (Locked vs Active) */}
          <div className="relative overflow-hidden rounded-2xl border border-white/5">
            
            {/* Blurry lock backdrop for Reporter tier */}
            {!perks.customLinksEnabled && (
              <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-md z-10 flex flex-col items-center justify-center p-6 text-center select-none space-y-4">
                <div className="p-3 bg-amber-500/10 border border-amber-500/35 rounded-full text-brand-amber">
                  <Lock className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-200">Portfolio Features Locked</h4>
                  <p className="text-[10px] text-slate-400 leading-normal leading-relaxed mt-2 max-w-[210px] mx-auto">
                    Submit your first verified product solution to promote your account, unlock 6x faster speed, and edit your custom founder card!
                  </p>
                </div>
                <Link
                  href="/browse"
                  className="inline-flex h-8 px-4 items-center justify-center font-mono text-[9px] uppercase tracking-widest font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-lg"
                >
                  Scan Problems & Solve
                </Link>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="p-6 bg-slate-900/20 space-y-4">
              <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest block font-bold flex items-center gap-1.5 border-b border-white/5 pb-3">
                <Award className="h-4 w-4 text-teal-400 shrink-0 animate-spin" style={{ animationDuration: '6s' }} /> Builder Profile Customizer
              </h3>

              {/* Bio Field */}
              <div className="space-y-1">
                <label className="font-mono text-[9px] text-slate-400 tracking-wider block uppercase font-bold">
                  Founder bio tagline (160 Chars)
                </label>
                <textarea
                  value={bioInput}
                  onChange={(e) => setBioInput(e.target.value.substring(0, 160))}
                  placeholder="e.g. Building micro-SaaS developer tooling since 2021. Founder of Webpack TurboLoader."
                  className="w-full bg-slate-950 border border-white/5 hover:border-white/10 rounded-xl p-3 text-xs text-slate-300 focus:outline-none focus:border-teal-400/50 resize-none h-20"
                />
              </div>

              {/* GitHub Field */}
              <div className="space-y-1">
                <label className="font-mono text-[9px] text-slate-400 tracking-wider block uppercase font-bold flex items-center gap-1">
                  <GithubIcon className="h-3 w-3" /> GitHub URL
                </label>
                <input
                  type="text"
                  value={githubInput}
                  onChange={(e) => setGithubInput(e.target.value)}
                  placeholder="github.com/your-username"
                  className="w-full bg-slate-950 border border-white/5 hover:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-teal-400/50"
                />
              </div>

              {/* Portfolio Field */}
              <div className="space-y-1">
                <label className="font-mono text-[9px] text-slate-400 tracking-wider block uppercase font-bold flex items-center gap-1">
                  <Globe className="h-3 w-3" /> Personal / Agency website URL
                </label>
                <input
                  type="text"
                  value={websiteInput}
                  onChange={(e) => setWebsiteInput(e.target.value)}
                  placeholder="https://your-agency.io"
                  className="w-full bg-slate-950 border border-white/5 hover:border-white/10 rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-teal-400/50"
                />
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="w-full h-9 bg-teal-400 text-slate-950 font-mono text-[9px] uppercase tracking-widest font-bold rounded-lg hover:bg-teal-300 transition-colors disabled:opacity-30 cursor-pointer flex items-center justify-center gap-1"
              >
                {savingProfile ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving Changes...
                  </>
                ) : (
                  <>
                    <Save className="h-3.5 w-3.5" /> Save Profile Details
                  </>
                )}
              </button>
            </form>
          </div>

        </div>

        {/* =========================================================================
            RIGHT COLUMN: CONSOLIDATED ACTIVE WORKSPACES (DYNAMIC ON TAB)
           ========================================================================= */}
        <div className="lg:col-span-2 space-y-6">
          <AnimatePresence mode="wait">
            
            {/* 📺 TAB PANEL A: REPORTER WORKSPACE */}
            {activeTab === 'reporter' && (
              <motion.div
                key="reporter-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Panel 1: Reported Complaints history */}
                <div className="p-6 bg-slate-900/20 border border-white/5 rounded-2xl space-y-5 shadow-xl">
                  <div>
                    <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest block font-bold flex items-center gap-1.5 border-b border-white/5 pb-3">
                      <FileText className="h-4 w-4 text-amber-500 shrink-0" /> My Reported Complaints ({reporterProblems.length})
                    </h3>
                    <p className="text-[10px] text-slate-500 font-sans mt-2">
                      The exact phrasings and developer complaints you have historically logged to the problem-market fit ledger.
                    </p>
                  </div>

                  {reporterProblems.length > 0 ? (
                    <div className="space-y-3.5 max-h-[400px] overflow-y-auto pr-1">
                      {reporterProblems.map((prob) => (
                        <div key={prob.id} className="p-4 bg-slate-950/60 border border-white/5 hover:border-white/10 rounded-xl relative group flex flex-col justify-between">
                          <div className="absolute top-3 right-4 font-mono text-[9px] text-slate-600">
                            {new Date(prob.createdAt).toLocaleDateString()}
                          </div>
                          <div className="font-mono text-[8px] text-amber-500 tracking-wider font-bold mb-1 uppercase">
                            Niche Key: {prob.category}
                          </div>
                          <p className="text-xs text-slate-200 italic font-sans pr-12 leading-relaxed">
                            &quot;{prob.rawText}&quot;
                          </p>
                          <div className="mt-3.5 pt-2 border-t border-white/5 flex items-center justify-between">
                            <span className="font-mono text-[8px] text-slate-600 uppercase font-bold">Problem Key: {prob.id}</span>
                            <Link
                              href={`/cluster/${prob.clusterId}`}
                              className="font-mono text-[9px] text-amber-500 hover:text-amber-400 flex items-center gap-1 transition-colors group-hover:translate-x-0.5 duration-300"
                            >
                              Inspect Niche Centroid <ChevronRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-white/5 rounded-xl text-slate-500 font-mono text-xs uppercase tracking-widest">
                      You haven't reported any frustrations yet.
                    </div>
                  )}
                </div>

                {/* Panel 2: Niches supported ("Me too" list) */}
                <div className="p-6 bg-slate-900/20 border border-white/5 rounded-2xl space-y-5 shadow-xl">
                  <div>
                    <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest block font-bold flex items-center gap-1.5 border-b border-white/5 pb-3">
                      <Users className="h-4 w-4 text-amber-500 shrink-0" /> Niches I Support (Me Too co-signs: {supportedClusters.length})
                    </h3>
                    <p className="text-[10px] text-slate-500 font-sans mt-2">
                      Active opportunities where you supported the demand. When builders list verified solutions to these groups, you will receive launch notifications.
                    </p>
                  </div>

                  {supportedClusters.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {supportedClusters.map((cluster) => (
                        <Link
                          key={cluster.id}
                          href={`/cluster/${cluster.id}`}
                          className="p-5 bg-slate-950/60 border border-white/5 hover:border-teal-400/25 rounded-xl group transition-all duration-300 flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-center justify-between font-mono text-[9px] tracking-widest uppercase mb-3">
                              <span className="text-amber-500 font-bold">{cluster.categoryLabel}</span>
                              <span className="text-slate-500 bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                                Signal: <strong className="text-slate-300 font-semibold">{cluster.memberCount}</strong>
                              </span>
                            </div>
                            <p className="text-slate-200 font-medium text-xs leading-relaxed group-hover:text-white transition-colors line-clamp-2">
                              &quot;{cluster.canonicalText}&quot;
                            </p>
                          </div>
                          
                          <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between">
                            <span className="font-mono text-[8px] text-slate-500 uppercase tracking-widest">
                              {cluster.variantCount} variations reported
                            </span>
                            <span className="text-[9px] font-mono text-amber-500 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              Inspect <ChevronRight className="h-3 w-3" />
                            </span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-white/5 rounded-xl text-slate-500 font-mono text-xs uppercase tracking-widest">
                      You haven't co-signed any niches yet.
                    </div>
                  )}
                </div>

              </motion.div>
            )}

            {/* 📺 TAB PANEL B: BUILDER CONSOLE */}
            {activeTab === 'builder' && (profile.role === 'builder' || profile.role === 'admin') && (
              <motion.div
                key="builder-tab"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Panel 1: My listed solutions */}
                <div className="p-6 bg-slate-900/20 border border-white/5 rounded-2xl space-y-5 shadow-xl">
                  <div>
                    <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest block font-bold flex items-center gap-1.5 border-b border-white/5 pb-3">
                      <BookOpen className="h-4 w-4 text-teal-400 shrink-0" /> My Listed Solutions ({builderSolutions.length})
                    </h3>
                    <p className="text-[10px] text-slate-500 font-sans mt-2">
                      Your verified products currently listed under crowdsourced demand niches. Click solutions to inspect ratings, reviews, and client logs.
                    </p>
                  </div>

                  {builderSolutions.length > 0 ? (
                    <div className="space-y-3.5 pr-1">
                      {builderSolutions.map((sol) => (
                        <div key={sol.id} className="p-5 bg-slate-950/60 border border-white/5 hover:border-white/10 rounded-xl relative group flex flex-col md:flex-row gap-5 items-stretch justify-between">
                          <div className="flex items-start gap-4">
                            {/* Vote metric */}
                            <div className="flex flex-col items-center justify-center px-4 py-2 bg-slate-900 border border-white/5 rounded-xl min-w-[70px] shrink-0 self-start text-center font-mono">
                              <ArrowUp className="h-4 w-4 text-teal-400 mb-0.5" />
                              <strong className="text-sm font-bold text-slate-200">+{sol.upvotes}</strong>
                              <span className="text-[8px] text-slate-500 uppercase tracking-widest font-bold mt-0.5">NET SCORE</span>
                            </div>

                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-slate-200">{sol.name}</h4>
                                <span className="text-[8px] font-mono text-teal-400 uppercase bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/10">verified</span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-relaxed font-sans max-w-lg">{sol.description}</p>
                              
                              <div className="pt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] text-slate-500">
                                <span className="flex items-center gap-1">
                                  <MessageSquare className="h-3.5 w-3.5 text-slate-600" /> {sol.reviewsCount} Reviews ({sol.averageRating} / 5.0 Rating)
                                </span>
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3.5 w-3.5 text-slate-600" /> <a href={sol.url} target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:text-teal-300 underline">{sol.url.replace(/^https?:\/\//, '')}</a>
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="border-t md:border-t-0 md:border-l border-white/5 pt-4 md:pt-0 md:pl-5 flex items-center md:justify-end shrink-0">
                            <Link
                              href={`/cluster/${sol.clusterId}`}
                              className="w-full md:w-auto h-9 px-4 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider text-slate-300 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              Inspect Niche <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-white/5 rounded-xl text-slate-500 font-mono text-xs uppercase tracking-widest">
                      You haven't listed any software or hardware product solutions yet.
                    </div>
                  )}
                </div>

                {/* Panel 2: Live Community Review Feed */}
                <div className="p-6 bg-slate-900/20 border border-white/5 rounded-2xl space-y-5 shadow-xl">
                  <div>
                    <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest block font-bold flex items-center gap-1.5 border-b border-white/5 pb-3">
                      <MessageSquare className="h-4 w-4 text-teal-400 shrink-0" /> Live Community Review Feed ({builderReviews.length})
                    </h3>
                    <p className="text-[10px] text-slate-500 font-sans mt-2">
                      Star ratings and written developer feedback submitted historically for any of your listed products.
                    </p>
                  </div>

                  {builderReviews.length > 0 ? (
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-1">
                      {builderReviews.map((rev, idx) => (
                        <div key={idx} className="p-4 bg-slate-950/60 border border-white/5 rounded-xl space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 bg-white/5 border border-white/10 rounded-full flex items-center justify-center text-[10px] font-mono text-slate-400">
                                {rev.userName.substring(0, 1).toUpperCase()}
                              </div>
                              <strong className="text-xs text-slate-300">{rev.userName}</strong>
                            </div>
                            
                            {/* Star rating banner */}
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 font-mono text-[9px] rounded font-bold uppercase tracking-wider">
                              ★ {rev.rating}.0 Rating
                            </div>
                          </div>

                          <p className="text-[11px] text-slate-400 font-sans leading-relaxed italic pr-6 pl-8">
                            &quot;{rev.text}&quot;
                          </p>

                          <div className="text-right text-[8px] font-mono text-slate-600 pl-8 pt-1">
                            Submitted on {new Date(rev.createdAt).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 border border-dashed border-white/5 rounded-xl text-slate-500 font-mono text-xs uppercase tracking-widest">
                      No customer reviews have been submitted for your solutions yet.
                    </div>
                  )}
                </div>

              </motion.div>
            )}

          </AnimatePresence>
        </div>

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