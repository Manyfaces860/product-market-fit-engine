import { test, expect } from '@playwright/test';

test.describe('Problem Submission Flow', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = baseURL ? new URL(baseURL).hostname : 'localhost';
    
    // Inject E2E Mock Session cookies
    await context.addCookies([
      { name: 'e2e_user_id', value: 'user_e2e_admin_id', domain, path: '/' },
      { name: 'e2e_user_name', value: 'E2E Admin', domain, path: '/' },
      { name: 'e2e_user_role', value: 'admin', domain, path: '/' }
    ]);
  });

  test('should merge into existing cluster when submitting a similar/exact complaint', async ({ page }) => {
    await page.goto('/submit');
    await expect(page.locator('h1')).toContainText('Find Problems Worth Solving.');

    // Fill exact text of the seeded flaky tests variant to match its local fallback embedding
    const textarea = page.getByTestId('problem-textarea');
    await textarea.fill('Webpack hot-reloading fails completely when running module federation in watch mode on larger monorepos.');
    
    // Click submit to trigger draft analysis
    await page.locator('button[type="submit"]').click();

    // Check that we transitioned to the Match/Merge draft view
    await expect(page.locator('text=Highly Similar Group Found')).toBeVisible();
    await expect(page.locator('text=HOW OTHERS EXPRESSED IT')).toBeVisible();

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))

    // Click confirm/merge to finalize
    const confirmBtn = page.getByTestId('confirm-merge-button');
    await confirmBtn.click();

    // Verify success screen
    await expect(page.locator('text=Pain Point Published!')).toBeVisible();
  });

  test('should propose a new cluster for a completely novel complaint', async ({ page }) => {
    await page.goto('/submit');

    const textarea = page.getByTestId('problem-textarea');
    await textarea.fill('We need a way to automatically compile Release Notes directly from our Slack channels.');

    await page.locator('button[type="submit"]').click();

    // Check that we transitioned to the New draft view
    await expect(page.locator('text=New Pain Point Discovered')).toBeVisible();
    await expect(page.locator('text=Proposed Market Niche')).toBeVisible();

    const confirmBtn = page.getByTestId('confirm-new-button');
    await confirmBtn.click();

    // Verify success screen
    await expect(page.locator('text=Pain Point Published!')).toBeVisible();
  });

  test('should reject gibberish/spam submissions', async ({ page }) => {
    await page.goto('/submit');

    const textarea = page.getByTestId('problem-textarea');
    await textarea.fill('asdfghjkl');

    await page.locator('button[type="submit"]').click();

    // Verify error/rejection modal or message
    await expect(page.locator('span.submit-error')).toContainText('Input appears to be meaningless gibberish or spam');
  });

  test('should reject out-of-domain submissions', async ({ page }) => {
    await page.goto('/submit');

    const textarea = page.getByTestId('problem-textarea');
    await textarea.fill('I love cookies very much');

    await page.locator('button[type="submit"]').click();

    // Verify error/rejection modal or message
    await expect(page.locator('span.submit-error')).toContainText('out of scope');
  });
});
