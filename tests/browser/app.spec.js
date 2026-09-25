import { test, expect } from "@playwright/test";
async function choose(page, slot, rank, suit) {
  await page.getByRole("button", { name: new RegExp(`^${slot}:`) }).click();
  await page.getByRole("button", { name: `Wert ${rank}`, exact: true }).click();
  await page
    .getByRole("button", { name: `${rank} ${suit}`, exact: true })
    .click();
}
async function hand(page) {
  await choose(page, "Handkarte 1", "Ass", "Herz");
  await choose(page, "Handkarte 2", "König", "Herz");
}
async function flop(page) {
  await choose(page, "Flopkarte 1", "Dame", "Herz");
  await choose(page, "Flopkarte 2", "9", "Herz");
  await choose(page, "Flopkarte 3", "2", "Kreuz");
}
test.beforeEach(async ({ page }) => {
  await page.goto("./");
  await expect(page.locator("#result")).toContainText(
    "Wähle deine zwei Karten",
  );
});
test("preflop → incomplete flop → actual flop, edits, removal, new hand", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await hand(page);
  await expect(page.locator("#result")).toContainText("AKs");
  await page.locator("#opponents").selectOption("2");
  await choose(page, "Flopkarte 1", "Dame", "Herz");
  await expect(page.locator("#result")).toContainText("unvollständig");
  await expect(page.locator("#result")).not.toContainText("%");
  await choose(page, "Flopkarte 2", "9", "Herz");
  await choose(page, "Flopkarte 3", "2", "Kreuz");
  await expect(page.locator("#result")).toContainText("Simulation fertig");
  await expect(page.locator("#current-hand")).toContainText("Hohe Karte");
  await expect(
    page.getByRole("button", { name: "Handkarte 1: Ass Herz" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Flopkarte 2: 9 Herz" }).click();
  await page
    .getByRole("button", { name: "Karte entfernen", exact: true })
    .click();
  await expect(page.locator("#result")).toContainText("unvollständig");
  await page.locator("#stack").fill("8,70");
  await page.getByRole("button", { name: "Neue Hand" }).click();
  await expect(page.locator("#result")).toContainText(
    "Wähle deine zwei Karten",
  );
  await expect(page.locator("#stack")).toHaveValue("");
  await expect(page.locator("#bb")).toHaveValue("0,20");
  expect(errors).toEqual([]);
});
test("duplicates disabled, rank 169 completeness, opponent effects", async ({
  page,
}) => {
  await choose(page, "Handkarte 1", "Ass", "Herz");
  await page.getByRole("button", { name: "Handkarte 2: wählen" }).click();
  await page.getByRole("button", { name: "Wert Ass", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Ass Herz", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Ass Pik", exact: true }).click();
  await expect(page.locator("#result")).toContainText("AA");
  await page.locator("#opponents").selectOption("1");
  await expect(page.locator("#result")).toContainText("85,1");
  await page.getByText("Rangliste öffnen", { exact: true }).click();
  expect(await page.locator("#ranking-body tr").count()).toBe(169);
});
test("fast changes terminate worker and never restore stale output", async ({
  page,
}) => {
  await hand(page);
  await flop(page);
  for (const n of ["1", "5", "2", "4"])
    await page.locator("#opponents").selectOption(n);
  await page.locator("#clear-board").click();
  await expect(page.locator("#result")).toContainText("AKs");
  await page.waitForTimeout(1000);
  await expect(page.locator("#result")).toContainText("Gegen 4");
  await expect(page.locator("#result")).not.toContainText("Simulation fertig");
});
test("call validation, zero and 100%, future costs, euro recommendations", async ({
  page,
}) => {
  await hand(page);
  await page.locator("#pot").fill("3");
  await page.locator("#call").fill("1");
  await expect(page.locator("#threshold")).toContainText("25,0 %");
  await expect(page.locator("#call-result")).toContainText("Weitere Zahlungen");
  await page.locator("#closing").check();
  await page.locator("#q").fill("35");
  await expect(page.locator("#call-result")).toContainText("0,40");
  await page.locator("#q").fill("0");
  await expect(page.locator("#call-result")).toContainText("-1,00");
  await page.locator("#q").fill("100");
  await expect(page.locator("#call-result")).toContainText("3,00");
  await page.locator("#q").fill("101");
  await expect(page.locator("#call-result")).toContainText(
    "zwischen 0 und 100",
  );
  await page.locator("#pot").fill("-2");
  await expect(page.locator("#advice")).toContainText("Ungültiger");
  await expect(page.locator("#call-result")).toContainText("Noch keine");
  await page.locator("#pot").fill("0,30");
  await page.locator("#call").fill("0,20");
  await page.locator("#paid").fill("0");
  await page.locator("#stack").fill("10");
  await page.locator("#position").selectOption("early");
  await page.locator("#situation").selectOption("unopened");
  await expect(page.locator("#advice")).toContainText("insgesamt 0,60");
  await page.locator("#special").check();
  await expect(page.locator("#call-result")).toContainText("ausgesetzt");
});
test("worker failure visible, never blank", async ({ page }) => {
  await page.route("**/*worker*.js", (route) => route.abort());
  await hand(page);
  await flop(page);
  await expect(page.locator("#result")).toContainText(
    "Berechnung nicht verfügbar",
  );
  await expect(
    page.getByRole("button", { name: "Erneut versuchen" }),
  ).toBeVisible();
});
test("no horizontal overflow at 320, 430 and desktop; keyboard-sized viewport", async ({
  page,
}) => {
  await hand(page);
  await flop(page);
  await expect(page.locator("#result")).toContainText("Simulation fertig");
  for (const [width, height] of [
    [320, 650],
    [430, 480],
    [1280, 900],
  ]) {
    await page.setViewportSize({ width, height });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.locator("#pot").scrollIntoViewIfNeeded();
    await page.locator("#pot").click();
    await page.locator("#pot").fill("1,20");
    await expect(page.locator("#pot")).toBeInViewport();
  }
  await page.setViewportSize({ width: 430, height: 932 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/${test.info().project.name}-app.png`,
    fullPage: true,
  });
});
test("exact river, zero opponents and boot failure fallback", async ({
  page,
}) => {
  await hand(page);
  await flop(page);
  await choose(page, "Turn", "Bube", "Herz");
  await choose(page, "River", "Zehn", "Herz");
  await page.locator("#opponents").selectOption("1");
  await expect(page.locator("#result")).toContainText("Exakt im Modell");
  await expect(page.locator("#result")).toContainText("990");
  await page.locator("#opponents").selectOption("0");
  await expect(page.locator("#result")).toContainText("ohne Kartenvergleich");
  await page.route("**/*index*.js", (route) => route.abort());
  await page.reload();
  await expect(page.locator("#result")).toContainText(
    "konnte JavaScript nicht starten",
  );
});
