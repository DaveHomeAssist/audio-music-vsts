import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
async function generate(page: import("@playwright/test").Page): Promise<void> {
  await page.getByRole("tab", { name: "Import" }).click();
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
}
test("complete demo journey, audio, export, stale results and theme persistence", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await generate(page);
  await page.getByRole("button", { name: "A Source", exact: true }).click();
  await expect(page.locator("#status")).toContainText("Playing A");
  await page
    .getByRole("button", { name: "B Resynthesis", exact: true })
    .click();
  await expect(page.locator("#status")).toContainText("Playing B");
  await page.getByRole("button", { name: "Freeze, scrub & stretch" }).click();
  await page.getByRole("button", { name: "▶ Hold", exact: true }).click();
  await expect(page.locator("#status")).toContainText("Holding a periodic");
  await page.locator("#position").fill("0.7");
  await page.locator("#position").dispatchEvent("input");
  await expect(page.locator("#position-readout")).toHaveText("70.0%");
  await page.locator("#seconds").fill("0.1");
  await page.getByRole("button", { name: "↗ Scan", exact: true }).click();
  await expect(page.locator("#status")).toContainText("Scan complete");
  await expect(page.locator("#position")).toHaveValue("1");
  await page.getByRole("button", { name: "Prepare export" }).click();
  const d = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download WAV" }).click();
  const download = await d;
  expect(download.suggestedFilename()).toBe("Syrum_64x2048.wav");
  const path = await download.path();
  expect(
    readFileSync(path!).includes(Buffer.from("<!>2048 10000000")),
  ).toBeTruthy();
  await expect(page.locator("#status")).toContainText("unverified");
  const n = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Playback notes", exact: false })
    .click();
  const note = await n;
  expect(readFileSync((await note.path())!, "utf8")).toContain(
    "Serum compatibility: UNVERIFIED",
  );
  await page.getByRole("tab", { name: "Import" }).click();
  await page.locator("#trim-start").fill("0.2");
  await page.locator("#trim-start").blur();
  await page.getByRole("tab", { name: "Export" }).click();
  await expect(page.locator("#export-wav")).toBeDisabled();
  await page.getByRole("button", { name: "Switch to dark theme" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  expect(errors).toEqual([]);
});
test("real lab input, invalid input and keyboard navigation", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("#file")
    .setInputFiles(resolve("experiments/serum-bass-lab/reference.wav"));
  await expect(page.locator("#duration-label")).toContainText("0.440");
  if (
    await page
      .getByRole("button", { name: "import controls page 2" })
      .isVisible()
  )
    await page.getByRole("button", { name: "import controls page 2" }).click();
  await page.getByRole("button", { name: "Analyze selection" }).click();
  await expect(page.locator("#pitch-readout")).not.toContainText("—");
  await page.locator("#root").fill("37.17");
  await page.locator("#root").blur();
  await page.getByRole("button", { name: "Set up frames" }).click();
  await page.locator("#frames").fill("256");
  await page.getByRole("button", { name: "Generate wavetable" }).click();
  await expect(page.locator("#table-meta")).toContainText("256 frames");
  await page.getByRole("tab", { name: "Import" }).click();
  await page.locator("#file").setInputFiles({
    name: "broken.wav",
    mimeType: "audio/wav",
    buffer: Buffer.from("not audio"),
  });
  await expect(page.locator("#status")).toContainText("Choose a PCM");
  await page.getByRole("tab", { name: "Import" }).focus();
  await page.keyboard.press("End");
  await expect(page.getByRole("tab", { name: "Export" })).toBeFocused();
  await expect(page.getByRole("tab", { name: "Export" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});
for (const viewport of [
  { width: 1440, height: 900 },
  { width: 375, height: 812 },
  { width: 844, height: 390 },
  { width: 320, height: 256 },
  { width: 3840, height: 1080 },
])
  test(`viewport ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await generate(page);
    for (const theme of ["light", "dark"]) {
      if (theme === "dark")
        await page
          .getByRole("button", { name: "Switch to dark theme" })
          .click();
      for (const name of [
        "Import",
        "Analyze",
        "Generate",
        "Compare",
        "Explore",
        "Export",
      ]) {
        await page.getByRole("tab", { name, exact: false }).click();
        const pager = page.locator(
          `#panel-${name.toLowerCase()} .compact-pager`,
        );
        const pages = (await pager.isVisible()) ? 2 : 1;
        for (let i = 0; i < pages; i++) {
          if (pages === 2) await pager.locator("button").nth(i).click();
          const overflow = await page.evaluate(() => ({
            width: document.documentElement.scrollWidth,
            height: document.documentElement.scrollHeight,
            w: innerWidth,
            h: innerHeight,
            controls: [
              ...document.querySelectorAll<HTMLElement>(
                "button,input:not([type=file]),select",
              ),
            ]
              .filter((e) => e.checkVisibility())
              .filter((e) => {
                const r = e.getBoundingClientRect();
                return (
                  r.x < -0.5 ||
                  r.y < -0.5 ||
                  r.right > innerWidth + 0.5 ||
                  r.bottom > innerHeight + 0.5
                );
              })
              .map((e) => e.id || e.textContent),
          }));
          expect(overflow.width, JSON.stringify(overflow)).toBeLessThanOrEqual(
            overflow.w,
          );
          expect(overflow.height, JSON.stringify(overflow)).toBeLessThanOrEqual(
            overflow.h,
          );
          expect(overflow.controls, `${theme} ${name} page ${i}`).toEqual([]);
          const blocked = await page.evaluate(() =>
            [
              ...document.querySelectorAll<HTMLElement>(
                "button,input:not([type=file]),select",
              ),
            ]
              .filter((e) => e.checkVisibility())
              .filter((e) => {
                const r = e.getBoundingClientRect();
                const hit = document.elementFromPoint(
                  r.x + r.width / 2,
                  r.y + r.height / 2,
                );
                return !hit || !e.contains(hit);
              })
              .map((e) => e.id || e.textContent),
          );
          expect(
            blocked,
            `${theme} ${name} page ${i} obstructed controls`,
          ).toEqual([]);
          if (name === "Compare" || name === "Import")
            await page.screenshot({
              path: `apps/serum-wave-gen-vxx/test-results/${viewport.width}-${viewport.height}-${theme}-${name}-${i}.png`,
            });
        }
      }
    }
  });
