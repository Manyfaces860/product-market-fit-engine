import { test, expect } from '@playwright/test';

test.describe('Navigation & Browsing Flow', () => {
  test('should navigate from landing page to browse, choose category, select cluster, and go back', async ({ page }) => {
    // 1. Visit Home Page
    await page.goto('/');
    await expect(page.locator('span:has-text("NeedBoard")')).toBeVisible();

    // 2. Click Browse Link in Header
    const browseLink = page.locator('header nav a:has-text("Browse")');
    await browseLink.click();
    await expect(page).toHaveURL('/browse');
    await expect(page.locator('h1')).toContainText('Browse Problem Niches');

    // 3. Select SaaS & B2B Productivity Category
    const categoryCard = page.locator('a:has-text("SaaS & B2B Productivity")').first();
    await categoryCard.click();
    await expect(page).toHaveURL('/browse/software-saas');

    // 4. Select the seeded calendar sync cluster
    const clusterCard = page.locator('text=No simple way to automatically sync real-time calendar').first();
    await clusterCard.click();
    await expect(page).toHaveURL(/\/cluster\/cluster-e2e-calendar-sync/);

    // 5. Verify details are visible on cluster page
    await expect(page.locator('text=CLUSTER REFERENCE ID: cluster-e2e-calendar-sync')).toBeVisible();

    // 6. Go back to browse using the back button link
    const backLink = page.locator('a:has-text("Back to Niche (SaaS & B2B Productivity)")').first();
    await backLink.click();
    await expect(page).toHaveURL('/browse/software-saas');
    
    const backLink2 = page.locator('a:has-text("Back to Niches")').first();
    await backLink2.click();
    await expect(page).toHaveURL('/browse');
  });
});
