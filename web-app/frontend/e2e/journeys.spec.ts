import { expect, test, type Page } from '@playwright/test';

// Synthetic accounts from web-app/backend/src/testing/demo-server.ts.
const PASSWORD = 'Synthetic-Demo-2028';

async function signIn(page: Page, identifier: string, password = PASSWORD) {
  await page.goto('/');
  await page.getByLabel('Student or staff ID').fill(identifier);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

test('student sees their status, requirements, remaining work and courses, stays signed in and can sign out', async ({ page }) => {
  await signIn(page, '20280001');
  await expect(page).toHaveURL(/\/student\/$/);
  const status = page.getByRole('region', { name: 'Graduation status' });
  await expect(status).toContainText('Not yet eligible');
  await expect(status.locator('.standing')).toBeVisible();
  await expect(status.getByRole('img', { name: /credits completed/ })).toBeVisible();
  await expect(status).toContainText('illustrative synthetic programme rules');
  await expect(page.getByText('Hello, Ama.')).toBeVisible();
  await expect(page.getByText('Kofi')).toHaveCount(0);

  await page.getByRole('link', { name: 'Requirements' }).click();
  await expect(page.getByRole('heading', { name: 'My requirements' })).toBeVisible();
  await page.getByRole('button', { name: /^In progress/ }).click();
  await expect(page.locator('.tree-items li').first()).toContainText('In progress');

  await page.getByRole('link', { name: 'Remaining' }).click();
  await expect(page.getByRole('heading', { name: 'This term in progress' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '2027 Spring' })).toBeVisible();

  await page.getByRole('link', { name: 'Courses' }).click();
  const maths = page.getByRole('row', { name: /MATH 141/ });
  await expect(maths).toContainText('Earlier: D (2024 Fall)');
  await expect(maths).toContainText('Passed');

  await page.reload();
  await expect(page.getByRole('heading', { name: 'My courses' })).toBeVisible();

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
  await expect(page.getByRole('region', { name: 'Graduation status' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Curriculum catalogue' })).toBeVisible();
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
  await expect(page.getByText('Hello, Esi.')).toBeVisible();
});

test('the legacy fictional demo stays available under /demo/', async ({ page }) => {
  await page.goto('/demo/');
  await expect(page.getByText('Demonstration only')).toBeVisible();
});

test('admin filters and sorts the register, then opens a student from it', async ({ page }) => {
  await signIn(page, 'STF-1001');
  await page.getByRole('link', { name: 'Register' }).click();
  await expect(page.getByRole('heading', { name: 'Student register' })).toBeVisible();
  await expect(page.getByText(/Page 1 of \d+ · 63 students/)).toBeVisible();

  await page.getByLabel('Programme').selectOption('BA');
  await expect(page.getByText(/· 7 students/)).toBeVisible();
  await page.getByRole('button', { name: 'Passed credits' }).click();
  await expect(page.getByRole('columnheader', { name: /Passed credits/ })).toHaveAttribute('aria-sort', 'descending');

  await page.getByLabel('Programme').selectOption('');
  await page.getByLabel('Standing').selectOption('RED');
  await expect(page.locator('table.register tbody tr').first()).toContainText('Critical');
  await page.getByLabel('Standing').selectOption('');
  await page.getByLabel('Programme').selectOption('BA');

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download CSV' }).click();
  expect((await download).suggestedFilename()).toBe('student-register.csv');

  await page.getByRole('link', { name: '20280002' }).click();
  await expect(page).toHaveURL(/\/admin\/\?student=20280002/);
  await expect(page.getByRole('heading', { name: 'Kofi Synthetic Boateng' })).toBeVisible();
});

test('admin reads reports, filters them and exports a section', async ({ page }) => {
  await signIn(page, 'STF-1001');
  await page.getByRole('link', { name: 'Reports' }).click();
  await expect(page.getByRole('heading', { name: 'Standing now' })).toBeVisible();
  await expect(page.getByRole('list', { name: 'Completion rate by year group' })).toContainText('Class of 2025');
  await expect(page.getByRole('heading', { name: 'Programme comparison' })).toBeVisible();

  await page.getByRole('combobox', { name: 'Programme', exact: true }).selectOption('CS');
  await expect(page.locator('.report-table tbody tr')).not.toHaveCount(0);
  await expect(page.getByRole('row', { name: /^BA/ })).toHaveCount(0);

  const download = page.waitForEvent('download');
  await page.locator('section', { has: page.getByRole('heading', { name: 'Courses' }) }).getByRole('button', { name: 'CSV' }).click();
  expect((await download).suggestedFilename()).toBe('report-courses.csv');
});

test('admin messages a student, who reads it in the inbox', async ({ browser }, testInfo) => {
  const title = `Audit review ${testInfo.project.name} ${Date.now()}`;
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, 'STF-1001');
  await admin.getByRole('link', { name: 'Messages' }).click();
  await admin.getByLabel('Start from a template').selectOption('audit-review');
  await expect(admin.getByLabel('Title', { exact: true })).toHaveValue('Graduation audit review due');
  await admin.getByLabel('Title', { exact: true }).fill(title);
  await admin.getByLabel('Send to').selectOption('STUDENTS');
  await admin.getByLabel('Student IDs', { exact: true }).fill('20280001, 29999999');
  await expect(admin.getByText('1 recipient')).toBeVisible();
  await expect(admin.getByText('not found: 29999999')).toBeVisible();
  admin.once('dialog', dialog => void dialog.accept());
  await admin.getByRole('button', { name: 'Send message' }).click();
  await expect(admin.getByText(/Sent to 1 student/)).toBeVisible();
  await expect(admin.getByRole('list', { name: `Read receipts for ${title}` })).toContainText('0 of 1 read');

  const student = await (await browser.newContext()).newPage();
  await signIn(student, '20280001');
  const inboxLink = student.getByRole('link', { name: /Inbox/ });
  await expect(inboxLink.locator('.badge')).toBeVisible();
  await inboxLink.click();
  await student.getByText(title).click();
  await expect(student.locator('details[open]')).toContainText('Please review your graduation status');
  await expect(student.getByText('All caught up')).toBeVisible();
  await expect(student.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  await expect(inboxLink.locator('.badge')).toHaveCount(0);
});

test('admin imports a student, issues a temporary password, then undoes the import', async ({ browser }, testInfo) => {
  const id = testInfo.project.name === 'desktop' ? '20310001' : '20310002';
  const admin = await (await browser.newContext()).newPage();
  await signIn(admin, 'STF-1001');
  await admin.getByRole('link', { name: 'Imports' }).click();
  await expect(admin.getByRole('heading', { name: 'New import' })).toBeVisible();

  const file = (body: string) => ({ name: 'students.csv', mimeType: 'text/csv', buffer: Buffer.from(`studentId,fullName,programme,yearGroup\n${body}`) });
  await admin.getByLabel('CSV file').setInputFiles(file(`${id},Imported Student,CS,2031\nbad,,ART,never\n`));
  await expect(admin.getByText('Fix these problems')).toBeVisible();
  await expect(admin.getByRole('cell', { name: /is not a valid student ID/ })).toBeVisible();

  await admin.getByLabel('CSV file').setInputFiles(file(`${id},Imported Student,CS,2031\n`));
  admin.once('dialog', dialog => void dialog.accept());
  await admin.getByRole('button', { name: 'Apply import' }).click();
  await expect(admin.getByText(/Imported students.csv: 1 new/)).toBeVisible();

  await admin.getByRole('link', { name: 'Student lookup' }).click();
  await admin.getByLabel('Student ID').fill(id);
  await admin.getByRole('button', { name: new RegExp(id) }).click();
  admin.once('dialog', dialog => void dialog.accept());
  await admin.getByRole('button', { name: 'Issue temporary password' }).click();
  const notice = admin.getByText(/Temporary password for/);
  await expect(notice).toBeVisible();
  const temporary = (await notice.textContent())!.match(/: (\S+) — share/)![1];

  const student = await (await browser.newContext()).newPage();
  await signIn(student, id, temporary);
  await expect(student).toHaveURL(/\/change-password\/$/);

  await admin.getByRole('link', { name: 'Imports' }).click();
  admin.once('dialog', dialog => void dialog.accept());
  await admin.getByRole('button', { name: 'Undo this import' }).click();
  await expect(admin.getByText('Undid students.csv.')).toBeVisible();
  await expect(admin.locator('.sent-list > li').first()).toContainText('Undone');
});

test('admin adjusts thresholds, creates an administrator and reviews the audit log', async ({ page }, testInfo) => {
  const staffId = testInfo.project.name === 'desktop' ? 'STF-7001' : 'STF-7002';
  await signIn(page, 'STF-1001');
  await page.getByRole('link', { name: 'Settings' }).click();
  const normal = page.getByLabel('Normal load (credits per term)');
  await expect(normal).toHaveValue('5');
  await normal.fill('4.5');
  await page.getByRole('button', { name: 'Save thresholds' }).click();
  await expect(page.getByText('Saved. Standing everywhere now uses these thresholds.')).toBeVisible();

  await page.getByLabel('New administrator’s staff ID').fill(staffId);
  await page.getByRole('button', { name: 'Create administrator' }).click();
  await expect(page.getByText(new RegExp(`Created ${staffId}. Temporary password`))).toBeVisible();
  await expect(page.locator('.admin-list')).toContainText(staffId);

  await page.getByLabel('Activity').selectOption('ADMIN_SETTINGS_UPDATED');
  await expect(page.getByRole('cell', { name: 'Admin settings updated' }).first()).toBeVisible();

  await normal.fill('5');
  await page.getByRole('button', { name: 'Save thresholds' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
});
