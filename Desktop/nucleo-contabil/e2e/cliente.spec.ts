import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Portal do cliente", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "cliente@paoquente.com", "senha123");
    await page.waitForURL(/\/cliente/, { timeout: 10_000 });
  });

  test("exibe KPIs da empresa do cliente", async ({ page }) => {
    await expect(page.getByText(/obriga|atrasad|entregue/i).first()).toBeVisible();
  });

  test("exibe botão de relatório PDF", async ({ page }) => {
    await expect(page.getByRole("button", { name: /relat|pdf/i })).toBeVisible();
  });

  test("cliente não acessa /painel", async ({ page }) => {
    await page.goto("http://localhost:3000/painel");
    await expect(page).not.toHaveURL(/\/painel/, { timeout: 5_000 });
  });

  test("cliente não acessa /empresas", async ({ page }) => {
    await page.goto("http://localhost:3000/empresas");
    await expect(page).not.toHaveURL(/\/empresas/, { timeout: 5_000 });
  });
});
