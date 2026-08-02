    
// 1. Core Category definitions
const staticCategories = [
    { id: 'software-devtools', label: 'Developer Tools & DX', description: 'Friction in local developer workflows, compilation bottlenecks, flaky testing environments, and monorepo configurations.' },
    { id: 'software-saas', label: 'SaaS & B2B Productivity', description: 'Administrative bottlenecks, calendar coordination headaches, and collaborative document syncing issues.' },
    { id: 'hardware-iot', label: 'Hardware & Smart Devices', description: 'Physical gadget issues, router band pairing headaches, and customized adapter shortages.' },
    { id: 'ecommerce-ops', label: 'E-commerce & Shipping Ops', description: 'Multi-channel inventory syncing, custom label printing bottlenecks, and automated return processing.' },
    { id: 'ai-operations', label: 'AI & Data Infrastructure', description: 'High LLM processing latencies, vector indexing sync issues, rate-limiting, and unstructured document parsing.' },
    
    // B2B-leaning
    { id: 'fintech-payments', label: 'Fintech & Payments', description: 'Failed payment reconciliation, multi-currency invoicing headaches, and clunky subscription billing edge cases.' },
    { id: 'hr-people-ops', label: 'HR & People Ops', description: 'Onboarding paperwork chaos, PTO tracking across time zones, and performance review tools nobody actually uses.' },
    { id: 'security-compliance', label: 'Security & Compliance', description: 'Audit trail gaps, access permission sprawl, and manual compliance checklists that eat entire afternoons.' },
    { id: 'customer-support', label: 'Customer Support & Success', description: 'Ticket routing that misfires, knowledge bases nobody keeps updated, and support tools disconnected from the actual product.' },

    // B2C-leaning
    { id: 'healthtech', label: 'Health & Wellness', description: 'Appointment scheduling friction, patient records that don\'t follow you between providers, and wearable data that never adds up right.' },
    { id: 'consumer-finance', label: 'Personal Finance & Budgeting', description: 'Budgeting apps that miss real spending patterns, tax prep confusion, and shared expense tracking with roommates or partners.' },
    { id: 'edtech-learning', label: 'Education & Learning', description: 'Clunky classroom tools, disjointed grading workflows, and course content lost across platform migrations.' },
    { id: 'real-estate-housing', label: 'Real Estate & Housing', description: 'Manual lease review, outdated listing data, and landlord-tenant communication stuck in email threads.' },
];

export default staticCategories;