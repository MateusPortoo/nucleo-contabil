import type { Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("http://localhost:3000/login");
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.getByRole("button", { name: /entrar/i }).click();
  // router.push("/") é client-side — espera qualquer URL fora de /login
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
}
