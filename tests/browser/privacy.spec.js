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
test("private by default; independent controls, inferred information, all-hide and reset", async ({
  page,
}) => {
  await setup(page);
  await expect(
    page.getByRole("button", { name: "Handkarte 1: gesetzt, verdeckt" }),
  ).toBeVisible();
  await expect(page.locator("#hero-cards")).not.toContainText("A");
  await expect(page.locator("#board-cards")).not.toContainText("Q");
  await expect(page.locator("#current-hand")).toBeHidden();
  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#quick-advice")).toBeHidden();
  await expect(page.locator("#quick-call")).toBeHidden();
  await page.locator("#show-details").click();
  await expect(page.locator("#calculation-details")).toBeHidden();
  await page.locator("#close-analysis").click();
  await page.locator("#toggle-hero").click();
  await expect(
    page.getByRole("button", { name: "Handkarte 1: Ass Herz" }),
  ).toBeVisible();
  await expect(page.locator("#result")).toBeHidden();
  await page.locator("#toggle-equity").click();
  await expect(page.locator("#current-hand")).toContainText("Hohe Karte");
  await expect(page.locator("#board-cards")).not.toContainText("Q");
  await page.locator("#toggle-board").click();
  await expect(
    page.getByRole("button", { name: "Flopkarte 1: Dame Herz" }),
  ).toBeVisible();
  await page.locator("#hide-all").click();
  await expect(page.locator("#result")).toBeHidden();
  await expect(page.locator("#current-hand")).toBeHidden();
  await page.locator("#toggle-equity").click();
  await page.locator("#new-hand").click();
  await expect(page.locator("#toggle-equity")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
});
test("compact monochrome overview fits 430×740 with results", async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 740 });
  await setup(page);
  for (const id of ["hero", "board", "equity"])
    await page.locator("#toggle-" + id).click();
  await expect(page.locator("#public-status")).toContainText(
    "1.000.000 Austeilungen",
  );
  for (const id of [
    "current-hand",
    "hero-cards",
    "board-cards",
    "opponents",
    "result",
    "edit-situation",
    "samples",
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
test("conditional max call, no bound with future payments, compact euro action", async ({
  page,
}) => {
  await page.setViewportSize({ width: 430, height: 740 });
  await page.goto("./");
  await choose(page, "Handkarte 1", "Ass", "Pik");
  await choose(page, "Handkarte 2", "Ass", "Herz");
  await page.locator("#toggle-equity").click();
  await page.locator("#edit-situation").click();
  for (const [id, val] of Object.entries({
    pot: "0,30",
    call: "0,20",
    paid: "0",
    stack: "10",
  }))
    await page.locator("#" + id).fill(val);
  await page.locator("#position").selectOption("early");
  await page.locator("#situation").selectOption("unopened");
  await page.locator("#close-situation").click();
  await expect(page.locator("#quick-advice")).toContainText("insgesamt 0,60");
  await page.locator("#edit-situation").click();
  await page.locator("#pot").fill("3");
  await page.locator("#call").fill("1");
  await page.locator("#q").fill("35");
  await page.locator("#closing").check();
  await page.locator("#close-situation").click();
  await expect(page.locator("#quick-call")).toContainText("1,60");
  expect(
    await page
      .locator("#rechner")
      .evaluate((e) => e.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual(740);
  await page.locator("#edit-situation").click();
  await page.locator("#closing").uncheck();
  await page.locator("#close-situation").click();
  await expect(page.locator("#quick-call")).toContainText("weitere Zahlungen");
  await page.locator("#edit-situation").click();
  await page.locator("#special").check();
  await page.locator("#close-situation").click();
  await expect(page.locator("#quick-call")).not.toContainText("1,60");
});
