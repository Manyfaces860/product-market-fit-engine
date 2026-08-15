import { test, expect } from '@playwright/test';

test.describe('Solution Curation & Voting Flow', () => {
  test.beforeEach(async ({ context, baseURL }) => {
    const domain = baseURL ? new URL(baseURL).hostname : 'localhost';
    
    // Inject E2E Mock Session cookies (Test user owns sol-e2e-1 in seed)
    await context.addCookies([
      { name: 'e2e_user_id', value: 'user_e2e_test_id', domain, path: '/' },
      { name: 'e2e_user_name', value: 'E2E Tester', domain, path: '/' },
      { name: 'e2e_user_role', value: 'builder', domain, path: '/' } // Builder role enables solution creation
    ]);
  });

  test('should support solution voting lifecycle (upvote, remove upvote, downvote)', async ({ page }) => {
    await page.goto('/cluster/cluster-e2e-calendar-sync');

    // 1. Verify initial score is +5
    const scoreSpan = page.locator('span:has-text("+5")').first();
    await expect(scoreSpan).toBeVisible();

    // 2. Click Upvote
    const upvoteBtn = page.getByTitle('Upvote').first();
    await upvoteBtn.click();

    // 3. Score should increment to +6
    await expect(page.locator('span:has-text("+6")').first()).toBeVisible();

    // 4. Click Remove Upvote
    const removeUpvoteBtn = page.getByTitle('Remove Upvote').first();
    await removeUpvoteBtn.click();

    // 5. Score should return to +5
    await expect(page.locator('span:has-text("+5")').first()).toBeVisible();

    // 6. Click Downvote
    const downvoteBtn = page.getByTitle('Downvote').first();
    await downvoteBtn.click();

    // 7. Score should decrement to +4
    await expect(page.locator('span:has-text("+4")').first()).toBeVisible();
  });

  test('should allow listing a new product solution and validate required fields', async ({ page }) => {
    await page.goto('/cluster/cluster-e2e-calendar-sync');

    // Toggle Solution Modal Form
    const openBtn = page.getByTestId('add-solution-button');
    await openBtn.click();

    // Fill form using exact copy-defined placeholders
    await page.getByPlaceholder('e.g., Webpack TurboLoader').fill('E2E Novel App');
    await page.getByPlaceholder('e.g., https://turbo-loader.dev').fill('https://e2e-novel.com');
    await page.getByPlaceholder('Describe how your product resolves this specific friction point...').fill('Surgical E2E solution description that meets validation rules.');

    // Click submit/publish
    await page.locator('button[type="submit"]:has-text("Publish Solution")').click();

    // Verify list updates
    await expect(page.locator('text=E2E Novel App')).toBeVisible();
  });

  test('should allow the owner to edit their existing product solution details', async ({ page }) => {
    await page.goto('/cluster/cluster-e2e-calendar-sync');

    // Click Edit icon next to our owned solution
    const editBtn = page.getByTitle('Edit Listing').first();
    await editBtn.click();

    // Verify modal is open and inputs pre-populated
    const nameInput = page.getByPlaceholder('e.g., Webpack TurboLoader');
    await page.getByPlaceholder('e.g., https://my-app.com/logo.png').fill('');
    await expect(nameInput).toHaveValue('E2E Novel App');

    // Modify name
    await nameInput.fill('E2E Novel App (Edited)');

    // Submit edits
    await page.locator('button[type="submit"]:has-text("Update Solution")').click();

    // Verify name updated in listing
    await expect(page.locator('text=E2E Novel App (Edited)')).toBeVisible();
  });

  test('should allow the owner to delete their product solution after yes/cancel confirmation', async ({ page }) => {
    await page.goto('/cluster/cluster-e2e-calendar-sync');

    // Verify solution is present
    await expect(page.locator('text=E2E Novel App')).toBeVisible();

    // Click Delete listing icon
    const deleteBtn = page.getByTitle('Delete Listing').first();
    await deleteBtn.click();

    // ConfirmModal yes/cancel should overlay
    await expect(page.locator('text=Delete Listed Product?')).toBeVisible();

    // Click Confirm button inside the modal (with text "Delete Listing" from confirmText copy config)
    const confirmBtn = page.locator('button:has-text("Yes, Delete")').first();
    await confirmBtn.click();

    // Verify solution is completely deleted and no longer visible in list
    await expect(page.locator('text=E2E Novel App')).not.toBeVisible();
  });
});
