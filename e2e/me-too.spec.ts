import { test, expect } from '@playwright/test';
import { createMockStore, installApiMocks, setMockSession } from './mock-api';

test.describe('Me Too Support Flow', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await setMockSession(context, {}, baseURL);
    await installApiMocks(page, createMockStore());
  });

  test('should support a cluster using custom phrasing and verify the voice count increases', async ({ page }) => {
    await page.goto('/cluster/cluster-e2e-calendar-sync');

    await expect(page.locator('text=38 Reports')).toBeVisible();

    const toggleBtn = page.getByTestId('custom-phrasing-toggle');
    await toggleBtn.click();

    const textarea = page.getByTestId('custom-phrasing-textarea');
    await textarea.fill('Buggy calendar synchronization across multiple clients.');

    const submitBtn = page.getByTestId('me-too-submit-button');
    await submitBtn.click();

    await expect(page.locator('text=Voice Logged')).toBeVisible();

    await expect(page.locator('text=39 Reports')).toBeVisible();
  });
});