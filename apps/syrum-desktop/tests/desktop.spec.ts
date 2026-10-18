import { test, expect, _electron as electron } from "@playwright/test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "../../..");

test("desktop window runs the demo journey offline and saves exports", async () => {
  const saveDir = mkdtempSync(join(tmpdir(), "syrum-desktop-"));
  const app = await electron.launch({
    args: [ROOT],
    env: { ...process.env, SYRUM_SAVE_DIR: saveDir },
  });
  const page = await app.firstWindow();
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  expect(page.url()).toBe("app://syrum/");
  expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
  expect(
    await page.evaluate(() =>
      fetch("https://example.com").then(
        () => "reached",
        () => "blocked",
      ),
    ),
  ).toBe("blocked");

  await page
    .getByRole("button", { name: "Try the original synth demo" })
    .click();
  if (
    await page
      .getByRole("button", { name: "import controls page 2" })
      .isVisible()
  )
    await page.getByRole("button", { name: "import controls page 2" }).click();
  await page.getByRole("button", { name: "Analyze selection" }).click();
  await expect(page.locator("#pitch-readout")).toContainText("55.");
  await page.getByRole("button", { name: "Set up frames" }).click();
  await page.getByRole("button", { name: "Generate wavetable" }).click();
  await expect(page.locator("#table-meta")).toContainText("64 frames");

  await page.getByRole("button", { name: "Freeze, scrub & stretch" }).click();
  await page.getByRole("button", { name: "▶ Hold", exact: true }).click();
  await expect(page.locator("#status")).toContainText("Holding a periodic");
  await page.locator("#seconds").fill("0.1");
  await page.getByRole("button", { name: "↗ Scan", exact: true }).click();
  await expect(page.locator("#status")).toContainText("Scan complete");
  await page.getByRole("button", { name: "■ Stop" }).last().click();

  await page.getByRole("button", { name: "Prepare export" }).click();
  await page.getByRole("button", { name: "Download WAV" }).click();
  const wav = join(saveDir, "Syrum_64x2048.wav");
  await expect.poll(() => existsSync(wav)).toBe(true);
  await expect(page.locator("#status")).toContainText("unverified");
  // Same bytes as the checked-in demo export from the browser build.
  expect(
    readFileSync(wav).equals(
      readFileSync(join(ROOT, "fixtures/syrum-demo/Syrum_64x2048.wav")),
    ),
  ).toBe(true);

  await page
    .getByRole("button", { name: "Playback notes", exact: false })
    .click();
  const notes = join(saveDir, "Syrum playback notes.txt");
  await expect.poll(() => existsSync(notes)).toBe(true);
  expect(readFileSync(notes, "utf8")).toContain(
    "Serum compatibility: UNVERIFIED",
  );

  expect(errors).toEqual([]);
  const child = app.process();
  await app.close();
  expect(child.exitCode !== null || child.signalCode !== null).toBe(true);
});
