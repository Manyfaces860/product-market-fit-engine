/**
 * 🌌 High-Conversion Homepage Copy Configuration
 * Stores all textual content, explanations, and value propositions for the NeedBoard landing page.
 * Speaks directly to both General Developers (Reporters) and SaaS/Hardware Founders (Builders).
 * Strictly clean of low-level database jargon or implementation details.
 */
export const HOMEPAGE_COPY = {
  hero: {
    badge: "WHERE REAL PROBLEMS MEET REAL BUILDERS",
    title: "Stop guessing what to build. Start building what people are already asking for.",
    subtitle: "NeedBoard is a public marketplace of real, everyday problems reported by developers and teams — bugs that block them, workflows that waste hours, gaps no tool fills yet. Builders come here to see exactly what's broken and who's waiting for a fix, so every product starts with proof that someone wants it.",
    ctaValidate: "Report a Problem",
    ctaExplore: "Browse Problems",
  },

  about: {
    title: "What is NeedBoard?",
    subtitle: "A meeting point for people stuck with a problem and the builders who can solve it.",
    description: "Every day, developers and teams lose hours to things that just don't work — flaky tests, broken integrations, clunky manual processes. At the same time, founders spend months building products that end up with no one to use them. NeedBoard fixes both problems at once: anyone can report a real frustration, our system groups similar reports into a single clear 'problem,' and builders can see exactly how many people are affected before they write a single line of code. No guesswork, no cold marketing — just problems worth solving, and the people who need them solved.",
  },

  features: {
    title: "What You Can Do on NeedBoard",
    subtitle: "Three simple ways the platform turns everyday frustration into real solutions.",
    
    list: [
      {
        id: "explore",
        badge: "01 / FIND YOUR PROBLEM, INSTANTLY",
        title: "Search by Meaning, Not Just Words",
        desc: "You shouldn't have to guess the 'right' words to find a problem that already exists. Describe your frustration in your own words, and NeedBoard understands what you mean, not just what you typed — so 'flaky E2E script' finds the same group as 'Cypress tests failing randomly.' This means less duplicate reporting for you, and a clearer, bigger signal for builders.",
        interactiveTitle: "Live Search Mockup",
        interactiveInput: "flaky microfrontend hot reloading compile failures",
        interactiveMatch: "Flaky local testing setups and slow hot-reload compilation times",
        interactiveScore: "Match Score: 94%"
      },
      {
        id: "submit",
        badge: "02 / REPORT IT IN SECONDS",
        title: "Turn Your Frustration Into an Opportunity",
        desc: "Hit a wall with some tool or process? Tell us about it in plain language. NeedBoard instantly checks if others have reported the same thing — if so, your report adds weight to an existing problem; if not, you've just created a brand-new opportunity for a builder to solve. Either way, your frustration stops being wasted time and starts becoming visible demand.",
        interactiveTitle: "Log Frustration Lifecycle",
        stages: [
          { label: "1. Tell Us What's Wrong", value: "Parsing 200-page lease contracts is costing us hours of manual reviews..." },
          { label: "2. We Check for Matches", value: "Looking for others who've hit the same wall..." },
          { label: "3. Your Problem Goes Live", value: "New problem created: 'Massive unstructured PDF contract parsing' — now visible to builders!" }
        ]
      },
      {
        id: "curate",
        badge: "03 / THE BEST SOLUTIONS RISE TO THE TOP",
        title: "Real Users Decide What's Actually Good",
        desc: "Once builders start posting solutions, the community takes over. People who've faced the problem can upvote, downvote, and leave honest reviews on what actually worked. No paid placements, no marketing spend deciding the winner — just real feedback from people who needed a fix, separating genuinely useful tools from the noise.",
        interactiveTitle: "Live Voting Interface Mock",
        solName: "StockFlow Multi-Sync",
        solDesc: "Real-time webhook-based multi-channel inventory synchronization that updates stock levels under 1 second.",
        upvotesCount: "+12",
        reviewsCount: "💬 Reviews (5 / 5.0 Rating)"
      }
    ]
  },

  ecosystem: {
    title: "Built for Two Kinds of People",
    subtitle: "Whether you're stuck with a problem or looking for one worth solving, NeedBoard works for you.",
    
    reporters: {
      title: "If You Have a Problem",
      subtitle: "For Developers, Creators, and Teams",
      benefits: [
        {
          title: "Say What's Broken",
          desc: "Tired of a tool that doesn't work the way it should? Report it in seconds and put it in front of builders who might actually fix it."
        },
        {
          title: "Back Problems You Recognize",
          desc: "Seen this issue before? Click 'Me Too' to add your voice, making it clearer to builders just how many people need a solution."
        },
        {
          title: "Get Notified When It's Fixed",
          desc: "Once you report or back a problem, you're first to know. The moment a builder launches a solution, we email you directly — no need to keep checking back."
        }
      ]
    },

    builders: {
      title: "If You Want to Build Something People Need",
      subtitle: "For SaaS Founders, Indie Developers, and Creators",
      benefits: [
        {
          title: "Skip the Guesswork and the Cold Outreach",
          desc: "Build for people who are already asking for a fix. There's no need to convince anyone your product should exist — the demand is already there, documented and waiting."
        },
        {
          title: "Launch to an Audience That's Already Waiting",
          desc: "Every problem has people who've said 'I need this fixed.' The moment you publish your solution, we notify all of them for you — instant first users, with zero marketing spend."
        },
        {
          title: "Earn Trust as a Verified Builder",
          desc: "Get your product verified and unlock the 'Builder' badge, along with the credibility and visible links people need to trust and try what you've made."
        }
      ]
    }
  },

  activeSignals: {
    title: "Problems Being Solved Right Now",
    subtitle: "SEE WHAT DEVELOPERS ARE ASKING FOR — AND WHAT'S STILL UP FOR GRABS",
    ctaText: "See All Open Problems",
  }
};