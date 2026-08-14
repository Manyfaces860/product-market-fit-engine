import { test, expect } from '@playwright/test';

test.describe('Me Too Support Flow', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = baseURL ? new URL(baseURL).hostname : 'localhost';
    await context.addCookies([
      { name: 'e2e_user_id', value: 'user_e2e_test_id', domain, path: '/' },
      { name: 'e2e_user_name', value: 'E2E Tester', domain, path: '/' },
      { name: 'e2e_user_role', value: 'user', domain, path: '/' }
    ]);
  });

  test('should support a cluster using custom phrasing and verify the voice count increases', async ({ page }) => {
    // Navigate directly to the seeded calendar sync cluster detail page
    await page.goto('/cluster/cluster-e2e-calendar-sync');

    // Check initial count is 38 (Active Customer Pain Point (38 Reports))
    await expect(page.locator('text=38 Reports')).toBeVisible();

    // Click custom phrasing toggle
    const toggleBtn = page.getByTestId('custom-phrasing-toggle');
    await toggleBtn.click();

    // Fill phrasing textarea
    const textarea = page.getByTestId('custom-phrasing-textarea');
    await textarea.fill('Buggy calendar synchronization across multiple clients.');

    // Click submit custom phrasing
    const submitBtn = page.getByTestId('me-too-submit-button');
    await submitBtn.click();

    // Verify success banner "Voice Logged"
    await expect(page.locator('text=Voice Logged')).toBeVisible();

    // Verify dynamic report count updated to 39
    await expect(page.locator('text=39 Reports')).toBeVisible();
  });
});
