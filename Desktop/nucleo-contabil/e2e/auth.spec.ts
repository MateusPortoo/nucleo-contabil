import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Autenticação", () => {
  test("login com sócio redireciona para fora do /login", async ({ page }) => {
    await loginAs(page, "socio@nucleo.com", "senha123");
    // Painel está em /, não em /painel
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("login com cliente redireciona para /cliente", async ({ page }) => {
    await loginAs(page, "cliente@paoquente.com", "senha123");
    await expect(page).toHaveURL(/\/cliente/);
  });

  test("credenciais erradas exibe mensagem de erro", async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.locator('input[type="email"]').fill("nao@existe.com");
    await page.locator('input[type="password"]').fill("errada");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText(/inválid|incorret|não encontrad/i)).toBeVisible({ timeout: 5_000 });
  });

  test("rota protegida sem sessão redireciona para /login", async ({ page }) => {
    await page.goto("http://localhost:3000/empresas");
    await expect(page).toHaveURL(/\/login/, { timeout: 5_000 });
  });
});
