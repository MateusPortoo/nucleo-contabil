import { test, expect } from "@playwright/test";

test.describe("Portal do cliente", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.getByLabel(/e-mail/i).fill("cliente@paoquente.com");
    await page.getByLabel(/senha/i).fill("senha123");
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL(/\/cliente/);
  });

  test("exibe KPIs da empresa do cliente", async ({ page }) => {
    await expect(page.getByText(/obriga|atrasad|entregue/i).first()).toBeVisible();
  });

  test("exibe botão de relatório PDF", async ({ page }) => {
    await expect(page.getByRole("button", { name: /relat|pdf/i })).toBeVisible();
  });

  test("cliente não acessa /painel", async ({ page }) => {
    await page.goto("http://localhost:3000/painel");
    await expect(page).toHaveURL(/\/cliente/, { timeout: 5_000 });
  });

  test("cliente não acessa /empresas", async ({ page }) => {
    await page.goto("http://localhost:3000/empresas");
    // deve redirecionar de volta para /cliente ou /login
    await expect(page).not.toHaveURL(/\/empresas/);
  });
});
