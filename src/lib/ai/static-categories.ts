// 1. Core Category definitions
// status: 'active' = currently accepting submissions (LLM classifies only into these)
// status: 'coming-soon' = visible on browse but locked until we expand focus
const staticCategories = [
    { id: 'software-devtools', label: 'Developer Tools & DX', description: 'Friction in local developer workflows, compilation bottlenecks, flaky testing environments, and monorepo configurations.', status: 'active' },
    { id: 'software-saas', label: 'SaaS & B2B Productivity', description: 'Administrative bottlenecks, calendar coordination headaches, and collaborative document syncing issues.', status: 'active' },
    { id: 'hardware-iot', label: 'Hardware & Smart Devices', description: 'Physical gadget issues, router band pairing headaches, and customized adapter shortages.', status: 'coming-soon' },
    { id: 'ecommerce-ops', label: 'E-commerce & Shipping Ops', description: 'Multi-channel inventory syncing, custom label printing bottlenecks, and automated return processing.', status: 'coming-soon' },
    { id: 'ai-operations', label: 'AI & Data Infrastructure', description: 'High LLM processing latencies, vector indexing sync issues, rate-limiting, and unstructured document parsing.', status: 'coming-soon' },
    
    // B2B-leaning
    { id: 'fintech-payments', label: 'Fintech & Payments', description: 'Failed payment reconciliation, multi-currency invoicing headaches, and clunky subscription billing edge cases.', status: 'coming-soon' },
    { id: 'hr-people-ops', label: 'HR & People Ops', description: 'Onboarding paperwork chaos, PTO tracking across time zones, and performance review tools nobody actually uses.', status: 'coming-soon' },
    { id: 'security-compliance', label: 'Security & Compliance', description: 'Audit trail gaps, access permission sprawl, and manual compliance checklists that eat entire afternoons.', status: 'coming-soon' },
    { id: 'customer-support', label: 'Customer Support & Success', description: 'Ticket routing that misfires, knowledge bases nobody keeps updated, and support tools disconnected from the actual product.', status: 'coming-soon' },

    // B2C-leaning
    { id: 'healthtech', label: 'Health & Wellness', description: 'Appointment scheduling friction, patient records that don\'t follow you between providers, and wearable data that never adds up right.', status: 'coming-soon' },
    { id: 'consumer-finance', label: 'Personal Finance & Budgeting', description: 'Budgeting apps that miss real spending patterns, tax prep confusion, and shared expense tracking with roommates or partners.', status: 'coming-soon' },
    { id: 'edtech-learning', label: 'Education & Learning', description: 'Clunky classroom tools, disjointed grading workflows, and course content lost across platform migrations.', status: 'coming-soon' },
    { id: 'real-estate-housing', label: 'Real Estate & Housing', description: 'Manual lease review, outdated listing data, and landlord-tenant communication stuck in email threads.', status: 'coming-soon' },
];

export const isFocusedCategory = (id: string): boolean =>
    staticCategories.some(c => c.id === id && c.status === 'active');

export const focusedCategories = staticCategories.filter(c => c.status === 'active');

export default staticCategories;