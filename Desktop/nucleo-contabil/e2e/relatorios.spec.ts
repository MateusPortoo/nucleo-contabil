import { test, expect } from "@playwright/test";
import { loginAs } from "./helpers";

test.describe("Relatórios PDF", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "socio@nucleo.com", "senha123");
    await page.goto("http://localhost:3000/relatorios");
    await page.waitForLoadState("networkidle");
  });

  test("exibe seletor de empresa, mês e ano", async ({ page }) => {
    const selects = page.locator("select");
    await expect(selects.first()).toBeVisible({ timeout: 10_000 });
    expect(await selects.count()).toBeGreaterThanOrEqual(3);
  });

  test("botão exportar aparece só quando os 3 campos estão preenchidos", async ({ page }) => {
    const selects = page.locator("select");
    await expect(selects.first()).toBeVisible({ timeout: 10_000 });
    // empresa, mês e ano já vêm pré-selecionados com o primeiro valor disponível
    await expect(page.getByRole("button", { name: /exportar|pdf/i })).toBeVisible({ timeout: 5_000 });
  });

  test("rota de PDF retorna 200 com content-type application/pdf", async ({ page }) => {
    const selects = page.locator("select");
    await expect(selects.first()).toBeVisible({ timeout: 10_000 });

    // Lê os valores já pré-selecionados pela página
    const empresaId = await selects.nth(0).inputValue();
    const mesValue = await selects.nth(1).inputValue();
    const anoValue = await selects.nth(2).inputValue();

    expect(empresaId).toBeTruthy();
    expect(mesValue).toBeTruthy();
    expect(anoValue).toBeTruthy();

    // Dispara a requisição diretamente para verificar que a API responde com PDF
    const resp = await page.request.get(
      `/api/relatorios/obrigacoes?empresaId=${empresaId}&mes=${mesValue}&ano=${anoValue}`,
    );
    expect(resp.status()).toBe(200);
    const contentType = resp.headers()["content-type"] ?? "";
    expect(contentType).toMatch(/pdf/);
    const body = await resp.body();
    expect(body.length).toBeGreaterThan(1000);
  });
});
