import { test, expect } from '@playwright/test';
import { createMockStore, installApiMocks, setMockSession } from './mock-api';

test.describe('Problem Submission Flow', () => {
  test.beforeEach(async ({ page, context, baseURL }) => {
    await setMockSession(context, { userId: 'user_e2e_admin_id', name: 'E2E Admin', role: 'admin' }, baseURL);
    await installApiMocks(page, createMockStore());
  });

  test('should merge into existing cluster when submitting a similar/exact complaint', async ({ page }) => {
    await page.goto('/submit');
    await expect(page.locator('h1')).toContainText('Find Problems Worth Solving.');

    const textarea = page.getByTestId('problem-textarea');
    await textarea.fill('Webpack hot-reloading fails completely when running module federation in watch mode on larger monorepos.');

    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=Highly Similar Group Found')).toBeVisible();
    await expect(page.locator('text=HOW OTHERS EXPRESSED IT')).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    const confirmBtn = page.getByTestId('confirm-merge-button');
    await confirmBtn.click();

    await expect(page.locator('text=Pain Point Published!')).toBeVisible();
  });

  test('should propose a new cluster for a completely novel complaint', async ({ page }) => {
    await page.goto('/submit');

    const textarea = page.getByTestId('problem-textarea');
    await textarea.fill('We need a way to automatically compile Release Notes directly from our Slack channels.');

    await page.locator('button[type="submit"]').click();

    await expect(page.locator('text=New Pain Point Discovered')).toBeVisible();
    await expect(page.locator('text=Proposed Market Niche')).toBeVisible();

    const confirmBtn = page.getByTestId('confirm-new-button');
    await confirmBtn.click();

    await expect(page.locator('text=Pain Point Published!')).toBeVisible();
  });

  test('should reject gibberish/spam submissions', async ({ page }) => {
    await page.goto('/submit');

    const textarea = page.getByTestId('problem-textarea');
    await textarea.fill('asdfghjkl');

    await page.locator('button[type="submit"]').click();

    await expect(page.locator('span.submit-error')).toContainText('Input appears to be meaningless gibberish or spam');
  });

  test('should reject out-of-domain submissions', async ({ page }) => {
    await page.goto('/submit');

    const textarea = page.getByTestId('problem-textarea');
    await textarea.fill('I love cookies very much');

    await page.locator('button[type="submit"]').click();

    await expect(page.locator('span.submit-error')).toContainText('out of scope');
  });
});
