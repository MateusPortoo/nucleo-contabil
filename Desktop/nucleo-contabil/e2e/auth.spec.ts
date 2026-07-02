import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Autenticação", () => {
  test("login com sócio redireciona para /painel", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/e-mail/i).fill("socio@nucleo.com");
    await page.getByLabel(/senha/i).fill("senha123");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/painel/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /painel/i })).toBeVisible();
  });

  test("login com cliente redireciona para /cliente", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/e-mail/i).fill("cliente@paoquente.com");
    await page.getByLabel(/senha/i).fill("senha123");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page).toHaveURL(/\/cliente/, { timeout: 10_000 });
  });

  test("credenciais erradas exibe mensagem de erro", async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.getByLabel(/e-mail/i).fill("nao@existe.com");
    await page.getByLabel(/senha/i).fill("errada");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText(/inválid|incorret|não encontrad/i)).toBeVisible({ timeout: 5_000 });
  });

  test("rota protegida sem sessão redireciona para /login", async ({ page }) => {
    await page.goto(`${BASE}/painel`);
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });
});
