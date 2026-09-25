import { test, expect } from "@playwright/test";
async function choose(page, slot, rank, suit) {
  await page
    .getByRole("button", { name: new RegExp("^" + slot + ":") })
    .click();
  await page.getByRole("button", { name: "Wert " + rank, exact: true }).click();
  await page
    .getByRole("button", { name: rank + " " + suit, exact: true })
    .click();
}
async function setup(page) {
  await page.goto("./");
  await choose(page, "Handkarte 1", "Ass", "Herz");
  await choose(page, "Handkarte 2", "König", "Herz");
  await page.locator("#opponents").selectOption("2");
  await choose(page, "Flopkarte 1", "Dame", "Herz");
  await choose(page, "Flopkarte 2", "9", "Herz");
  await choose(page, "Flopkarte 3", "2", "Kreuz");
}
test("own cards concealed; board and equity visible until explicitly hidden", async ({
  page,
}) => {
  await setup(page);
  await expect(
    page.getByRole("button", { name: "Handkarte 1: gesetzt, verdeckt" }),
  ).toBeVisible();
  await expect(page.locator("#board-cards")).toContainText("Q");
  await expect(page.locator("#current-hand")).toBeVisible();
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#toggle-board")).toHaveText("Verbergen");
  await expect(page.locator("#toggle-equity")).toHaveText("Verbergen");
  await page.locator("#toggle-board").click();
  await expect(page.locator("#board-cards")).not.toContainText("Q");
  await expect(page.locator("#result")).toBeVisible();
  await page.locator("#toggle-equity").click();
  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#quick-advice")).toBeHidden();
  await page.locator("#show-details").click();
  await expect(page.locator("#calculation-details")).toBeHidden();
  await page.locator("#close-analysis").click();
  await page.locator("#new-hand").click();
  await expect(page.locator("#toggle-equity")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#toggle-board")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("#toggle-hero")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await setup(page);
  await page.locator("#toggle-hero").click();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      get: () => true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#toggle-hero")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await expect(page.locator("#result")).toBeVisible();
  await expect(page.locator("#board-cards")).toContainText("Q");
  await page.locator("#hide-all").click();
  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#board-cards")).not.toContainText("Q");
});
test("compact monochrome overview fits 430×740 with results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 740 });
  await setup(page);
  for (const id of ["hero"]) await page.locator("#toggle-" + id).click();
  await expect(page.locator("#public-status")).toContainText(
    "1.000.000 Austeilungen",
  );
  for (const id of [
    "current-hand",
    "hero-cards",
    "board-cards",
    "opponents",
    "result",
    "quick-advice",
    "samples",
    "save-hand",
  ])
    await expect(page.locator("#" + id)).toBeInViewport();
  expect(
    await page
      .locator("#rechner")
      .evaluate((e) => e.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual(740);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    430,
  );
  const colors = await page.locator("#rechner").evaluate((e) =>
    [...e.querySelectorAll("*")].flatMap((n) => {
      const s = getComputedStyle(n);
      return [s.color, s.backgroundColor, s.borderTopColor];
    }),
  );
  for (const color of colors) {
    const channels = color.match(/[\d.]+/g)?.map(Number);
    if (channels?.length >= 3)
      expect(channels[0] === channels[1] && channels[1] === channels[2]).toBe(
        true,
      );
  }
  await page.screenshot({
    path: `test-results/${test.info().project.name}-compact.png`,
  });
});
test("5 million mode, result masks do not interrupt calculation, exact flop mode", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#toggle-equity").click();
  await page.locator("#samples").selectOption("5000000");
  await expect(page.locator("#public-status")).toContainText(
    "5.000.000 Austeilungen",
  );
  await expect(page.locator("#result")).toBeHidden();
  await page.locator("#opponents").selectOption("1");
  await expect(page.locator("#public-status")).toContainText(
    "Exakt · 1.070.190",
  );
  await page.locator("#toggle-equity").click();
  await expect(page.locator("#result")).toContainText("Exakt im Zufallsmodell");
});
test("automatic tiers need no monetary input; hand changes remove stale advice", async ({
  page,
}) => {
  await setup(page);
  await expect(page.locator("#public-status")).toContainText(
    "1.000.000 Austeilungen",
  );
  await expect(page.locator("#quick-advice")).toContainText("1,20");
  await expect(page.locator("#quick-note")).not.toContainText("Vorläufig");
  await expect(
    page.locator("#edit-situation, #situation-dialog, #pot, #call, #stack"),
  ).toHaveCount(0);
  await choose(page, "Turn", "Bube", "Herz");
  await choose(page, "River", "Zehn", "Herz");
  await page.locator("#opponents").selectOption("1");
  await expect(page.locator("#result")).toContainText("Exakt im Zufallsmodell");
  await expect(page.locator("#quick-advice")).toContainText("2,40");
  await page.locator("#opponents").selectOption("0");
  await expect(page.locator("#quick-advice")).toHaveText("Pot gewonnen");
  await page.locator("#new-hand").click();
  await expect(page.locator("#quick-advice")).toHaveText("Potanteil abwarten");
  await choose(page, "Handkarte 1", "2", "Kreuz");
  await choose(page, "Handkarte 2", "3", "Karo");
  for (const [slot, rank] of [
    ["Flopkarte 1", "Ass"],
    ["Flopkarte 2", "König"],
    ["Flopkarte 3", "Dame"],
    ["Turn", "Bube"],
    ["River", "Zehn"],
  ])
    await choose(page, slot, rank, "Pik");
  await page.locator("#opponents").selectOption("2");
  await expect(page.locator("#public-status")).toContainText(
    "1.000.000 Austeilungen",
  );
  await expect(page.locator("#quick-advice")).toContainText("0,60");
  await page.locator("#opponents").selectOption("5");
  await expect(page.locator("#public-status")).toContainText(
    "1.000.000 Austeilungen",
  );
  await expect(page.locator("#quick-advice")).toContainText(
    "Schieben / nicht erhöhen",
  );
});
