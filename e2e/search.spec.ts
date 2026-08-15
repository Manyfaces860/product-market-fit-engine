import { test, expect } from '@playwright/test';

test.describe('Semantic Search Flow', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    // Extract hostname from baseURL to set correct cookie domain
    const domain = baseURL ? new URL(baseURL).hostname : 'localhost';
    
    // Inject the E2E Mock Session cookies to log the user in instantly and offline!
    await context.addCookies([
      { name: 'e2e_user_id', value: 'user_e2e_test_id', domain, path: '/' },
      { name: 'e2e_user_name', value: 'E2E Tester', domain, path: '/' },
      { name: 'e2e_user_role', value: 'user', domain, path: '/' }
    ]);
  });

  test('should find matching cluster for semantic queries', async ({ page }) => {
    await page.goto('/search');
    await expect(page.locator('h1')).toContainText('Validate Your Product Idea');

    // Enter search query
    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('Webpack hot-reloading fails');
    await page.keyboard.press('Enter');

    // Wait for and check results
    await expect(page.locator('text=Flaky local testing setups')).toBeVisible();
  });

  test('should show empty/no results state for unrelated queries', async ({ page }) => {
    await page.goto('/search');

    const searchInput = page.getByTestId('search-input');
    await searchInput.fill('complete unrelated query with no possible match on this board');
    await page.keyboard.press('Enter');

    // Check for helpful empty state
    await expect(page.locator('text=We couldn\'t find any active groups')).toBeVisible();
  });
});
