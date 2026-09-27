import { mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function checkWorkbench({ page, check, ready, writeSource, sourceText, run, root, screenshotSuffix = '' }) {
  const reports = path.join(root, 'reports');
  await mkdir(reports, { recursive: true });
  const editor = () => page.getByRole('textbox', { name: 'Julia source code' });
  const codeTab = () => page.locator('button[data-show-pane="code"]');
  const resultTab = () => page.locator('button[data-show-pane="results"]');
  const fixture = 'using LinearAlgebra\n\n# Measure the length of a vector.\nlabel = "Magnitude"\nv = [3.0, 4.0]\nnorm(v)';
  const screenshot = name => page.screenshot({ path: path.join(reports, `workbench${screenshotSuffix}-${name}.png`), fullPage: true });

  const verifyTheme = async expected => {
    const appearance = await page.evaluate(() => {
      const source = document.querySelector('#source');
      const content = source.querySelector('.cm-content');
      const style = getComputedStyle(source);
      const colors = Object.fromEntries(['.cm-content', '.jl-keyword', '.jl-comment', '.jl-string', '.jl-literal'].map(selector => {
        const element = source.querySelector(selector);
        return [selector, element ? getComputedStyle(element).color : null];
      }));
      return {
        theme: document.documentElement.dataset.theme,
        scheme: getComputedStyle(document.documentElement).colorScheme,
        background: style.backgroundColor,
        colors,
        meta: document.querySelector('meta[name="theme-color"]').content,
        label: document.querySelector('#theme-toggle').getAttribute('aria-label'),
        text: document.querySelector('#theme-label').textContent,
        editorPresent: !!content,
      };
    });
    const next = expected === 'dark' ? 'light' : 'dark';
    if (appearance.theme !== expected || appearance.scheme !== expected) throw new Error(`Wrong theme: ${JSON.stringify(appearance)}`);
    if (appearance.meta !== (expected === 'dark' ? '#1d2027' : '#f0f2f5')) throw new Error('Browser theme color did not update');
    if (appearance.label !== `Switch to ${next} mode` || appearance.text !== `${next === 'light' ? 'Light' : 'Dark'} mode`) throw new Error('Theme button does not describe its action');
    const luminance = color => {
      const values = color?.match(/[\d.]+/g)?.slice(0, 3).map(Number);
      if (!values || values.length !== 3) throw new Error(`Missing or unsupported editor color: ${color}`);
      const linear = values.map(value => {
        const channel = value / 255;
        return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    const background = luminance(appearance.background);
    for (const [selector, color] of Object.entries(appearance.colors)) {
      const foreground = luminance(color);
      const ratio = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
      if (ratio < 4.5) throw new Error(`${expected} ${selector} contrast is only ${ratio.toFixed(2)}:1`);
    }
  };

  const verifyViewport = async tabs => {
    const state = await page.evaluate(showTabs => {
      const visible = selector => {
        const element = document.querySelector(selector);
        const box = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden'
          && box.width > 0 && box.height > 0 && box.left >= -1 && box.top >= -1
          && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1;
      };
      return {
        width: innerWidth, height: innerHeight,
        pageWidth: document.documentElement.scrollWidth,
        bodyWidth: document.body.scrollWidth,
        pageHeight: document.documentElement.scrollHeight,
        scrollY,
        runVisible: visible('#run'),
        tabsVisible: !showTabs || (visible('button[data-show-pane="code"]') && visible('button[data-show-pane="results"]')),
      };
    }, tabs);
    if (state.pageWidth > state.width + 1 || state.bodyWidth > state.width + 1) throw new Error(`Horizontal overflow: ${JSON.stringify(state)}`);
    if (state.pageHeight > state.height + 1 || state.scrollY !== 0) throw new Error(`The page scrolls instead of its panes: ${JSON.stringify(state)}`);
    if (!state.runVisible || !state.tabsVisible) throw new Error(`Primary controls outside the viewport: ${JSON.stringify(state)}`);
  };

  await check('dark and light workbench themes stay legible and preserve editor undo', async () => {
    if (await page.locator('html').getAttribute('data-theme') !== 'dark') throw new Error('A new profile did not default to dark');
    await page.setViewportSize({ width: 1280, height: 800 });
    await run(fixture, '5');
    if (!(await page.locator('#code-pane').isVisible()) || !(await page.locator('#results-pane').isVisible())) throw new Error('Landscape should show both panes');
    await verifyTheme('dark');
    await verifyViewport(false);
    await screenshot('dark-landscape');
    const originalEditor = await editor().elementHandle();
    await page.waitForTimeout(600);
    await editor().press('Control+End');
    await page.keyboard.insertText(' + 1');
    if (await sourceText() !== fixture + ' + 1') throw new Error('Pre-toggle typing failed');
    await page.getByRole('button', { name: 'Switch to light mode', exact: true }).click();
    await verifyTheme('light');
    if (!(await originalEditor.evaluate(node => node === document.querySelector('#source .cm-content')))) throw new Error('Theme toggle recreated the editor');
    await editor().press('Control+z');
    if (await sourceText() !== fixture) throw new Error('Theme toggle lost editor undo history');
    await screenshot('light-landscape');
    await originalEditor.dispose();
  });

  await check('saved light theme and Julia draft survive an offline reload', async () => {
    await page.waitForFunction(expected => JSON.parse(localStorage.getItem('basis.julia-draft.v1'))?.source === expected, fixture);
    if (await page.evaluate(() => localStorage.getItem('basis.theme.v1')) !== 'light') throw new Error('Light theme was not saved');
    await page.reload();
    await ready();
    if (await sourceText() !== fixture) throw new Error('Offline reload lost the editor draft');
    await verifyTheme('light');
    await page.getByRole('button', { name: 'Switch to dark mode', exact: true }).click();
    await verifyTheme('dark');
  });

  await check('responsive tabs, execution and editor scrolling fit tablet and short mobile views', async () => {
    for (const viewport of [{ width: 768, height: 1024, shot: 'portrait' }, { width: 390, height: 844, shot: 'mobile' }]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await codeTab().click();
      if (!(await page.locator('#code-pane').isVisible()) || await page.locator('#results-pane').isVisible()) throw new Error(`Code tab failed at ${viewport.width}px`);
      if (await codeTab().getAttribute('aria-pressed') !== 'true') throw new Error('Code tab is not marked active');
      await run(fixture, '5');
      if (await page.locator('body').getAttribute('data-pane') !== 'results' || !(await page.locator('#results-pane').isVisible()) || await page.locator('#code-pane').isVisible()) throw new Error(`Run did not reveal results at ${viewport.width}px`);
      if (await resultTab().getAttribute('aria-pressed') !== 'true') throw new Error('Results tab is not marked active');
      await verifyViewport(true);
      await codeTab().click();
      if (await sourceText() !== fixture) throw new Error('Changing panes altered the code');
      await verifyViewport(true);
      await screenshot(viewport.shot);
    }
    await page.setViewportSize({ width: 390, height: 400 });
    await codeTab().click();
    const longSource = Array.from({ length: 100 }, (_, index) => `# Scrollable source line ${index + 1}`).join('\n');
    await writeSource(longSource);
    await editor().press('Control+Home');
    await page.locator('#source .cm-scroller').hover();
    await page.mouse.wheel(0, 800);
    await page.waitForFunction(() => document.querySelector('#source .cm-scroller').scrollTop > 0);
    await verifyViewport(true);
    await resultTab().click();
    await verifyViewport(true);
    await codeTab().click();
    await editor().press('Control+End');
    if (!(await editor().innerText()).includes('# Scrollable source line 100')) throw new Error('Code pane lost the end of the long draft');
    await verifyViewport(true);
    await writeSource(fixture);
  });

  await check('settings remain accessible in a short viewport and close with Escape', async () => {
    const settings = page.locator('.app-info');
    await settings.locator('summary').click();
    if (!(await settings.evaluate(node => node.open))) throw new Error('Settings did not open');
    await page.locator('#timeout').selectOption('30000');
    if (await page.locator('#timeout').inputValue() !== '30000') throw new Error('Time limit selection failed');
    await page.locator('#timeout').selectOption('60000');
    await page.keyboard.press('Escape');
    if (await settings.evaluate(node => node.open)) throw new Error('Escape did not close settings');
    await verifyViewport(true);
    await page.setViewportSize({ width: 1024, height: 768 });
  });
}
