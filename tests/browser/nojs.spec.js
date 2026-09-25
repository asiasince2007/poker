import {test,expect} from '@playwright/test';
test.use({javaScriptEnabled:false});
test('disabled JavaScript renders noscript and readable boot fallback',async({page})=>{
  await page.goto('./');
  await expect(page.locator('noscript p')).toBeVisible();
  await expect(page.locator('noscript p')).toHaveText(/JavaScript ist ausgeschaltet/);
  await expect(page.locator('#result')).toContainText('konnte JavaScript nicht starten');
  await expect(page.locator('#new-hand')).toBeDisabled();
});
