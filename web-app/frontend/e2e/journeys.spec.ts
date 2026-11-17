import { expect, test, type Page } from '@playwright/test';

// Synthetic accounts from web-app/backend/src/testing/demo-server.ts.
const PASSWORD = 'Synthetic-Demo-2028';

async function signIn(page: Page, identifier: string, password = PASSWORD) {
  await page.goto('/');
  await page.getByLabel('Student or staff ID').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('student sees their own record, stays signed in across reloads and can sign out', async ({ page }) => {
  await signIn(page, '20280001');
  await expect(page).toHaveURL(/\/student\/$/);
  await expect(page.getByRole('heading', { name: 'Hello, Ama' })).toBeVisible();
  await expect(page.getByRole('row', { name: /MATH 141/ })).toContainText('Earlier: D (2024 Fall)');
  await expect(page.getByText('Kofi')).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hello, Ama' })).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Graduation Tracker' })).toBeVisible();
  await page.goto('/student/');
  await expect(page).toHaveURL(/localhost:3000\/$/);
});

test('a student cannot open the admin workspace', async ({ page }) => {
  await signIn(page, '20280002');
  await expect(page).toHaveURL(/\/student\/$/);
  await page.goto('/admin/');
  await expect(page).toHaveURL(/\/student\/$/);
});

test('admin finds a student by ID prefix and opens their record', async ({ page }) => {
  await signIn(page, 'STF-1001');
  await expect(page).toHaveURL(/\/admin\/$/);
  await page.getByLabel('Student ID').fill('2028000');
  await page.getByRole('button', { name: /20280002/ }).click();
  await expect(page.getByRole('heading', { name: 'Kofi Synthetic Boateng' })).toBeVisible();
  await expect(page.getByRole('row', { name: /ECON 101/ })).toContainText('Incomplete');
});

test('wrong password shows a generic error', async ({ page }) => {
  await signIn(page, '20280001', 'not-the-password');
  await expect(page.locator('.notice.error')).toContainText('do not match an active account');
});

test('an account with a temporary password must set a new one first', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'Changes shared demo state; run once.');
  await signIn(page, '20280003');
  await expect(page).toHaveURL(/\/change-password\/$/);
  await page.goto('/student/');
  await expect(page).toHaveURL(/\/change-password\/$/);

  await page.getByLabel('Temporary password').fill(PASSWORD);
  await page.getByLabel('New password', { exact: true }).fill('alllowercaseletters');
  await page.getByLabel('Confirm new password').fill('alllowercaseletters');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page.locator('.notice.error')).toContainText('at least three of');

  await page.getByLabel('New password', { exact: true }).fill('Fresh-Start-2029!');
  await page.getByLabel('Confirm new password').fill('Fresh-Start-2029!');
  await page.getByRole('button', { name: 'Save new password' }).click();
  await expect(page).toHaveURL(/\/student\/$/);
  await expect(page.getByRole('heading', { name: 'Hello, Esi' })).toBeVisible();
});

test('the legacy fictional demo stays available under /demo/', async ({ page }) => {
  await page.goto('/demo/');
  await expect(page.getByText('Demonstration only')).toBeVisible();
});
