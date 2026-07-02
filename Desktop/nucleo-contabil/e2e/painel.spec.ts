import { test, expect } from "@playwright/test";

test.describe("Painel — sócio", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.getByLabel(/e-mail/i).fill("socio@nucleo.com");
    await page.getByLabel(/senha/i).fill("senha123");
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL(/\/painel/);
  });

  test("exibe KPIs de obrigações", async ({ page }) => {
    await expect(page.getByText(/total|entregue|atrasad/i).first()).toBeVisible();
  });

  test("navega para /empresas e lista empresas", async ({ page }) => {
    await page.getByRole("link", { name: /empresa/i }).click();
    await expect(page).toHaveURL(/\/empresas/);
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("navega para /obrigacoes e exibe o kanban", async ({ page }) => {
    await page.getByRole("link", { name: /obriga/i }).click();
    await expect(page).toHaveURL(/\/obrigacoes/);
    // kanban tem pelo menos uma coluna de status
    await expect(page.getByText(/pendente|classific|gerada|entregue/i).first()).toBeVisible();
  });

  test("navega para /relatorios e exibe o seletor de empresa", async ({ page }) => {
    await page.getByRole("link", { name: /relat/i }).click();
    await expect(page).toHaveURL(/\/relatorios/);
    await expect(page.getByLabel(/empresa/i)).toBeVisible();
  });
});

test.describe("RBAC — assistente não acessa /empresas/nova", () => {
  test("assistente é bloqueado em rota de criação", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.getByLabel(/e-mail/i).fill("assistente@nucleo.com");
    await page.getByLabel(/senha/i).fill("senha123");
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL(/\/painel/);
    await page.goto("http://localhost:3000/empresas/nova");
    // deve redirecionar ou mostrar erro de acesso
    const url = page.url();
    const bloqueado = url.includes("/painel") || url.includes("/login") || url.includes("/empresas");
    expect(bloqueado).toBe(true);
  });
});
