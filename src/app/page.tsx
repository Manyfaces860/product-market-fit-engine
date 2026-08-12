'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth, SignInButton } from '@clerk/nextjs';
import { 
  ArrowRight, 
  TrendingUp, 
  ChevronRight, 
  Search, 
  Cpu, 
  Database, 
  ShieldCheck, 
  Sparkles, 
  Layers, 
  ArrowUp, 
  Users, 
  ThumbsUp, 
  Lock 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { HOMEPAGE_COPY } from '@/lib/config/homepage_copy';
import { PageScanner } from '@/components/Loader';

interface Cluster {
  id: string;
  category: string;
  categoryLabel: string;
  categoryDescription: string;
  canonicalText: string;
  memberCount: number;
  sampleVariants: string[];
}

export default function LandingPage() {
  const { isSignedIn } = useAuth();
  const [trending, setTrending] = useState<Cluster[]>([]);
  const [loadingNiches, setLoadingNiches] = useState(true);

  // Search Mock Interactive State
  const [searchMockPhase, setSearchMockPhase] = useState<'idle' | 'typing' | 'scanning' | 'matched'>('idle');
  const [searchText, setSearchText] = useState('');
  
  // Submit Mock Interactive State
  const [submitMockStage, setSubmitMockStage] = useState(0);

  // Voting Mock State
  const [mockUpvoted, setMockUpvoted] = useState(false);
  const [mockDownvoted, setMockDownvoted] = useState(false);
  const [mockScore, setMockScore] = useState(12);

  // 1. Fetch live active niches from MongoDB Atlas to show real-time platform signal! 🚀
  useEffect(() => {
    async function loadActiveSignals() {
      setLoadingNiches(true);
      try {
        const res = await fetch('/api/clusters');
        if (res.ok) {
          const data = await res.json();
          setTrending(data.slice(0, 4)); // Show top 4 active clusters
        }
      } catch (err) {
        console.error('Failed to load active signals:', err);
      } finally {
        setLoadingNiches(false);
      }
    }
    loadActiveSignals();
  }, []);

  // 2. Interactive Search Mock Typing Loop
useEffect(() => {
  const fullText = HOMEPAGE_COPY.features.list[0]?.interactiveInput || 'flaky microfrontend compile failures';
  let timer: ReturnType<typeof setTimeout>;
  let cancelled = false;

  const runSearchSimulation = () => {
    if (cancelled) return;
    setSearchMockPhase('typing');
    setSearchText('');

    let index = 0;

    const typeChar = () => {
      if (cancelled) return;

      if (index < fullText.length) {
        const char = fullText[index];
        index++;
        setSearchText(prev => prev + char);
        timer = setTimeout(typeChar, 40);
        return;
      }

      // Finished typing, trigger scan!
      timer = setTimeout(() => {
        if (cancelled) return;
        setSearchMockPhase('scanning');

        // Scan for 1.5 seconds, then show match!
        timer = setTimeout(() => {
          if (cancelled) return;
          setSearchMockPhase('matched');

          // Hold match for 4 seconds, then repeat!
          timer = setTimeout(runSearchSimulation, 4000);
        }, 1500);
      }, 800);
    };

    // Start typing delay
    timer = setTimeout(typeChar, 1000);
  };

  runSearchSimulation();

  return () => {
    cancelled = true;
    clearTimeout(timer);
  };
}, []);

  // 3. Interactive Submit Lifecycle Stage Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setSubmitMockStage(prev => (prev + 1) % 3);
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  // 4. Handle Mock Votes toggles
  const handleMockVote = (type: 'up' | 'down') => {
    if (type === 'up') {
      if (mockUpvoted) {
        setMockUpvoted(false);
        setMockScore(12);
      } else {
        setMockUpvoted(true);
        setMockDownvoted(false);
        setMockScore(13);
      }
    } else {
      if (mockDownvoted) {
        setMockDownvoted(false);
        setMockScore(12);
      } else {
        setMockDownvoted(true);
        setMockUpvoted(false);
        setMockScore(11);
      }
    }
  };

  return (
    <div className="flex-grow flex flex-col items-center justify-start py-8 px-4 sm:px-6 lg:px-8 space-y-24 bg-slate-950 text-slate-100 overflow-hidden relative selection:bg-amber-500/25 selection:text-amber-200">
      
      {/* Decorative Brand Ambient Glowing Spots */}
      <div className="absolute top-20 left-1/4 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-96 right-1/4 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* =========================================================================
          🚀 HERO SECTION
         ========================================================================= */}
      <section className="w-full max-w-6xl text-center pt-12 md:pt-16 flex flex-col items-center justify-center relative">
        <motion.div
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/5 font-mono text-[9px] text-amber-500 font-bold uppercase tracking-[0.2em] mb-6 select-none shadow-[0_0_15px_rgba(245,158,11,0.1)]"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <Sparkles className="h-3 w-3 animate-spin" style={{ animationDuration: '4s' }} /> {HOMEPAGE_COPY.hero.badge}
        </motion.div>

        <motion.h1 
          className="text-3xl sm:text-5xl md:text-6xl font-display font-bold italic tracking-tight leading-tight py-2 bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent max-w-4xl"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
        >
          {HOMEPAGE_COPY.hero.title}
        </motion.h1>

        <motion.p
          className="mt-6 text-sm sm:text-base md:text-lg text-slate-400 max-w-2xl font-sans leading-relaxed"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
        >
          {HOMEPAGE_COPY.hero.subtitle}
        </motion.p>

        {/* Maidensail Trust Badge */}
        <motion.div
          className="mt-6 flex justify-center"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.25, duration: 0.6 }}
        >
          <a 
            href="https://maidensail.com/startup/needboard" 
            rel="dofollow" 
            className="inline-flex items-center px-4 py-2.5 rounded-2xl border border-white/5 bg-slate-950/65 hover:border-brand-amber/30 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] backdrop-blur-xl transition-all duration-300 group cursor-pointer"
          >
            <img 
              src="https://maidensail.com/badge/needboard.svg" 
              alt="Listed on Maidensail" 
              height="28" 
              className="opacity-75 group-hover:opacity-100 transition-opacity duration-300"
            />
          </a>
        </motion.div>

        {/* Hero CTAs */}
        <motion.div
          className="mt-10 flex flex-row items-center justify-center gap-4 w-full flex-wrap"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <Link
            href="/submit"
            className="h-12 px-6 flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider font-bold bg-gradient-to-r from-brand-amber to-brand-coral text-slate-950 rounded-xl hover:opacity-95 active:scale-95 transition-all shadow-[0_0_20px_rgba(245,158,11,0.2)] cursor-pointer"
          >
            <Layers className="h-4 w-4" /> {HOMEPAGE_COPY.hero.ctaValidate}
          </Link>
          <Link
            href="/browse"
            className="h-12 px-6 flex items-center justify-center gap-2 font-mono text-xs uppercase tracking-wider font-bold bg-white/5 border border-white/10 text-slate-200 rounded-xl hover:bg-white/10 hover:border-white/15 active:scale-95 transition-all cursor-pointer"
          >
            {HOMEPAGE_COPY.hero.ctaExplore} <ArrowRight className="h-4 w-4" />
          </Link>
        </motion.div>
      </section>

      {/* =========================================================================
          💡 ABOUT / WHAT IS IT SECTION
         ========================================================================= */}
      <section className="w-full max-w-5xl bg-slate-900/20 border border-white/5 p-8 sm:p-12 rounded-3xl backdrop-blur-2xl relative overflow-hidden flex flex-col md:flex-row gap-8 items-center justify-between shadow-xl">
        <div className="absolute top-0 left-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="space-y-3 md:max-w-xs shrink-0 text-center md:text-left">
          <span className="font-mono text-[10px] text-amber-500 uppercase tracking-widest block font-bold">
            ABOUT THE PLATFORM
          </span>
          <h2 className="text-2xl sm:text-3xl font-display font-bold italic text-slate-100">
            {HOMEPAGE_COPY.about.title}
          </h2>
          <p className="text-xs text-slate-400 font-mono tracking-wide leading-relaxed">
            {HOMEPAGE_COPY.about.subtitle}
          </p>
        </div>

        <p className="text-slate-300 text-sm leading-relaxed max-w-xl font-sans text-center md:text-left border-t md:border-t-0 md:border-l border-white/5 pt-6 md:pt-0 md:pl-8">
          {HOMEPAGE_COPY.about.description}
        </p>
      </section>

      {/* =========================================================================
          🛠️ SYSTEM MODULES / FEATURES SECTION
         ========================================================================= */}
      <motion.section 
        layout 
        transition={{ type: 'spring', stiffness: 220, damping: 28 }}
        className="w-full max-w-6xl space-y-16"
      >
        <div className="text-center space-y-3">
          <span className="font-mono text-[10px] text-amber-500 uppercase tracking-widest block font-bold">
            CORE ENGINE CAPABILITIES
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold italic text-slate-100">
            {HOMEPAGE_COPY.features.title}
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto font-sans leading-relaxed">
            {HOMEPAGE_COPY.features.subtitle}
          </p>
        </div>

        {/* Feature 1: Semantic Search */}
        <motion.div 
          layout 
          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center"
        >
          <div className="space-y-4">
            <span className="font-mono text-[10px] text-amber-500 tracking-wider font-bold block">
              {HOMEPAGE_COPY.features.list[0]?.badge}
            </span>
            <h3 className="text-2xl font-bold text-slate-100 italic font-display">
              {HOMEPAGE_COPY.features.list[0]?.title}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed font-sans">
              {HOMEPAGE_COPY.features.list[0]?.desc}
            </p>
          </div>
          
          {/* Interactive Search Console Mock */}
          <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl shadow-2xl relative font-mono text-xs select-none">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              <span>{HOMEPAGE_COPY.features.list[0]?.interactiveTitle}</span>
              <div className="flex gap-1">
                <span className="w-2 h-2 rounded-full bg-red-500/40" />
                <span className="w-2 h-2 rounded-full bg-amber-500/40" />
                <span className="w-2 h-2 rounded-full bg-teal-500/40" />
              </div>
            </div>

            {/* 🚀 motion.div layout enables gorgeous, smooth height-easing transitions! */}
            <motion.div 
              layout 
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="bg-slate-950/80 rounded-xl p-4 border border-white/5 h-[185px] flex flex-col justify-between space-y-4"
            >
              <div className="flex items-start gap-2">
                <span className="text-amber-500 font-bold shrink-0">$ query:</span>
                <span className="text-slate-300">
                  {searchText}
                  {searchMockPhase === 'typing' && <span className="animate-pulse font-bold text-amber-500">|</span>}
                </span>
              </div>

              <AnimatePresence mode="wait">
                {searchMockPhase === 'scanning' && (
                  <motion.div 
                    key="scanning"
                    className="flex items-center gap-2 text-teal-400 text-[10px] font-bold tracking-widest uppercase animate-pulse"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <Cpu className="h-4 w-4 animate-spin" /> Scanning HNSW MongoDB Vector Index...
                  </motion.div>
                )}

                {searchMockPhase === 'matched' && (
                  <motion.div
                    key="matched"
                    className="p-3 bg-teal-500/5 border border-teal-500/20 rounded-xl space-y-1.5"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <div className="flex items-center justify-between text-[9px] text-teal-400 font-bold uppercase tracking-wider">
                      <span>Matched Problem Centroid</span>
                      <span className="bg-teal-500/10 px-2 py-0.5 rounded border border-teal-500/20">{HOMEPAGE_COPY.features.list[0]?.interactiveScore}</span>
                    </div>
                    <p className="text-xs text-slate-200 leading-normal italic">&quot;{HOMEPAGE_COPY.features.list[0]?.interactiveMatch}&quot;</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </motion.div>

        {/* Feature 2: Seeding Lifecycle (Flipped) */}
        <motion.div 
          layout 
          transition={{ type: 'spring', stiffness: 220, damping: 28 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center pt-6"
        >
          {/* Interactive Seeding lifecycle Console Mock (Left column) */}
          <div className="lg:order-last space-y-4">
            <span className="font-mono text-[10px] text-amber-500 tracking-wider font-bold block">
              {HOMEPAGE_COPY.features.list[1]?.badge}
            </span>
            <h3 className="text-2xl font-bold text-slate-100 italic font-display">
              {HOMEPAGE_COPY.features.list[1]?.title}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed font-sans">
              {HOMEPAGE_COPY.features.list[1]?.desc}
            </p>
          </div>

          <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl shadow-2xl relative font-mono text-xs select-none">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4 text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              <span>{HOMEPAGE_COPY.features.list[1]?.interactiveTitle}</span>
              <div className="flex gap-1.5">
                <span className={`w-2 h-2 rounded-full transition-colors duration-500 ${submitMockStage === 0 ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]' : 'bg-white/5'}`} />
                <span className={`w-2 h-2 rounded-full transition-colors duration-500 ${submitMockStage === 1 ? 'bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.5)]' : 'bg-white/5'}`} />
                <span className={`w-2 h-2 rounded-full transition-colors duration-500 ${submitMockStage === 2 ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]' : 'bg-white/5'}`} />
              </div>
            </div>

            {/* 🚀 motion.div layout enables gorgeous, smooth height-easing transitions! */}
            <motion.div 
              layout 
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
              className="bg-slate-950/80 rounded-xl p-4 border border-white/5 space-y-4 h-[185px] flex flex-col justify-center"
            >
              {(HOMEPAGE_COPY.features.list[1]?.stages || []).map((stage, idx) => {
                const isActive = submitMockStage === idx;
                return (
                  <div 
                    key={idx} 
                    className={`transition-all duration-500 ${isActive ? 'opacity-100 scale-100 translate-x-1.5' : 'opacity-25 scale-95 pointer-events-none'}`}
                  >
                    <span className={`font-bold block text-[9px] uppercase tracking-wider mb-0.5 ${isActive ? 'text-amber-500' : 'text-slate-500'}`}>
                      {stage.label}
                    </span>
                    <p className={`text-xs leading-normal ${isActive ? 'text-slate-200' : 'text-slate-400'}`}>
                      {isActive ? stage.value : '...'}
                    </p>
                  </div>
                );
              })}
            </motion.div>
          </div>
        </motion.div>

        {/* Feature 3: Reddit-Style voting */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center pt-6">
          <div className="space-y-4">
            <span className="font-mono text-[10px] text-amber-500 tracking-wider font-bold block">
              {HOMEPAGE_COPY.features.list[2]?.badge}
            </span>
            <h3 className="text-2xl font-bold text-slate-100 italic font-display">
              {HOMEPAGE_COPY.features.list[2]?.title}
            </h3>
            <p className="text-slate-400 text-sm leading-relaxed font-sans">
              {HOMEPAGE_COPY.features.list[2]?.desc}
            </p>
          </div>

          {/* Interactive Voting Console Mock */}
          <div className="p-6 bg-slate-900/50 border border-white/10 rounded-2xl shadow-2xl relative select-none">
            <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-5 font-mono text-[10px] text-slate-500 uppercase font-bold tracking-wider">
              <span>{HOMEPAGE_COPY.features.list[2]?.interactiveTitle}</span>
            </div>

            {/* Simulated Solution Card */}
            <div className="p-5 bg-slate-950/60 border border-white/5 rounded-xl flex flex-col gap-3 backdrop-blur-xl">
              <div className="flex items-start gap-4">
                {/* Voting Stack */}
                <div className="flex flex-col items-center gap-1 shrink-0 font-mono">
                  <button
                    onClick={() => handleMockVote('up')}
                    className={`w-7 h-7 rounded border flex items-center justify-center cursor-pointer transition-all ${
                      mockUpvoted
                        ? 'bg-amber-500/20 text-brand-amber border-brand-amber/35 shadow-[0_0_10px_rgba(245,158,11,0.15)]'
                        : 'bg-slate-900 text-slate-400 border-white/5 hover:text-slate-200'
                    }`}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <span className={`text-[10px] font-bold ${mockUpvoted ? 'text-brand-amber' : mockDownvoted ? 'text-rose-500' : 'text-slate-400'}`}>
                    {mockScore > 0 ? `+${mockScore}` : mockScore}
                  </span>
                  <button
                    onClick={() => handleMockVote('down')}
                    className={`w-7 h-7 rounded border flex items-center justify-center cursor-pointer transition-all ${
                      mockDownvoted
                        ? 'bg-rose-500/20 text-rose-500 border-rose-500/35 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                        : 'bg-slate-900 text-slate-400 border-white/5 hover:text-slate-200'
                    }`}
                  >
                    <ArrowUp className="h-3.5 w-3.5 rotate-180" />
                  </button>
                </div>

                {/* Content */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-slate-200 leading-none">{HOMEPAGE_COPY.features.list[2]?.solName}</h4>
                    <span className="text-[8px] font-mono text-teal-400 uppercase bg-teal-500/10 px-1.5 py-0.5 rounded border border-teal-500/10">verified</span>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{HOMEPAGE_COPY.features.list[2]?.solDesc}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-white/5">
                <span className="font-mono text-[9px] text-amber-500 uppercase tracking-widest font-bold">
                  {HOMEPAGE_COPY.features.list[2]?.reviewsCount}
                </span>
              </div>
            </div>
          </div>
        </div>

      </motion.section>

      {/* =========================================================================
          👥 THE ECOSYSTEM (REPORTERS VS BUILDERS) SECTION
         ========================================================================= */}
      <section className="w-full max-w-6xl space-y-16">
        <div className="text-center space-y-3">
          <span className="font-mono text-[10px] text-amber-500 uppercase tracking-widest block font-bold">
            THE PLATFORM PARTICIPANTS
          </span>
          <h2 className="text-3xl sm:text-4xl font-display font-bold italic text-slate-100">
            {HOMEPAGE_COPY.ecosystem.title}
          </h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto font-sans leading-relaxed">
            {HOMEPAGE_COPY.ecosystem.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
          
          {/* Reporter Card */}
          <div className="p-8 bg-slate-900/30 border border-white/5 rounded-2xl flex flex-col justify-between shadow-xl relative overflow-hidden backdrop-blur-3xl group hover:border-white/10 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="font-mono text-[9px] text-amber-500 uppercase tracking-widest font-bold block">ROLE DEFINITION</span>
                <h3 className="text-2xl font-bold font-display italic text-slate-100">{HOMEPAGE_COPY.ecosystem.reporters.title}</h3>
                <p className="text-xs text-slate-400 font-mono tracking-wide">{HOMEPAGE_COPY.ecosystem.reporters.subtitle}</p>
              </div>

              <div className="space-y-4">
                {HOMEPAGE_COPY.ecosystem.reporters.benefits.map((ben, idx) => (
                  <div key={idx} className="flex gap-3">
                    <span className="font-mono text-[9px] text-amber-500/60 font-bold pt-1">0{idx+1} /</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{ben.title}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1 font-sans">{ben.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/5 flex">
              <Link
                href="/submit"
                className="font-mono text-[10px] tracking-widest uppercase font-bold text-amber-500 hover:text-amber-400 flex items-center gap-1.5 transition-colors"
              >
                Launch Problem Seeder <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

          {/* Builder Card */}
          <div className="p-8 bg-slate-900/30 border border-white/5 rounded-2xl flex flex-col justify-between shadow-xl relative overflow-hidden backdrop-blur-3xl group hover:border-white/10 transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-teal-500/5 rounded-full blur-2xl pointer-events-none" />
            <div className="space-y-6">
              <div className="space-y-1">
                <span className="font-mono text-[9px] text-teal-400 uppercase tracking-widest font-bold block">ROLE PROMOTION</span>
                <h3 className="text-2xl font-bold font-display italic text-slate-100">{HOMEPAGE_COPY.ecosystem.builders.title}</h3>
                <p className="text-xs text-slate-400 font-mono tracking-wide">{HOMEPAGE_COPY.ecosystem.builders.subtitle}</p>
              </div>

              <div className="space-y-4">
                {HOMEPAGE_COPY.ecosystem.builders.benefits.map((ben, idx) => (
                  <div key={idx} className="flex gap-3">
                    <span className="font-mono text-[9px] text-teal-400/60 font-bold pt-1">0{idx+1} /</span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-200">{ben.title}</h4>
                      <p className="text-[11px] text-slate-400 leading-relaxed mt-1 font-sans">{ben.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-4 border-t border-white/5 flex">
              <Link
                href="/browse"
                className="font-mono text-[10px] tracking-widest uppercase font-bold text-teal-400 hover:text-teal-300 flex items-center gap-1.5 transition-colors"
              >
                Scan Validated Niches <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>

        </div>
      </section>

      {/* =========================================================================
          📊 ACTIVE PROBLEM CAROUSEL / LIVE SIGNALS SECTION
         ========================================================================= */}
      <section className="w-full max-w-6xl space-y-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-6">
          <div>
            <span className="font-mono text-[10px] text-amber-500 uppercase tracking-widest block font-bold">
              PLATFORM TELEMETRY
            </span>
            <h2 className="text-2xl sm:text-3xl font-display font-bold italic flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-amber-500" /> {HOMEPAGE_COPY.activeSignals.title}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm font-mono tracking-wider mt-1">
              {HOMEPAGE_COPY.activeSignals.subtitle}
            </p>
          </div>
          <Link
            href="/browse"
            className="font-mono text-[10px] tracking-widest uppercase font-bold text-slate-400 hover:text-slate-100 flex items-center gap-1.5 transition-colors group cursor-pointer"
          >
            {HOMEPAGE_COPY.activeSignals.ctaText} <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        {trending.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {trending.map((cluster) => (
              <Link 
                key={cluster.id}
                href={`/cluster/${cluster.id}`}
                className="group relative p-6 bg-slate-900/40 border border-white/5 rounded-2xl hover:bg-slate-900/60 hover:border-white/10 transition-all duration-300 shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between font-mono text-[10px] tracking-widest uppercase mb-3">
                    <span className="text-amber-500 font-bold">{cluster.categoryLabel}</span>
                    <span className="text-slate-500 bg-white/5 px-2 py-0.5 rounded flex items-center gap-1">
                      Signal: <strong className="text-slate-300 font-semibold">{cluster.memberCount}</strong>
                    </span>
                  </div>
                  <p className="text-slate-200 font-medium text-base leading-relaxed group-hover:text-white transition-colors">
                    &quot;{cluster.canonicalText}&quot;
                  </p>
                </div>

                <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between">
                  <span className="font-mono text-[9px] text-slate-500 uppercase tracking-widest italic">
                    {cluster.sampleVariants.length} variations of this problem reported
                  </span>
                  <span className="text-[10px] font-mono text-amber-500 group-hover:text-amber-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Inspect <ChevronRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : loadingNiches ? (
          <PageScanner message="Scanning database signals..." size="md" /> // 🚀 Stunning centered loader!
        ) : (
          <div className="text-center py-16 border border-dashed border-white/5 rounded-2xl text-slate-500 font-mono text-xs uppercase tracking-widest">
            No active collective signals found. Run seeder to get started!
          </div>
        )}
      </section>

    </div>
  );
}