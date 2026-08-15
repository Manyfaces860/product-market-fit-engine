import { test, expect } from '@playwright/test';
import { createMockStore, installApiMocks, setMockSession } from './mock-api';

test.describe('Semantic Search Flow', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await setMockSession(context, {}, baseURL);
    await installApiMocks(page, createMockStore());
  });

  test('should find matching cluster for semantic queries', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('h1')).toContainText('Validate Your Product Idea');

    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('Webpack hot-reloading fails');
    await page.keyboard.press('Enter');

    // The result card only renders when the search actually returns the
    // flaky-tests cluster, so this assertion cannot pass on an empty state.
    const resultCard = page.locator('a[href="/cluster/cluster-e2e-flaky-tests"]');
    await expect(resultCard).toBeVisible();
    await expect(resultCard).toContainText('Flaky local testing setups');
    await expect(resultCard).toContainText('Match Score:');
  });

  test('should show empty/no results state for unrelated queries', async ({ page }) => {
    await page.goto('/search');

    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('complete unrelated query with no possible match on this board');
    await page.keyboard.press('Enter');

    // No result cards should render — only the empty state.
    await expect(page.locator('a[href^="/cluster/"]')).toHaveCount(0);
    await expect(page.locator('text=We couldn\'t find any active groups')).toBeVisible();
  });
});