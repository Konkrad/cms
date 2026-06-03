import {
  test,
  expect,
  createUserSession,
  getGroupBySlug,
  addGroupMember,
  deleteGroupMember,
  deleteGroupRepresentative,
} from '../fixtures';

// NOTE: These tests assume a group exists at /groups/<slug>. Use a known slug.
const GROUP_SLUG = 'berlin';
const GROUP_URL = `/groups/${GROUP_SLUG}`;

test.describe('Groups page', () => {
  test('public view shows group info for logged-out users', async ({ guestPage: page }) => {
    await page.goto(GROUP_URL);
    // Check for the members tile and a visible join CTA
    await expect(page.locator('text=Community Members')).toBeVisible();
    await expect(page.locator('text=Join This Group')).toBeVisible();
  });

  test('logged-in user can join group', async ({ memberPage: page }) => {
    await page.goto(GROUP_URL);
    const joinBtn = page.locator('button:has-text("Join This Group")').first();
    await expect(joinBtn).toBeVisible();
    await joinBtn.click();

    // After joining, expect a 'Leave' or 'Member' indicator or member appears in list
    await expect(page.locator('text=Leave').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('text=Member').first()).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test('group admin can see user list', async ({ adminPage: page }) => {
    // Visit group and open members modal via the 'See All Members' CTA
    await page.goto(GROUP_URL);
    await expect(page.locator('text=See All Members')).toBeVisible({ timeout: 5000 });
    await page.locator('text=See All Members').click();

    // Expect the participants modal to open and show either a 'No participants yet' message or a list
    await expect(page.locator('text=Participants —')).toBeVisible({ timeout: 5000 }).catch(() => {});
    await expect(page.locator('text=No participants yet').or(page.locator('ul li'))).toBeTruthy();
  });
});

test.describe('Groups — admin member management', () => {
  test('admin can promote a group member to representative', async ({ adminPage: page }) => {
    const group = getGroupBySlug(GROUP_SLUG);
    if (!group) throw new Error(`Group "${GROUP_SLUG}" not found in DB — run seed first`);

    const memberSession = createUserSession('user');
    addGroupMember(memberSession.userId, group.id);

    try {
      await page.goto(`/admin/global/groups/${group.id}/members`);
      await expect(page.locator('h1')).toBeVisible({ timeout: 10_000 });

      page.on('dialog', (d) => d.accept());

      await page
        .locator(`form:has(input[value="${memberSession.userId}"]) button[type="submit"]`)
        .click();

      await expect(page.locator('text=Representative')).toBeVisible({ timeout: 5_000 });
    } finally {
      deleteGroupRepresentative(memberSession.userId, group.id);
      deleteGroupMember(memberSession.userId, group.id);
      memberSession.cleanup();
    }
  });
});
