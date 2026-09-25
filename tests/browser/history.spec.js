import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
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
  await choose(page, "Handkarte 1", "Ass", "Pik");
  await choose(page, "Handkarte 2", "Ass", "Herz");
}
test("save optional board, gross payout and loss; persist, mask, update, export and delete", async ({
  page,
}) => {
  await setup(page);
  await page.locator("#save-hand").click();
  await expect(page.locator("#save-board")).toBeDisabled();
  await page.locator("#confirm-save").click();
  await expect(page.locator("#save-feedback")).toContainText("Bitte");
  await page.locator("#save-outcome").selectOption("won");
  await page.locator("#save-amount").fill("5,50");
  await page.locator("#confirm-save").click();
  await expect(page.locator("#save-feedback")).toContainText("Gespeichert");
  await page.locator("#confirm-save").click();
  await page.locator("#close-save").click();
  await page.locator("#open-history").click();
  await expect(page.locator("#history-content")).toBeHidden();
  await page.locator("#toggle-history").click();
  await expect(page.locator("#history-message")).toContainText("1 Hand");
  await expect(page.locator("#history-list")).toContainText(
    "Tisch: nicht erfasst",
  );
  await expect(page.locator("#history-list")).toContainText("5,50");
  await page.locator("#close-history").click();
  await page.locator("#new-hand").click();
  await choose(page, "Handkarte 1", "König", "Pik");
  await choose(page, "Handkarte 2", "Dame", "Pik");
  await choose(page, "Flopkarte 1", "2", "Herz");
  await page.locator("#save-hand").click();
  await page.locator("#save-outcome").selectOption("lost");
  await page.locator("#save-amount").fill("-2");
  await page.locator("#confirm-save").click();
  await expect(page.locator("#save-feedback")).toContainText("nichtnegative");
  await page.locator("#save-amount").fill("2");
  await page.locator("#confirm-save").click();
  await page.locator("#close-save").click();
  await page.reload();
  await page.locator("#open-history").click();
  await expect(page.locator("#history-content")).toBeHidden();
  await page.locator("#toggle-history").click();
  await expect(page.locator("#history-summary")).toContainText(
    "1 gewonnen · 1 verloren",
  );
  await expect(page.locator("#history-summary")).toContainText(
    "Keine Nettobilanz",
  );
  await expect(page.locator("#history-list")).toContainText(
    "unvollständig erfasst",
  );
  const downloaded = page.waitForEvent("download");
  await page.locator("#export-history").click();
  const data = JSON.parse(
    await readFile(await (await downloaded).path(), "utf8"),
  );
  expect(data.hands).toHaveLength(2);
  expect(data.hands[0].amountMeaning).toBe("gross_payout");
  expect(data.hands[1].amountMeaning).toBe("lost_stake");
  page.once("dialog", (d) => d.accept());
  await page.locator("#history-list button").first().click();
  await expect(page.locator("#history-list article")).toHaveCount(1);
});
test("storage failure is explicit and does not break calculator", async ({
  page,
}) => {
  await setup(page);
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.locator("#save-hand").click();
  await page.locator("#save-outcome").selectOption("lost");
  await page.locator("#confirm-save").click();
  await expect(page.locator("#save-feedback")).toContainText(
    "Nicht gespeichert",
  );
  await page.locator("#close-save").click();
  await expect(page.locator("#result")).toContainText("%");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      get: () => true,
      configurable: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator("#result")).toBeVisible();
});
test("eight opponents compute preflop and river without borrowing five-opponent equity", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await setup(page);
  await page.locator("#opponents").selectOption("8");
  await expect(page.locator("#public-status")).toContainText(
    "1.000.000 Austeilungen",
  );
  const q = Number(
    (await page.locator(".equity-number").innerText())
      .replace(",", ".")
      .replace(" %", ""),
  );
  expect(q).toBeGreaterThan(30);
  expect(q).toBeLessThan(40);
  await expect(page.locator("#ranking-note")).toContainText(
    "ausdrücklich 5 Gegner",
  );
  for (const [slot, rank, suit] of [
    ["Flopkarte 1", "König", "Kreuz"],
    ["Flopkarte 2", "Dame", "Kreuz"],
    ["Flopkarte 3", "Bube", "Kreuz"],
    ["Turn", "Zehn", "Kreuz"],
    ["River", "9", "Kreuz"],
  ])
    await choose(page, slot, rank, suit);
  await expect(page.locator("#public-status")).toContainText(
    "1.000.000 Austeilungen",
  );
  await expect(page.locator("#result")).toContainText("%");
  expect(errors).toEqual([]);
});
