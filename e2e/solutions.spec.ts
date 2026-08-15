import { test, expect } from '@playwright/test';
import { createMockStore, installApiMocks, setMockSession } from './mock-api';

test.describe('Solution Curation & Voting Flow', () => {
  // Shared store across tests in this file. Each test is also safe to run in
  // isolation: the edit/delete tests target the seeded solution owned by the
  // test user, and the add test uses a unique name.
  const store = createMockStore();

  test.beforeEach(async ({ page, context, baseURL }) => {
    await setMockSession(context, { role: 'builder' }, baseURL);
    await installApiMocks(page, store);
  });

  test('should support solution voting lifecycle (upvote, remove upvote, downvote)', async ({ page }) => {
    await page.goto('/cluster/cluster-e2e-calendar-sync');

    const scoreSpan = page.locator('span:has-text("+5")').first();
    await expect(scoreSpan).toBeVisible();

    const upvoteBtn = page.getByTitle('Upvote').first();
    await upvoteBtn.click();

    await expect(page.locator('span:has-text("+6")').first()).toBeVisible();

    const removeUpvoteBtn = page.getByTitle('Remove Upvote').first();
    await removeUpvoteBtn.click();

    await expect(page.locator('span:has-text("+5")').first()).toBeVisible();

    const downvoteBtn = page.getByTitle('Downvote').first();
    await downvoteBtn.click();

    await expect(page.locator('span:has-text("+4")').first()).toBeVisible();
  });

  test('should allow listing a new product solution and dismiss the success modal', async ({ page }) => {
    await page.goto('/cluster/cluster-e2e-calendar-sync');

    const openBtn = page.getByTestId('add-solution-button');
    await openBtn.click();

    // Unique name so strict-mode locators never collide with the seeded solution.
    await page.getByPlaceholder('e.g., Webpack TurboLoader').fill('E2E Novel App');
    await page.getByPlaceholder('e.g., https://turbo-loader.dev').fill('https://e2e-novel.com');
    await page.getByPlaceholder('Describe how your product resolves this specific friction point...').fill('Surgical E2E solution description that meets validation rules.');

    await page.locator('button[type="submit"]:has-text("Publish Solution")').click();

    // The solution modal switches to its success state after publishing —
    // close it via its "Close Window" button (not the AlertModal cross).
    await expect(page.locator('button:has-text("Close Window")')).toBeVisible();
    await page.locator('button:has-text("Close Window")').click();

    await expect(page.locator('text=E2E Novel App')).toBeVisible();
  });

  test('should allow the owner to edit their existing product solution details', async ({ page }) => {
    await page.goto('/cluster/cluster-e2e-calendar-sync');

    // The seeded solution (owned by the test user) always sorts first, so
    // `.first()` targets it regardless of what earlier tests added.
    const editBtn = page.getByTitle('Edit Listing').first();
    await editBtn.click();

    const nameInput = page.getByPlaceholder('e.g., Webpack TurboLoader');
    await page.getByPlaceholder('e.g., https://my-app.com/logo.png').fill('');
    await expect(nameInput).toHaveValue('CrossSync Calendar Mock');

    await nameInput.fill('CrossSync Calendar Mock (Edited)');

    await page.locator('button[type="submit"]:has-text("Update Solution")').click();

    // Same success modal: close it before asserting the updated listing.
    await expect(page.locator('button:has-text("Close Window")')).toBeVisible();
    await page.locator('button:has-text("Close Window")').click();

    await expect(page.locator('text=CrossSync Calendar Mock (Edited)')).toBeVisible();
  });

  test('should allow the owner to delete their product solution after yes/cancel confirmation', async ({ page }) => {
    await page.goto('/cluster/cluster-e2e-calendar-sync');

    await expect(page.locator('text=CrossSync Calendar Mock')).toBeVisible();

    const deleteBtn = page.getByTitle('Delete Listing').first();
    await deleteBtn.click();

    await expect(page.locator('text=Delete Listed Product?')).toBeVisible();

    const confirmBtn = page.locator('button:has-text("Yes, Delete")').first();
    await confirmBtn.click();

    // Deletion surfaces the AlertModal ("Solution Deleted") — dismiss it
    // to confirm the updated list behind the overlay.
    await expect(page.locator('text=Solution Deleted')).toBeVisible();
    await page.locator('button:has-text("Dismiss")').click();

    await expect(page.locator('text=CrossSync Calendar Mock')).not.toBeVisible();
  });
});