import type { Locator, Page } from '@playwright/test';

/**
 * Opening an issue row's context menu.
 *
 * Right-clicking the `<a>` inside the row does nothing — the link swallows the
 * event. The trigger is the wrapper, and targeting the wrong one cost an
 * afternoon of "the menu will not open".
 */
export async function openIssueMenu(page: Page, index = 0): Promise<Locator> {
   const trigger = page.locator('[data-slot="context-menu-trigger"]').nth(index);
   await trigger.waitFor({ state: 'visible', timeout: 30_000 });
   await trigger.click({ button: 'right' });
   return trigger;
}

/**
 * Menu items carry their keyboard shortcut in the accessible name — "Favorite"
 * is really "Favorite\nF" — so an exact match never hits. Anchor at the start
 * so `Favorite` does not also match `Unfavorite`.
 */
export const menuItem = (page: Page, label: string) =>
   page.getByRole('menuitem', { name: new RegExp(`^${label}`) });

/** The sidebar group with this heading, or an empty locator if it is absent. */
export const sidebarGroup = (page: Page, heading: string) =>
   page.locator('[data-sidebar="group"]').filter({ hasText: heading }).first();

/** Names inside a sidebar group, minus the heading itself. */
export async function sidebarGroupItems(page: Page, heading: string): Promise<string[]> {
   const group = sidebarGroup(page, heading);
   if ((await group.count()) === 0) return [];
   return (await group.innerText())
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && line !== heading);
}

/**
 * Typing into a controlled input rather than `fill`.
 *
 * `fill` sets the value in one event, and a submit button gated on React state
 * can still read as disabled straight afterwards — which produced two runs that
 * reported a comment posted while nothing was written.
 */
export async function type(locator: Locator, text: string): Promise<void> {
   await locator.click();
   await locator.pressSequentially(text, { delay: 10 });
}

/** Waits for a synced change to arrive, without asserting how long it took. */
export const settle = (page: Page, ms = 4000) => page.waitForTimeout(ms);
