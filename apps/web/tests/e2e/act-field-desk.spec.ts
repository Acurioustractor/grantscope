import { expect, test } from '@playwright/test';

test.describe('ACT Field Desk pilot workflow', () => {
  test('bare org root lands on One Desk', async ({ page }) => {
    await page.goto('/org/act');
    await expect(page).toHaveURL(/\/org\/act\/desk/);
    await expect(page.getByRole('heading', { name: 'One Desk' })).toBeVisible();
  });

  test('walks through every gold-standard surface with persistent progress', async ({ page }) => {
    await page.goto('/org/act?walkthrough=1');

    const guide = page.getByTestId('act-test-guide');
    await expect(guide.getByRole('heading', { name: 'Test the whole ACT system' })).toBeVisible();
    await expect(guide.getByRole('progressbar', { name: 'ACT test drive progress' })).toHaveAttribute('aria-valuenow', '0');
    await expect(guide.getByRole('listitem')).toHaveCount(6);
    await expect(guide).toContainText('These screens use live ACT data');

    await guide.getByLabel('Mark Whole system test complete').check();
    await expect(guide.getByRole('progressbar', { name: 'ACT test drive progress' })).toHaveAttribute('aria-valuenow', '1');

    await guide.getByRole('link', { name: 'Open live opportunities screen' }).click();
    await expect(page).toHaveURL(/view=opportunities/);
    await expect(page).toHaveURL(/walkthrough=1/);
    await expect(page.getByRole('heading', { name: 'Read what is changing' })).toBeVisible();
    await expect(page.getByTestId('act-test-guide').getByLabel('Mark Whole system test complete')).toBeChecked();
    await expect(page.getByTestId('act-test-guide')).toContainText('Current screen');

    await page.getByTestId('act-test-guide').getByRole('button', { name: 'Close ACT test guide' }).click();
    await expect(page.getByTestId('act-test-guide-launcher')).toContainText('Resume test drive · 1/6');
  });

  test('routes the discovery receipt into the matter-review desk', async ({ page }) => {
    await page.goto('/org/act?view=today');

    const receipt = page.getByLabel('Latest discovery activity');
    await expect(receipt).toContainText('Discovery activity recorded');
    await expect(receipt).toContainText('Openings');
    await expect(receipt).toContainText('Relationships');

    await receipt.getByRole('link', { name: 'Review changes' }).click();
    await expect(page).toHaveURL(/review=changes/);

    // The review surface is now the matter desk: at most five matters, shown
    // only under explicit attention conditions. Zero matters is a valid state.
    const workbench = page.getByTestId('act-relational-review-workbench');
    await expect(workbench.getByRole('heading', { name: 'What needs understanding now' })).toBeVisible();
    await expect(
      workbench.getByText(/(matters? needs? a read|No matters currently meet the weekly attention conditions)/),
    ).toBeVisible();
  });

  test('completes and restores the first Today action', async ({ page }) => {
    await page.route('**/api/org/act-fast-local/daily-actions', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/org/act?view=today');

    const today = page.getByTestId('act-today-focus');
    await expect(today.getByTestId('today-primary')).toContainText('Return: share the delivery evidence');

    // Undo is only offered for non-decision actions, so exercise it on the
    // Country Arts Network relationship item rather than the decision-backed return.
    await today.getByLabel('Update today: Country Arts Network').selectOption('done');
    await expect(today).toContainText('1 handled today');

    await today.getByRole('button', { name: 'Undo last' }).click();
    await expect(today).toContainText('Country Arts Network');
  });

  test('assigns a concrete Action plan and follows the warm relationship path', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 640 });
    let submittedPlan: Record<string, unknown> | null = null;
    let submittedFunderMove: Record<string, unknown> | null = null;
    let submittedFunderOutcome: Record<string, unknown> | null = null;
    await page.route('**/api/org/act-fast-local/pipeline', async (route) => {
      submittedPlan = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });
    await page.route('**/api/org/act-fast-local/funder-intelligence', async (route) => {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      if (route.request().method() === 'POST') submittedFunderOutcome = payload;
      else submittedFunderMove = payload;
      await route.fulfill({ status: route.request().method() === 'POST' ? 201 : 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/org/act?view=pipeline&commitment=e2e-real-eoi#pipeline');

    const actionViewport = page.viewportSize();
    const deskWorkspace = await page.getByTestId('act-desk-workspace').boundingBox();
    const deskHeader = await page.getByTestId('act-desk-header').boundingBox();
    const deskSidebar = await page.getByTestId('act-desk-sidebar').boundingBox();
    const sidebarContent = await page.getByTestId('act-desk-sidebar-content').evaluate((element) => ({
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
      top: element.getBoundingClientRect().top,
    }));
    expect(deskWorkspace?.x).toBeLessThanOrEqual(1);
    expect(deskWorkspace?.width).toBeGreaterThanOrEqual((actionViewport?.width ?? 0) - 20);
    expect(deskHeader?.height).toBeLessThanOrEqual(92);
    expect(deskSidebar?.width).toBeLessThanOrEqual(210);
    expect(sidebarContent.top).toBeLessThanOrEqual(1);
    expect(sidebarContent.scrollHeight).toBeLessThanOrEqual(sidebarContent.clientHeight + 1);

    const selected = page.getByTestId('action-selected');
    await expect(selected).toContainText('REAL Innovation Fund EOI');
    await expect(selected).toContainText('Alex Snow');
    expect((await selected.boundingBox())?.width).toBeGreaterThanOrEqual(400);
    await selected.getByRole('button', { name: 'Plan next step' }).click();
    await selected.getByLabel('Owner').fill('Benjamin');
    await selected.getByLabel('Next action').fill('Ask Alex for a 30 minute evidence call');
    await selected.getByLabel('Date').fill('2026-07-20');
    await selected.getByRole('button', { name: 'Save plan' }).click();

    await expect.poll(() => submittedPlan).toEqual({
      id: 'e2e-real-eoi',
      owner_name: 'Benjamin',
      next_action: 'Ask Alex for a 30 minute evidence call',
      next_action_at: '2026-07-20',
    });
    await expect(selected).toContainText('Plan saved');

    await selected.getByRole('link', { name: 'Open this relationship' }).click();
    await expect(page).toHaveURL(/view=relationships&relationship=e2e-snow-contact/);
    await expect(page.getByRole('heading', { name: 'Everything ACT knows, in one place' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alex Snow' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'ACT history with this organisation' })).toBeVisible();
    await expect(page.getByText('Goods on Country evidence, community-led delivery planning, and supporter reporting.')).toBeVisible();
    await expect(page.getByText('$50K')).toBeVisible();
    await expect(page.getByText('Fit', { exact: true })).not.toBeVisible();
    await expect(page.getByText('Warmth', { exact: true })).not.toBeVisible();

    await page.getByRole('button', { name: 'Plan next move' }).click();
    await page.getByLabel('Relationship state').selectOption('meeting');
    await page.getByLabel('Funder next move').fill('Confirm a Goods on Country evidence conversation with Alex');
    await page.getByLabel('Funder follow-up date').fill('2026-07-22');
    await page.getByRole('button', { name: 'Save next move' }).click();

    await expect.poll(() => submittedFunderMove).toEqual({
      relationship_id: 'e2e-snow-relationship',
      project_id: 'e2e-goods',
      foundation_name: 'Snow Foundation',
      engagement_status: 'meeting',
      next_step: 'Confirm a Goods on Country evidence conversation with Alex',
      next_touch_at: '2026-07-22',
    });

    await expect(page.getByRole('heading', { name: 'Recent relationship outcomes' })).toBeVisible();
    await page.getByRole('button', { name: 'Record outcome' }).click();
    await page.getByLabel('Funder outcome', { exact: true }).selectOption('proposal_invited');
    await page.getByLabel('Funder outcome summary').fill('Alex invited a short proposal for the next funding round');
    await page.getByLabel('Outcome next move').fill('Send the two-page Goods on Country proposal');
    await page.getByLabel('Outcome follow-up date').fill('2026-07-25');
    await page.getByRole('button', { name: 'Record and learn' }).click();

    await expect.poll(() => submittedFunderOutcome).toEqual({
      relationship_id: 'e2e-snow-relationship',
      project_id: 'e2e-goods',
      foundation_name: 'Snow Foundation',
      outcome: 'proposal_invited',
      summary: 'Alex invited a short proposal for the next funding round',
      next_step: 'Send the two-page Goods on Country proposal',
      next_touch_at: '2026-07-25',
    });
  });

  test('reviews one canonical person with complete ACT history and a next move', async ({ page }) => {
    await page.route('**/api/org/*/people-directory*', async (route) => {
      const requestUrl = new URL(route.request().url());
      if (requestUrl.searchParams.has('person')) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            history: [{
              id: 'history-1',
              channel: 'email',
              direction: 'inbound',
              title: 'Goods evidence conversation',
              summary: 'Jane confirmed the community evidence review and asked ACT to suggest two useful dates.',
              sentiment: 'positive',
              topics: ['community evidence'],
              decisions: ['Proceed with evidence review'],
              happenedAt: '2026-07-12T09:00:00Z',
              sourceSystem: 'gmail',
              threadId: 'thread-1',
              projectCodes: ['ACT-GD'],
              waitingForResponse: true,
              followUpAt: '2026-07-18T09:00:00Z',
              full_private_body: 'This deliberately must never appear in the interface.',
            }],
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          generatedAt: '2026-07-14T09:00:00Z',
          summary: { people: 1436, canonical: 612, withHistory: 189, withMoney: 84, withProjects: 487, needsResolution: 824 },
          query: '',
          filter: 'attention',
          page: 1,
          pageSize: 60,
          total: 1,
          people: [{
            id: 'unified-jane',
            ghlId: 'ghl-jane',
            canonicalPersonId: 'person-jane',
            unifiedContactId: 'unified-jane',
            name: 'Jane Rivers',
            email: 'jane@example.org',
            organisation: 'River Country Alliance',
            role: 'Director',
            category: 'community partner',
            engagementStatus: 'active',
            projects: ['ACT-GD', 'HARVEST'],
            tags: ['partner'],
            sources: ['civicgraph', 'gmail', 'ghl', 'xero'],
            identityStatus: 'canonical',
            identityConfidence: 0.97,
            dataQualityScore: 92,
            needsCleanup: false,
            lastVerifiedAt: '2026-07-10T09:00:00Z',
            canonicalOrganisationId: 'entity-river',
            canonicalOrganisationGsId: 'GS-RIVER',
            canonicalOrganisationName: 'River Country Alliance Ltd',
            relationshipStrength: 'warm',
            temperature: 68,
            stage: 'active_partner',
            sentiment: 'positive',
            touchpoints: 12,
            emailCount: 8,
            inboundCount: 5,
            outboundCount: 7,
            firstContactAt: '2025-04-01T09:00:00Z',
            lastContactAt: '2026-07-12T09:00:00Z',
            daysSinceContact: 2,
            receivedFromThem: 48000,
            paidToThem: 4000,
            paidInvoiceCount: 2,
            opportunityCount: 2,
            pipelineValue: 120000,
            wonValue: 25000,
            riskFlags: [],
            recommendedMove: 'Invite Jane into the Goods evidence review.',
            evidenceGaps: [],
          }],
        }),
      });
    });

    await page.goto('/org/act?view=relationships#relationships');
    await page.getByRole('button', { name: 'People', exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Every person, connection and next move' })).toBeVisible();
    await expect(page.getByText('1,436')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Jane Rivers' })).toBeVisible();
    await expect(page.getByText('Invite Jane into the Goods evidence review.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What ACT tried, what happened, what comes next' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Goods evidence conversation' })).toBeVisible();
    await expect(page.getByText('Jane confirmed the community evidence review and asked ACT to suggest two useful dates.')).toBeVisible();
    await expect(page.getByText('This deliberately must never appear in the interface.')).toHaveCount(0);

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
  });

  test('keeps the daily desk usable on a phone-sized viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/org/act?view=today');

    await expect(page.getByRole('heading', { name: 'What needs moving today' })).toBeVisible();
    await expect(page.getByTestId('today-primary')).toBeVisible();
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflows).toBe(false);

    await page.goto('/org/act?view=relationships#relationships');
    await expect(page.getByRole('heading', { name: 'Everything ACT knows, in one place' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Alex Snow' })).toBeVisible();
    const relationshipOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(relationshipOverflows).toBe(false);

    await page.goto('/org/act?view=pipeline#pipeline');
    await expect(page.getByRole('heading', { name: 'Move committed work forward' })).toBeVisible();
    const actionOverflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(actionOverflows).toBe(false);
  });

  test('searches the ACT Atlas and switches between record and map views', async ({ page }) => {
    await page.goto('/org/act/explore?q=Wadeye');

    await expect(page.getByRole('heading', { name: 'ACT Atlas' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Wadeye', exact: true })).toBeVisible();
    const viewport = page.viewportSize();
    const controlBar = await page.getByTestId('atlas-control-bar').boundingBox();
    const workspace = await page.getByTestId('atlas-workspace').boundingBox();
    const sidebar = await page.getByTestId('act-desk-sidebar').boundingBox();
    expect(controlBar?.height).toBeLessThanOrEqual(92);
    expect(sidebar?.x).toBeLessThanOrEqual(1);
    expect(sidebar?.width).toBeLessThanOrEqual(210);
    expect(workspace?.x).toBeGreaterThanOrEqual((sidebar?.width ?? 0) - 1);
    expect(workspace?.width).toBeGreaterThanOrEqual((viewport?.width ?? 0) - (sidebar?.width ?? 0) - 20);
    const record = page.getByTestId('atlas-record-panel');
    await expect(record).toContainText('918 items');
    await expect(record).toContainText('24');
    await expect(record.getByRole('tab', { name: 'Buyers and delivery partners 2' })).toBeVisible();
    await expect(record).toContainText('West Daly Regional Council');
    await record.getByRole('button', { name: 'Open drawer' }).first().click();
    const drawer = page.getByTestId('atlas-entity-drawer');
    await expect(drawer).toContainText('West Daly Regional Council');
    await drawer.getByRole('button', { name: 'Close entity drawer' }).click();

    await page.getByRole('link', { name: 'Map', exact: true }).click();
    await expect(page).toHaveURL(/mode=map/);
    await expect(page.getByTestId('atlas-map')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/org/act/explore?q=Wadeye');
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
  });

  test('keeps one ACT shell across the desk, Atlas, and project records', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/org/act?view=today');

    const sidebar = page.getByTestId('act-desk-sidebar');
    await expect(sidebar).toBeVisible();
    await sidebar.getByRole('link', { name: /Atlas/ }).click();
    await expect(page).toHaveURL(/\/org\/act\/explore/);
    await expect(page.getByTestId('atlas-control-bar')).toBeVisible();
    await expect(sidebar).toBeVisible();
    await expect(page.locator('nav[aria-label="ACT workspace"]')).toHaveCount(0);

    await sidebar.getByRole('link', { name: /Goods/ }).click();
    // First navigation to the project route cold-compiles in dev — allow for it.
    await expect(page).toHaveURL(/\/org\/act\/goods/, { timeout: 30_000 });
    await expect(page.getByTestId('act-project-header')).toBeVisible();
    await expect(sidebar).toBeVisible();
    await expect(page.locator('aside')).toHaveCount(1);
    await expect(page.locator('nav[aria-label="ACT project fields"]')).toHaveCount(1);
  });

  test('surfaces ACT history and known people for an Atlas funder', async ({ page }) => {
    await page.goto('/org/act/explore?q=Snow%20Foundation');

    const record = page.getByTestId('atlas-record-panel');
    await expect(record.getByRole('heading', { name: 'Snow Foundation', exact: true })).toBeVisible();
    await expect(record).toContainText('ACT relationship: warm');
    await expect(record.getByRole('tab', { name: 'ACT history 2' })).toBeVisible();
    await record.getByRole('tab', { name: 'People 1' }).click();
    await expect(record.getByText('Alex Snow')).toBeVisible();
    await expect(record.getByText('Follow up the Goods on Country conversation')).toBeVisible();
  });

  test('connects an Atlas person to ACT history and their organisation network', async ({ page }) => {
    await page.goto('/org/act/explore?q=Georgina%20Byron');

    const record = page.getByTestId('atlas-record-panel');
    await expect(record.getByRole('heading', { name: 'Georgina Byron', exact: true })).toBeVisible();
    await expect(record).toContainText('ACT relationship: warm');
    await expect(record.getByText('Snow Foundation News')).toBeVisible();
    await record.getByRole('tab', { name: 'Connected organisations 2' }).click();
    await expect(record.getByText('Snow Foundation', { exact: true })).toBeVisible();
    await expect(record.getByText('Philanthropy Australia', { exact: true })).toBeVisible();
  });

  test('connects an Atlas organisation to invoices, conversations and people', async ({ page }) => {
    await page.goto('/org/act/explore?q=Regional%20Arts%20Australia');

    const record = page.getByTestId('atlas-record-panel');
    await expect(record.getByRole('heading', { name: 'Regional Arts Australia', exact: true })).toBeVisible();
    await expect(record.getByText('INV-0337 · paid')).toBeVisible();
    await expect(record.getByText('Artlands 2026 Witta meeting invitation')).toBeVisible();
    await record.getByRole('tab', { name: 'People 1' }).click();
    await expect(record.getByText('Skye Parker')).toBeVisible();
    await expect(record.getByText('Confirm the Artlands invitation and next paid scope')).toBeVisible();
  });

  test('turns an ACT project into an actionable operating brief', async ({ page }) => {
    await page.goto('/org/act/explore?q=Goods%20on%20Country&type=project');

    const record = page.getByTestId('atlas-record-panel');
    await expect(record.getByRole('heading', { name: 'Goods on Country', exact: true })).toBeVisible();
    await expect(record.getByText('Record the outcome and follow-up for REAL Innovation Fund EOI')).toBeVisible();
    await expect(record.getByRole('tab', { name: 'Pipeline 2' })).toBeVisible();
    await record.getByRole('tab', { name: 'Money 1' }).click();
    await expect(record.getByText('$141,500 receivable · $2,483,561 weighted pipeline')).toBeVisible();
    await record.getByRole('tab', { name: 'Communities 1' }).click();
    await expect(record.getByText('Wadeye', { exact: true })).toBeVisible();
    await expect(record.getByText('At least one live opportunity has no owner.')).toBeVisible();
  });

  test('shows an opportunity decision brief instead of another grant listing', async ({ page }) => {
    await page.goto('/org/act/explore?q=REAL%20Innovation%20Fund%20EOI&type=opportunity');

    const record = page.getByTestId('atlas-record-panel');
    await expect(record.getByRole('heading', { name: 'REAL Innovation Fund EOI', exact: true })).toBeVisible();
    await expect(record.getByText('Record the outcome for REAL Innovation Fund EOI')).toBeVisible();
    await expect(record.getByRole('tab', { name: 'ACT pipeline 1' })).toBeVisible();
    await record.getByRole('tab', { name: 'Decision history 1' }).click();
    await expect(record.getByText('ACT-GD · apply')).toBeVisible();
    await record.getByRole('tab', { name: 'Requirements 2' }).click();
    await expect(record.getByText('Evidence of employment outcomes, delivery partnerships and scalable community benefit.')).toBeVisible();
    await expect(record.getByText('The active pipeline item has no next action.')).toBeVisible();
  });

  test('keeps production-style and legacy full links on the Field Desk', async ({ page }) => {
    await page.goto('/org/act?full=1');

    await expect(page.getByRole('heading', { name: 'What needs moving today' })).toBeVisible();
    await expect(page.getByTestId('act-today-focus')).toBeVisible();
    await expect(page.getByText('Calm view of opportunities, action, and growth work', { exact: true })).not.toBeVisible();
  });

  test('reviews and links an unresolved ACT contact', async ({ page }) => {
    let submittedResolution: Record<string, unknown> | null = null;
    await page.route('**/api/org/act-fast-local/contact-resolution', async (route) => {
      submittedResolution = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
    });

    await page.goto('/org/act?view=relationships#relationships');
    await page.getByRole('button', { name: /Resolve contacts 1/ }).click();
    await expect(page.getByRole('heading', { name: 'Unlinked ACT contacts' })).toBeVisible();
    await expect(page.getByLabel('CivicGraph entity for Regional Partner')).toHaveValue('e2e-regional-partner-entity');
    await page.getByRole('button', { name: 'Link entity' }).click();

    await expect.poll(() => submittedResolution).toEqual({
      contact_id: 'e2e-unlinked-contact',
      entity_id: 'e2e-regional-partner-entity',
    });
    await expect(page.getByText('All ACT contacts are linked.')).toBeVisible();
  });

  test('connects invoices, work, people, and conversations in the relationship ledger', async ({ page }) => {
    await page.goto('/org/act?view=money#money');

    await expect(page.getByRole('heading', { name: 'Relationship ledger' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Regional Arts Australia' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Relationship history' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Story' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Artlands 2026 Witta meeting invitation')).toBeVisible();
    await expect(page.getByText('Radical Scoops regional arts collaboration.')).toBeVisible();
    await page.getByRole('tab', { name: 'Invoices 2' }).click();
    await expect(page.getByRole('cell', { name: 'INV-0337 ACT-HV' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'INV-0300 ACT-HV' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'People' })).toBeVisible();

    await page.getByRole('button', { name: 'Exchange', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Country Arts Network' })).toBeVisible();
    await expect(page.getByText('No invoice yet · 1 exchange · No project code')).toBeVisible();
    await expect(page.getByText('Provided venue space for a community arts gathering.')).toBeVisible();
    await page.getByRole('tab', { name: 'Invoices 0' }).click();
    await expect(page.getByText('No invoice has been sent for this relationship yet.')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    const overflows = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflows).toBe(false);
  });

  test('records relational contributions beside the financial history', async ({ page }) => {
    let submittedContribution: Record<string, unknown> | null = null;
    await page.route('**/api/org/act-fast-local/relationship-contributions', async (route) => {
      submittedContribution = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'e2e-contribution' }) });
    });

    await page.goto('/org/act?view=money#money');
    await page.getByRole('button', { name: 'Record exchange' }).click();
    await page.getByLabel('Contribution').selectOption('introduction');
    await page.getByLabel('Payment').selectOption('not_expected');
    await page.getByLabel('What happened').fill('Introduced the regional arts team to a potential community delivery partner.');
    await page.getByLabel('Person').fill('Skye Parker');
    await page.getByLabel('Date').fill('2026-07-10');
    await page.getByRole('button', { name: 'Save exchange' }).click();

    await expect.poll(() => submittedContribution).toEqual({
      organisation: 'Regional Arts Australia',
      direction: 'given',
      contribution_type: 'introduction',
      payment_state: 'not_expected',
      summary: 'Introduced the regional arts team to a potential community delivery partner.',
      person: 'Skye Parker',
      amount: null,
      happened_at: '2026-07-10',
    });
    await expect(page.getByRole('status')).toHaveText('Exchange recorded.');
  });

  test('starts a relationship exchange before an invoice exists', async ({ page }) => {
    let submittedContribution: Record<string, unknown> | null = null;
    await page.route('**/api/org/act-fast-local/relationship-contributions', async (route) => {
      submittedContribution = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 'e2e-new-relationship' }) });
    });

    await page.goto('/org/act?view=money#money');
    const newExchange = page.getByTestId('new-relationship-exchange');
    await newExchange.getByRole('button', { name: 'New relationship exchange' }).click();
    await newExchange.getByLabel('Organisation', { exact: true }).fill('New Mutual Aid Partner');
    await newExchange.getByRole('button', { name: 'received', exact: true }).click();
    await newExchange.getByLabel('Contribution').selectOption('support');
    await newExchange.getByLabel('Payment').selectOption('not_expected');
    await newExchange.getByLabel('What happened').fill('Shared local knowledge and helped shape the gathering invitation.');
    await newExchange.getByLabel('Person').fill('Jamie Cole');
    await newExchange.getByLabel('Date').fill('2026-07-09');
    await newExchange.getByRole('button', { name: 'Save exchange' }).click();

    await expect.poll(() => submittedContribution).toEqual({
      organisation: 'New Mutual Aid Partner',
      direction: 'received',
      contribution_type: 'support',
      payment_state: 'not_expected',
      summary: 'Shared local knowledge and helped shape the gathering invitation.',
      person: 'Jamie Cole',
      amount: null,
      happened_at: '2026-07-09',
    });
    await expect(newExchange.getByRole('status')).toHaveText('Exchange recorded.');
  });

  test('plans and completes a relationship follow-up', async ({ page }) => {
    let savedPlan: Record<string, unknown> | null = null;
    let completedPlan: Record<string, unknown> | null = null;
    await page.route('**/api/org/act-fast-local/relationship-follow-ups', async (route) => {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      if (route.request().method() === 'PATCH') completedPlan = payload;
      else savedPlan = payload;
      await route.fulfill({ status: route.request().method() === 'PATCH' ? 200 : 201, contentType: 'application/json', body: JSON.stringify({ id: 'e2e-follow-up' }) });
    });

    await page.goto('/org/act?view=money#money');
    const planner = page.getByTestId('relationship-follow-up');
    await planner.getByRole('button', { name: 'Plan follow-up' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
    await planner.getByLabel('Next action').fill('Ask Skye to confirm the Witta visit and useful participants.');
    await planner.getByLabel('Owner').fill('Benjamin');
    await planner.getByLabel('Due').fill('2026-07-21');
    await planner.getByRole('button', { name: 'Save follow-up' }).click();
    await expect.poll(() => savedPlan).toEqual({
      organisation: 'Regional Arts Australia',
      action: 'Ask Skye to confirm the Witta visit and useful participants.',
      owner: 'Benjamin',
      due_at: '2026-07-21',
    });
    await expect(planner.getByRole('status')).toHaveText('Follow-up planned.');

    await page.goto('/org/act?view=money&ledger=country%20arts%20network#money');
    await expect(page.getByRole('heading', { name: 'Country Arts Network' })).toBeVisible();
    const existingPlan = page.getByTestId('relationship-follow-up');
    await expect(existingPlan).toContainText('Thank Morgan for the venue support');
    await existingPlan.getByRole('button', { name: 'Complete' }).click();
    await expect.poll(() => completedPlan).toEqual({ follow_up_id: 'e2e-country-arts-follow-up', status: 'completed' });
    await expect(existingPlan.getByRole('status')).toHaveText('Follow-up completed.');
  });

  test('confirms or dismisses suggested exchanges from relationship evidence', async ({ page }) => {
    let confirmed: Record<string, unknown> | null = null;
    let dismissed: Record<string, unknown> | null = null;
    await page.route('**/api/org/act-fast-local/relationship-contributions', async (route) => {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      if (route.request().method() === 'PATCH') dismissed = payload;
      else confirmed = payload;
      await route.fulfill({ status: route.request().method() === 'PATCH' ? 200 : 201, contentType: 'application/json', body: JSON.stringify({ id: 'e2e-reviewed-exchange' }) });
    });

    await page.goto('/org/act?view=money#money');
    const queue = page.getByTestId('suggested-exchange-queue');
    await queue.getByRole('button', { name: 'Review 2 suggested exchanges' }).click();

    const introduction = queue.getByRole('article').filter({ hasText: 'Local Government Association of the Northern Territory' });
    await expect(introduction).toContainText('A named introduction or connection was found.');
    await introduction.getByRole('button', { name: 'Confirm exchange' }).click();
    await expect.poll(() => confirmed).toEqual({
      organisation: 'Local Government Association of the Northern Territory',
      direction: 'received',
      contribution_type: 'introduction',
      payment_state: 'not_expected',
      summary: 'LGANT offered to introduce ACT to CDU about remote textiles and community infrastructure.',
      person: 'Michelle VanZanden',
      amount: null,
      happened_at: '2026-07-09',
      source_event_id: 'e2e-suggest-lgant-intro',
    });

    const invitation = queue.getByRole('article').filter({ hasText: 'Regional Arts Australia / Artlands' });
    await invitation.getByRole('button', { name: 'Dismiss' }).click();
    await expect.poll(() => dismissed).toEqual({
      source_event_id: 'e2e-suggest-artlands-invite',
      decision: 'dismissed',
    });
    await expect(queue.getByText('No suggested exchanges remain.')).toBeVisible();
  });
});