test("AudioWorklet produces signal, stop silences it, cancel recovers", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const Native = window.AudioContext;
    (window as unknown as { AudioContext: typeof AudioContext }).AudioContext =
      class extends Native {
        override createGain(): GainNode {
          const gain = super.createGain();
          const analyser = super.createAnalyser();
          analyser.fftSize = 4096;
          gain.connect(analyser);
          (window as unknown as { testAnalyser: AnalyserNode }).testAnalyser =
            analyser;
          return gain;
        }
      };
  });
  await page.goto("/");
  await generate(page);
  await page.getByRole("button", { name: "Freeze, scrub & stretch" }).click();
  await page.locator("#hold").click();
  await page.waitForFunction(() => {
    const analyser = (window as unknown as { testAnalyser?: AnalyserNode })
      .testAnalyser;
    if (!analyser) return false;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    return data.some((x) => Math.abs(x) > 0.03);
  });
  await page.locator("#stop-explore").click();
  await page.waitForFunction(() => {
    const analyser = (window as unknown as { testAnalyser: AnalyserNode })
      .testAnalyser;
    const data = new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(data);
    return data.every((x) => Math.abs(x) < 0.0001);
  });
  await page.getByRole("tab", { name: "Generate" }).click();
  await page.locator("#frames").fill("256");
  await page.locator("#generate").click();
  await page.locator("#cancel").click();
  await expect(page.locator("#status")).toContainText("cancelled");
  await page.locator("#frames").fill("8");
  await page.locator("#generate").click();
  await expect(page.locator("#table-meta")).toContainText("8 frames");
});
test("accessible empty and populated stages in both themes", async ({
  page,
}) => {
  await page.goto("/");
  await page.addScriptTag({
    path: resolve("node_modules/axe-core/axe.min.js"),
  });
  for (const populated of [false, true]) {
    if (populated) await generate(page);
    for (const theme of ["light", "dark"]) {
      await page.evaluate(
        (t) => (document.documentElement.dataset.theme = t),
        theme,
      );
      for (const name of [
        "Import",
        "Analyze",
        "Generate",
        "Compare",
        "Explore",
        "Export",
      ]) {
        await page.getByRole("tab", { name }).click();
        const issues = await page.evaluate(async () => {
          const result = await (
            window as unknown as {
              axe: {
                run: (
                  context: Document,
                  options: object,
                ) => Promise<{
                  violations: { id: string; nodes: { target: string[] }[] }[];
                }>;
              };
            }
          ).axe.run(document, {
            runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
          });
          return result.violations.map((v) => ({
            id: v.id,
            nodes: v.nodes.map((n) => n.target),
          }));
        });
        expect(
          issues,
          `${populated ? "populated" : "empty"} ${theme} ${name}`,
        ).toEqual([]);
      }
    }
  }
});
