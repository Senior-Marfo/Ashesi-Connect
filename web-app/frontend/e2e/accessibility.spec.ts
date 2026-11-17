import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

// Synthetic accounts from web-app/backend/src/testing/demo-server.ts.
const PASSWORD = 'Synthetic-Demo-2028';

async function signIn(page: Page, identifier: string) {
  await page.goto('/');
  await page.getByLabel('Student or staff ID').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** WCAG 2.2 AA rules; any serious or critical violation fails the test, with the details in the message. */
async function expectAccessible(page: Page, screen: string) {
  await page.waitForLoadState('networkidle');
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
  const blocking = violations.filter(violation => violation.impact === 'serious' || violation.impact === 'critical');
  const report = blocking.map(violation => `${violation.id} (${violation.impact}): ${violation.help}\n  ${violation.nodes.slice(0, 3).map(node => node.target.join(' ')).join('\n  ')}`).join('\n');
  expect(blocking, `${screen}\n${report}`).toEqual([]);
}

test('sign-in screen', async ({ page }) => {
  await page.goto('/');
  await expectAccessible(page, 'Sign in');
});

test('student screens', async ({ page }) => {
  await signIn(page, '20280001');
  await expect(page.getByRole('region', { name: 'Graduation status' })).toBeVisible();
  await expectAccessible(page, 'Status');
  for (const [link, heading] of [['Requirements', 'My requirements'], ['Remaining', 'This term in progress'], ['Courses', 'My courses'], ['Inbox', 'Inbox'], ['Profile', 'Profile and security']]) {
    await page.getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    await expectAccessible(page, link);
  }
});

test('admin screens', async ({ page }) => {
  await signIn(page, 'STF-1001');
  await page.getByLabel('Student ID or name').fill('20280002');
  await page.getByRole('button', { name: /20280002/ }).click();
  await expect(page.getByRole('heading', { name: 'Kofi Synthetic Boateng' })).toBeVisible();
  await expectAccessible(page, 'Student lookup with a record open');
  for (const [link, heading] of [['Register', 'Student register'], ['Reports', 'Reports'], ['Messages', 'Messages'], ['Imports', 'Imports'], ['Curriculum', 'Curriculum'], ['Settings', 'Settings']]) {
    await page.getByRole('link', { name: link, exact: true }).click();
    await expect(page.getByRole('heading', { name: heading, level: 1 })).toBeVisible();
    await expectAccessible(page, link);
  }
  await page.getByRole('link', { name: 'Curriculum', exact: true }).click();
  await page.getByRole('button', { name: 'View CS standard SYNTHETIC-DEMO-1' }).click();
  await expect(page.getByRole('row', { name: /MATH 141/ })).toBeVisible();
  await expectAccessible(page, 'Curriculum draft open');
});
