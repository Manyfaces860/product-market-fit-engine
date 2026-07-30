/**
 * 🏆 Centralized Role Perks & Rate Limit Configuration
 * Governs rate limiting quotas, features, and visual badges based on user role.
 * Role-based values are loaded dynamically inside the API rate-limiters and dashboard UI.
 */

export interface RolePerks {
  role: 'reporter' | 'builder' | 'admin';
  label: string;
  badgeColor: string;          // Tailwind class for badge text/bg/border
  rateLimitPerMin: number;      // Quota of API requests allowed per minute
  rateLimitPerDay: number;      // Quota of API requests allowed per day (24h)
  canListSolutions: boolean;    // Permissions to submit product solutions
  canEditSolutions: boolean;    // Permissions to modify listed solutions
  allowExternalLinks: boolean;  // Unlocks custom clickable external product URLs
  customLinksEnabled: boolean;  // Unlocks custom GitHub and personal portfolio fields on dashboard
  launchNotificationsQuota: number; // Maximum automated launch notification blasts allowed
  perksHighlights: string[];    // Bullet points displayed on their dashboard console
}

export const ROLE_PERKS_CONFIG: Record<string, RolePerks> = {
  reporter: {
    role: 'reporter',
    label: 'Community Reporter',
    badgeColor: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
    rateLimitPerMin: 5,         // Safe rate limiting for general users
    rateLimitPerDay: 50,        // Safe daily limit
    canListSolutions: false,    // Must first list a product to trigger promotion loop
    canEditSolutions: false,
    allowExternalLinks: false,
    customLinksEnabled: false,
    launchNotificationsQuota: 5, // Receive alerts for up to 5 problem groups
    perksHighlights: [
      "Voice new tech pain points on the crowdsourced ledger",
      "Co-sign existing problem groups using the 'Me Too' tool",
      "Rate solutions using the Reddit-style community voting engine",
      "Submit reviews and star ratings to vet listed tools",
      "Get auto-promoted to Builder instantly when you submit your first solution!"
    ]
  },
  
  builder: {
    role: 'builder',
    label: 'Verified Builder',
    badgeColor: 'text-teal-400 bg-teal-500/10 border-teal-500/20 shadow-[0_0_15px_rgba(20,184,166,0.1)]',
    rateLimitPerMin: 30,        // 🌟 6x higher minute rate limit!
    rateLimitPerDay: 500,       // 🌟 10x higher daily request limit!
    canListSolutions: true,
    canEditSolutions: true,
    allowExternalLinks: true,   // Clickable direct traffic to their product websites
    customLinksEnabled: true,   // Showcases builder's GitHub and personal portfolio on solutions
    launchNotificationsQuota: 9999, // Unlimited launch notifications to their co-signer lists
    perksHighlights: [
      "⚡ 6x Higher Rate Limits (30 requests/min, 500/day) for heavy usage",
      "🚀 Direct traffic with protocol-safe, verified links pointing to your product website",
      "📢 Automatic Email Blasts sent to all co-signers of a niche the instant you list a fix",
      "👤 Customize your Builder Bio, personal portfolio, and GitHub URLs directly in MongoDB",
      "⭐ Earn the Verified Builder Badge next to your name and listings"
    ]
  },

  admin: {
    role: 'admin',
    label: 'System Operations Admin',
    badgeColor: 'text-red-500 bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.15)]',
    rateLimitPerMin: 120,       // Maximum speed for system administration
    rateLimitPerDay: 5000,      // Max daily request capacity
    canListSolutions: true,
    canEditSolutions: true,
    allowExternalLinks: true,
    customLinksEnabled: true,
    launchNotificationsQuota: 9999,
    perksHighlights: [
      "👑 Access the Executive System Operations dashboard",
      "🔧 Curation & Reassignment tools to clean and manage active problem centroids",
      "📊 Volume costs and analytics charts tracker",
      "🛠️ Full read/write capability to maintain database cleanliness"
    ]
  }
};