import { test, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

test.describe("Relatórios PDF", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("http://localhost:3000/login");
    await page.getByLabel(/e-mail/i).fill("socio@nucleo.com");
    await page.getByLabel(/senha/i).fill("senha123");
    await page.getByRole("button", { name: /entrar/i }).click();
    await page.waitForURL(/\/painel/);
    await page.goto("http://localhost:3000/relatorios");
  });

  test("exibe seletor de empresa, mês e ano", async ({ page }) => {
    await expect(page.getByLabel(/empresa/i)).toBeVisible();
    await expect(page.getByLabel(/m[eê]s/i)).toBeVisible();
    await expect(page.getByLabel(/ano/i)).toBeVisible();
  });

  test("botão exportar aparece só quando os 3 campos estão preenchidos", async ({ page }) => {
    // sem seleção: botão não existe ainda
    const botao = page.getByRole("button", { name: /exportar|pdf/i });

    // seleciona empresa (já vem pré-selecionada se existir)
    // garante que mês e ano estão selecionados
    await page.getByLabel(/m[eê]s/i).selectOption({ index: 1 });
    await page.getByLabel(/ano/i).selectOption({ index: 1 });

    await expect(botao).toBeVisible();
  });

  test("download do PDF retorna arquivo válido", async ({ page }) => {
    // seleciona primeira opção de cada campo
    const empresaSelect = page.getByLabel(/empresa/i);
    const mesSelect = page.getByLabel(/m[eê]s/i);
    const anoSelect = page.getByLabel(/ano/i);

    await mesSelect.selectOption({ index: 1 });
    await anoSelect.selectOption({ index: 1 });

    // aguarda o botão aparecer
    const botao = page.getByRole("button", { name: /exportar|pdf/i });
    await expect(botao).toBeVisible();

    // intercepta o download
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      botao.click(),
    ]);

    const suggestedName = download.suggestedFilename();
    expect(suggestedName).toMatch(/\.pdf$/i);

    // verifica que o arquivo não está vazio
    const savePath = path.join("e2e", "downloads", suggestedName);
    await download.saveAs(savePath);
    const stat = fs.statSync(savePath);
    expect(stat.size).toBeGreaterThan(1000); // PDF mínimo ~1kb
    fs.unlinkSync(savePath);
  });
});
