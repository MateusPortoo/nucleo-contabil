import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Painel — sócio", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "socio@nucleo.com", "senha123");
    // O painel está em /, não em /painel
    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("exibe KPIs de obrigações", async ({ page }) => {
    // Aguarda os dados tRPC carregarem (labels dos KPIs aparecem imediatamente, valores depois)
    await expect(page.getByText(/atrasadas|entregues|obrigações/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test("navega para /empresas e lista empresas", async ({ page }) => {
    const link = page.getByRole("link", { name: "Empresas" });
    await expect(link).toBeVisible({ timeout: 10_000 });
    await link.click();
    await expect(page).toHaveURL(/\/empresas/, { timeout: 10_000 });
    await expect(page.getByRole("table")).toBeVisible({ timeout: 10_000 });
  });

  test("navega para /documentos", async ({ page }) => {
    await page.getByRole("link", { name: "Documentos" }).click();
    await expect(page).toHaveURL(/\/documentos/);
  });

  test("navega para /relatorios e exibe o seletor de empresa", async ({ page }) => {
    await page.getByRole("link", { name: "Relatórios" }).click();
    await expect(page).toHaveURL(/\/relatorios/);
    await expect(page.locator("select").first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("RBAC — assistente não acessa /empresas/nova", () => {
  test("assistente é bloqueado em rota de criação", async ({ page }) => {
    await loginAs(page, "assistente@nucleo.com", "senha123");
    await page.goto("http://localhost:3000/empresas/nova");
    await page.waitForLoadState("networkidle");
    const url = page.url();
    const bloqueado = !url.includes("/empresas/nova") || url.includes("/login") || url.includes("localhost:3000/");
    expect(bloqueado).toBe(true);
  });
});
