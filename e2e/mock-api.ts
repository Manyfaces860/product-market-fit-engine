import { Page, Route, BrowserContext } from '@playwright/test';

/**
 * In-memory mock backend for the E2E suite.
 *
 * Pages make relative `fetch('/api/...')` calls; Playwright's `page.route`
 * intercepts every one of them at the browser level and fulfills them from
 * this store, so tests never touch MongoDB / Pinecone / LLM providers and
 * run fully offline.
 *
 * The store is stateful (member counts, votes, solutions, reviews) so multi-step
 * flows and cross-test sequences behave like the real server would.
 */

export interface MockSolution {
  id: string;
  clusterId: string;
  name: string;
  url: string;
  description: string;
  builderId: string;
  builderName: string;
  upvotes: number;
  votesUserIds: string[];
  downvotedUserIds: string[];
  createdAt: string;
  iconUrl?: string;
}

export interface MockCluster {
  id: string;
  category: string;
  categoryLabel: string;
  categoryDescription: string;
  canonicalText: string;
  memberCount: number;
  sampleVariants: string[];
  userIds: string[];
  creatorId: string;
  createdAt: string;
  lastUpdatedAt: string;
  solutions: MockSolution[];
}

export interface MockReview {
  clusterId: string;
  solutionId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface MockStore {
  clusters: MockCluster[];
  reviews: MockReview[];
}

const NOW = () => new Date().toISOString();

const SEED_SOLUTION: MockSolution = {
  id: 'sol-e2e-1',
  clusterId: 'cluster-e2e-calendar-sync',
  name: 'CrossSync Calendar Mock',
  url: 'https://crosssync.app',
  description: 'A mock calendar sync solution to verify upvotes and solutions.',
  builderId: 'user_e2e_test_id',
  builderName: 'E2E Tester',
  upvotes: 5,
  votesUserIds: ['user_e2e_admin_id', 'some_other_user_id'],
  downvotedUserIds: [],
  createdAt: NOW(),
};

export function createMockStore(): MockStore {
  const now = NOW();
  return {
    clusters: [
      {
        id: 'cluster-e2e-calendar-sync',
        category: 'software-saas',
        categoryLabel: 'SaaS & B2B Productivity',
        categoryDescription:
          'Administrative bottlenecks, calendar coordination headaches, and collaborative document syncing issues.',
        canonicalText:
          'No simple way to automatically sync real-time calendar availability across multiple independent external organizations',
        memberCount: 38,
        sampleVariants: [
          'I have a personal calendar, a work calendar, and a client calendar. Keeping them in sync manually is impossible.',
        ],
        userIds: ['some_other_user_id'],
        creatorId: 'some_other_user_id',
        createdAt: now,
        lastUpdatedAt: now,
        solutions: [SEED_SOLUTION],
      },
      {
        id: 'cluster-e2e-flaky-tests',
        category: 'software-devtools',
        categoryLabel: 'Developer Tools & DX',
        categoryDescription:
          'Friction in local developer workflows, compilation bottlenecks, flaky testing environments, and monorepo configurations.',
        canonicalText:
          'Flaky local testing setups and slow hot-reload compilation times in microfrontend development',
        memberCount: 54,
        sampleVariants: [
          'Webpack hot-reloading fails completely when running module federation in watch mode on larger monorepos.',
        ],
        userIds: ['some_other_user_id'],
        creatorId: 'some_other_user_id',
        createdAt: now,
        lastUpdatedAt: now,
        solutions: [],
      },
    ],
    reviews: [
      {
        clusterId: 'cluster-e2e-calendar-sync',
        solutionId: 'sol-e2e-1',
        userId: 'user_e2e_admin_id',
        userName: 'E2E Admin',
        rating: 5,
        text: 'This is a fantastic mock product!',
        createdAt: now,
      },
    ],
  };
}

/** Sets the simulated Clerk session cookies used by the app's E2E auth bypass. */
export async function setMockSession(
  context: BrowserContext,
  opts: { userId?: string; name?: string; role?: string } = {},
  baseURL?: string
) {
  const domain = baseURL ? new URL(baseURL).hostname : 'localhost';
  await context.addCookies([
    { name: 'e2e_user_id', value: opts.userId || 'user_e2e_test_id', domain, path: '/' },
    { name: 'e2e_user_name', value: opts.name || 'E2E Tester', domain, path: '/' },
    { name: 'e2e_user_role', value: opts.role || 'user', domain, path: '/' },
    { name: 'e2e_user_email', value: 'e2e@needboard.space', domain, path: '/' },
  ]);
}

/** Intercepts every /api/** request and serves it from the given store. */
export async function installApiMocks(page: Page, store: MockStore) {
  await page.route('**/api/**', (route) => handleApiRequest(route, store));
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

function userIdOf(route: Route): string {
  const cookie = route.request().headers()['cookie'] || '';
  const match = cookie.match(/(?:^|;\s*)e2e_user_id=([^;]+)/);
  return match ? match[1] : '';
}

function clusterById(store: MockStore, id: string): MockCluster | undefined {
  return store.clusters.find((c) => c.id === id);
}

function findSolution(cluster: MockCluster, solutionId: string): MockSolution | undefined {
  return cluster.solutions.find((s) => s.id === solutionId);
}

async function handleApiRequest(route: Route, store: MockStore) {
  const request = route.request();
  const method = request.method();
  const url = new URL(request.url());
  const segments = url.pathname.split('/').filter(Boolean); // e.g. ['api', 'clusters', ':id', 'solutions', ':sid']

  try {
    // GET /api/clusters?category=
    if (method === 'GET' && segments.length === 2 && segments[1] === 'clusters') {
      const category = url.searchParams.get('category');
      const clusters = store.clusters
        .filter((c) => !category || c.category === category)
        .sort((a, b) => b.memberCount - a.memberCount);
      return json(route, clusters);
    }

    // GET /api/categories
    if (method === 'GET' && segments.length === 2 && segments[1] === 'categories') {
      const byCategory = new Map<string, { label: string; description: string; clusters: number; members: number }>();
      for (const c of store.clusters) {
        const entry = byCategory.get(c.category) || { label: c.categoryLabel, description: c.categoryDescription, clusters: 0, members: 0 };
        entry.clusters += 1;
        entry.members += c.memberCount;
        byCategory.set(c.category, entry);
      }
      const categories = [...byCategory.entries()].map(([id, e]) => ({
        id,
        label: e.label,
        description: e.description,
        clusterCount: e.clusters,
        problemCount: e.members,
      }));
      return json(route, categories);
    }

    // GET /api/search?q=
    if (method === 'GET' && segments.length === 2 && segments[1] === 'search') {
      const query = (url.searchParams.get('q') || '').toLowerCase();
      const flaky = store.clusters.find((c) => c.id === 'cluster-e2e-flaky-tests')!;
      const calendar = store.clusters.find((c) => c.id === 'cluster-e2e-calendar-sync')!;
      const matchKeywords = ['webpack', 'hot', 'flaky', 'reload', 'monorepo', 'test', 'module federation'];
      const calendarKeywords = ['calendar', 'sync', 'schedule'];

      let results: (MockCluster & { score: number })[] = [];
      if (matchKeywords.some((k) => query.includes(k))) {
        results = [{ ...flaky, score: 0.92 }];
      } else if (calendarKeywords.some((k) => query.includes(k))) {
        results = [{ ...calendar, score: 0.85 }];
      }
      return json(route, results);
    }

    // POST /api/problems (draft analysis + finalize)
    if (method === 'POST' && segments.length === 2 && segments[1] === 'problems') {
      const body = request.postDataJSON() || {};
      const text: string = body.text || '';
      const lower = text.toLowerCase();
      const userId = userIdOf(route);

      if (body.draft !== false) {
        if (lower === 'asdfghjkl' || /^[a-z]+$/.test(lower)) {
          return json(
            route,
            { error: 'Rejected', message: 'Input appears to be meaningless gibberish or spam. Please describe a real-world problem in detail.' },
            400
          );
        }
        if (lower.includes('cookie')) {
          return json(
            route,
            { error: 'Rejected', message: 'Input appears to be out of scope for this platform. Please describe a product-solvable problem.' },
            400
          );
        }
        if (['webpack', 'hot-reload', 'module federation', 'monorepo'].some((k) => lower.includes(k))) {
          const cluster = clusterById(store, 'cluster-e2e-flaky-tests')!;
          return json(route, {
            mode: 'match',
            similarity: 0.91,
            cluster,
            proposedCategory: cluster.category,
            proposedCategoryLabel: cluster.categoryLabel,
            proposedCategoryDescription: cluster.categoryDescription,
            proposedCanonicalText: cluster.canonicalText,
          });
        }
        return json(route, {
          mode: 'new',
          similarity: 0.31,
          proposedCategory: 'software-devtools',
          proposedCategoryLabel: 'Developer Tools & DX',
          proposedCategoryDescription:
            'Friction in local developer workflows, compilation bottlenecks, flaky testing environments, and monorepo configurations.',
          proposedCanonicalText: 'Automatically compile release notes directly from Slack channels',
        });
      }

      // Finalize: join existing cluster when the text matches the seeded flaky-tests cluster
      const isMatch = ['webpack', 'hot-reload', 'module federation', 'monorepo'].some((k) => lower.includes(k));
      if (isMatch) {
        const cluster = clusterById(store, 'cluster-e2e-flaky-tests')!;
        if (!cluster.userIds.includes(userId)) {
          cluster.userIds.push(userId);
          cluster.memberCount += 1;
        }
        if (!cluster.sampleVariants.includes(text)) {
          cluster.sampleVariants.push(text);
        }
        cluster.lastUpdatedAt = NOW();
        return json(route, { success: true, joinedCluster: true, cluster, problemId: 'prob_mock_match' });
      }

      // Otherwise seed a brand new cluster
      const newCluster: MockCluster = {
        id: 'cluster-e2e-novel',
        category: body.confirmedCategory || 'software-devtools',
        categoryLabel: body.confirmedCategoryLabel || 'Developer Tools & DX',
        categoryDescription: body.confirmedCategoryDescription || 'General product-solvable frustrations.',
        canonicalText: body.confirmedCanonicalText || text,
        memberCount: 1,
        sampleVariants: [text],
        userIds: [userId],
        creatorId: userId,
        createdAt: NOW(),
        lastUpdatedAt: NOW(),
        solutions: [],
      };
      store.clusters.push(newCluster);
      return json(route, { success: true, joinedCluster: false, cluster: newCluster, problemId: 'prob_mock_new' });
    }

    // POST /api/seed (dev-only helper)
    if (method === 'POST' && segments.length === 2 && segments[1] === 'seed') {
      return json(route, { success: true });
    }

    // --- /api/clusters/:id ---
    if (segments.length === 3 && segments[1] === 'clusters') {
      const clusterId = segments[2];
      const cluster = clusterById(store, clusterId);

      if (method === 'GET') {
        if (!cluster) return json(route, { error: 'Not Found', message: `Cluster with ID ${clusterId} not found.` }, 404);
        const adjacent = store.clusters
          .filter((c) => c.id !== clusterId)
          .slice(0, 4)
          .map((c) => ({ ...c, solutions: undefined }));
        return json(route, { cluster: { ...cluster, solutions: cluster.solutions }, adjacent });
      }

      if (method === 'PATCH') {
        if (!cluster) return json(route, { error: 'Not Found', message: `Cluster with ID ${clusterId} not found.` }, 404);
        const userId = userIdOf(route);
        if (cluster.userIds.includes(userId)) {
          return json(
            route,
            { error: 'Conflict', message: 'You have already added your voice to this problem group!' },
            409
          );
        }
        const body = request.postDataJSON() || {};
        const phrasing = typeof body.phrasing === 'string' ? body.phrasing.trim() : '';
        cluster.userIds.push(userId);
        cluster.memberCount += 1;
        if (phrasing && !cluster.sampleVariants.includes(phrasing)) {
          cluster.sampleVariants.push(phrasing);
        }
        cluster.lastUpdatedAt = NOW();
        return json(route, { success: true, cluster: { ...cluster, solutions: cluster.solutions } });
      }

      return json(route, { error: 'Method Not Allowed', message: `${method} not supported.` }, 405);
    }

    // --- /api/clusters/:id/solutions ---
    if (segments.length === 4 && segments[1] === 'clusters' && segments[3] === 'solutions' && method === 'POST') {
      const cluster = clusterById(store, segments[2]);
      if (!cluster) return json(route, { error: 'Not Found', message: 'Problem group not found.' }, 404);

      const body = request.postDataJSON() || {};
      const userId = userIdOf(route);
      const newSolution: MockSolution = {
        id: body.solutionId || `sol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        clusterId: cluster.id,
        name: body.name,
        url: body.url,
        description: body.description,
        builderId: userId,
        builderName: body.builderName || 'E2E Tester',
        upvotes: 1, // Creator auto-upvote, like the real server
        votesUserIds: [userId],
        downvotedUserIds: [],
        createdAt: NOW(),
        iconUrl: body.iconUrl || '/placeholder-solution-icon.png',
      };
      cluster.solutions.push(newSolution);
      return json(route, { success: true, cluster: { ...cluster, solutions: cluster.solutions }, solution: newSolution });
    }

    // --- /api/clusters/:id/solutions/:solutionId ---
    if (segments.length === 5 && segments[1] === 'clusters' && segments[3] === 'solutions') {
      const cluster = clusterById(store, segments[2]);
      const solution = cluster && findSolution(cluster, segments[4]);
      if (!cluster || !solution) {
        return json(route, { error: 'Not Found', message: 'Listed solution product not found.' }, 404);
      }

      if (method === 'PATCH') {
        const body = request.postDataJSON() || {};
        if (body.name !== undefined) solution.name = body.name;
        if (body.url !== undefined) solution.url = body.url;
        if (body.description !== undefined) solution.description = body.description;
        if (body.builderName !== undefined) solution.builderName = body.builderName;
        if (body.iconUrl !== undefined) solution.iconUrl = body.iconUrl;
        return json(route, { success: true, cluster: { ...cluster, solutions: cluster.solutions }, solution });
      }

      if (method === 'DELETE') {
        cluster.solutions = cluster.solutions.filter((s) => s.id !== solution.id);
        store.reviews = store.reviews.filter((r) => r.solutionId !== solution.id);
        return json(route, { success: true, cluster: { ...cluster, solutions: cluster.solutions } });
      }

      return json(route, { error: 'Method Not Allowed', message: `${method} not supported.` }, 405);
    }

    // --- /api/clusters/:id/solutions/:solutionId/upvote | /reviews ---
    if (segments.length === 6 && segments[1] === 'clusters' && segments[3] === 'solutions') {
      const cluster = clusterById(store, segments[2]);
      const solution = cluster && findSolution(cluster, segments[4]);
      if (!cluster || !solution) {
        return json(route, { error: 'Not Found', message: 'Listed solution product not found.' }, 404);
      }
      const action = segments[5];

      if (action === 'upvote' && method === 'POST') {
        const userId = userIdOf(route);
        const body = request.postDataJSON() || {};
        const voteType = body.voteType || 'up';
        const hasUpvoted = solution.votesUserIds.includes(userId);
        const hasDownvoted = solution.downvotedUserIds.includes(userId);

        if (voteType === 'up') {
          if (hasUpvoted) {
            solution.upvotes -= 1;
            solution.votesUserIds = solution.votesUserIds.filter((u) => u !== userId);
          } else {
            solution.upvotes += 1;
            solution.votesUserIds.push(userId);
            if (hasDownvoted) {
              solution.upvotes += 1;
              solution.downvotedUserIds = solution.downvotedUserIds.filter((u) => u !== userId);
            }
          }
        } else {
          if (hasDownvoted) {
            solution.upvotes += 1;
            solution.downvotedUserIds = solution.downvotedUserIds.filter((u) => u !== userId);
          } else {
            solution.upvotes -= 1;
            solution.downvotedUserIds.push(userId);
            if (hasUpvoted) {
              solution.upvotes -= 1;
              solution.votesUserIds = solution.votesUserIds.filter((u) => u !== userId);
            }
          }
        }

        return json(route, {
          success: true,
          cluster: { ...cluster, solutions: cluster.solutions },
          solution,
        });
      }

      if (action === 'reviews') {
        if (method === 'GET') {
          const reviews = store.reviews
            .filter((r) => r.solutionId === solution.id)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          return json(route, { success: true, reviews });
        }
        if (method === 'POST') {
          const body = request.postDataJSON() || {};
          const userId = userIdOf(route);
          const review: MockReview = {
            clusterId: cluster.id,
            solutionId: solution.id,
            userId,
            userName: body.userName || 'Anonymous User',
            rating: Number(body.rating) || 5,
            text: body.text,
            createdAt: NOW(),
          };
          store.reviews.push(review);
          return json(route, { success: true, review });
        }
      }

      return json(route, { error: 'Method Not Allowed', message: `${method} not supported.` }, 405);
    }

    // Unknown /api route: fail loudly so specs surface missing mocks
    return json(route, { error: 'Mock Not Found', message: `No mock handler for ${method} ${url.pathname}` }, 404);
  } catch (err) {
    console.error('[mock-api] handler error:', err);
    return json(route, { error: 'Mock Error', message: (err as Error).message }, 500);
  }
}