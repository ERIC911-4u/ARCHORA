// Browser end-to-end checks (Playwright + Chromium). Run with the dev server up:
//   cd archora && python3 -m http.server 8765 &   then   node tests/browser/e2e.cjs
// Env: BASE (default http://localhost:8765/index.html), OUT (screenshots/downloads, default os.tmpdir()/archora-e2e).
const { chromium } = require('playwright'); const fs = require('fs'); const os = require('os'); const path = require('path');
const BASE = process.env.BASE || 'http://localhost:8765/index.html'; const OUT = process.env.OUT || path.join(os.tmpdir(), 'archora-e2e'); fs.mkdirSync(OUT, { recursive: true });
const results = []; const ok = (name, cond, extra = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('introSeen', '1'); } catch (e) { /* ignore */ } });
  const page = await ctx.newPage(); const errors = []; let dialogs = 0;
  page.on('dialog', (d) => { if (d.type() === 'beforeunload') { d.accept(); return; } dialogs += 1; d.dismiss(); }); // beforeunload = the app's unsaved-changes guard
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/ERR_FAILED|ERR_TUNNEL|storage\] read failed/.test(m.text())) errors.push(m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await page.goto(`${BASE}#/studio`); await page.waitForTimeout(1500);
  const S = (fn, arg) => page.evaluate(async ([f, a]) => { const m = await import('/js/state.js'); const act = await import('/js/actions.js'); return new Function('m', 'a', 'act', `return (${f})(m, a, act)`)(m, a, act); }, [fn.toString(), arg]);
  const geom = () => S((m) => ({ walls: m.getState().walls.length, items: m.getState().items.length, ops: m.getState().walls.flatMap((w) => w.openings).length }));

  /* A — house creation: exact typed walls, loop closing, room detection, openings */
  await S((m) => { m.resetState('blank'); m.setUi({ units: 'mm', viewMode: '2d', snap: 10 }); });
  await page.keyboard.press('f'); await page.waitForTimeout(200);
  await page.click('button.ax-tool[title^="Draw walls"]');
  const box = await page.locator('.plan2d__svg').boundingBox(); const z = parseInt(await page.locator('.ax-float__zoom').innerText(), 10) / 100;
  const px = (mm) => (mm / 10) * z; const A = { x: Math.round(box.x + 400), y: Math.round(box.y + 260) };
  const P1 = { x: A.x + px(4500), y: A.y }; const P2 = { x: P1.x, y: A.y + px(3000) }; const P3 = { x: A.x, y: P2.y };
  await page.mouse.move(A.x, A.y); await page.mouse.click(A.x, A.y);
  for (const [to, len] of [[{ x: A.x + 150, y: A.y }, '4500'], [{ x: P1.x, y: P1.y + 150 }, '3000'], [{ x: P2.x - 150, y: P2.y }, '4500']]) { await page.mouse.move(to.x, to.y); await page.keyboard.type(len); await page.keyboard.press('Enter'); await page.waitForTimeout(60); }
  await page.mouse.move(A.x, A.y); await page.waitForTimeout(60); await page.mouse.click(A.x, A.y); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  const w = await S((m) => m.getState().walls.map((q) => ({ l: Math.round(Math.hypot(q.x2 - q.x1, q.z2 - q.z1) * 10), dx: q.x2 - q.x1, dz: q.z2 - q.z1 })));
  ok('typed walls are exact: 4500 / 3000 / 4500 / 3000 mm and axis-aligned', w.length === 4 && [4500, 3000, 4500, 3000].every((v, i) => w[i].l === v) && w.every((q) => Math.abs(q.dx) < 0.01 || Math.abs(q.dz) < 0.01), JSON.stringify(w.map((q) => q.l)));
  const labels = await page.locator('.plan2d__label--room').evaluateAll((n) => n.map((x) => x.textContent));
  ok('closed loop is detected as one room with the true clear area (4350 × 2850 mm = 12.40 m²)', labels.length === 1 && /12\.40 m²/.test(labels[0]), JSON.stringify(labels));
  await page.click('button.ax-tool[title^="Place a door"]'); await page.mouse.move(A.x + px(1500), A.y); await page.mouse.click(A.x + px(1500), A.y); await page.keyboard.press('Escape');
  await page.click('button.ax-tool[title^="Place a window"]'); await page.mouse.move(A.x + px(2250), P3.y); await page.mouse.click(A.x + px(2250), P3.y); await page.keyboard.press('Escape');
  const ops = await S((m) => m.getState().walls.flatMap((q) => q.openings.map((o) => o.type)));
  ok('door and window are stored on the walls', ops.includes('door') && ops.includes('window'), JSON.stringify(ops));

  /* B — interior design: search, place, rotate */
  await page.click('button.ax-tool[title^="Seating"]'); await page.fill('input[aria-label="Search assets"]', 'sofa'); await page.waitForTimeout(300);
  ok('asset search "sofa" finds assets', (await page.locator('.ws-lib__item').count()) >= 1);
  await page.locator('.ws-lib__item').first().click(); await page.mouse.move(A.x + px(2250), A.y + px(1500)); await page.mouse.click(A.x + px(2250), A.y + px(1500));
  ok('sofa placed', (await S((m) => m.getState().items.length)) === 1);
  await page.keyboard.press('r'); ok('R rotates the selected item 90°', (await S((m) => m.getState().items[0].rot)) === 90);

  /* C + D — 3D view and 2D↔3D sync through the shared state */
  await page.locator('.ws-seg__btn', { hasText: '3D' }).click(); await page.waitForTimeout(3500);
  ok('3D view shows a canvas', await page.evaluate(() => { const c = document.querySelector('.ax-canvas--scene canvas'); return !!c && c.width > 300; }));
  const cap = () => page.evaluate(async () => (await import('/js/scene.js')).getStudioScene().capturePng({ longEdge: 400 }));
  const before = await cap(); await S((m, a, act) => act.setFreeWallLength(m.getState().walls[0].id, 700)); await page.waitForTimeout(400); const after = await cap();
  ok('3D capture returns a PNG', !!before && before.startsWith('data:image/png') && before.length > 3000);
  ok('changing a wall length in the shared state changes the 3D render', before !== after); await S((m) => m.undo());
  await page.screenshot({ path: path.join(OUT, '3d.png') });

  /* E — project management */
  await page.locator('.ws-seg__btn', { hasText: '2D' }).click(); const snap0 = await geom();
  ok('before saving: status says Unsaved / Not saved', /Unsaved|Not saved/.test(await page.locator('.ax-save').innerText()));
  await page.click('.ax-save-btn'); await page.waitForSelector('#save-name'); await page.fill('#save-name', 'Test House'); await page.click('.modal .btn--primary'); await page.waitForTimeout(300);
  ok('Save dialog saves; status shows Saved; name in top bar', (await page.locator('.ax-save').innerText()) === 'Saved' && (await page.locator('.ax-name').inputValue()) === 'Test House');
  await S((m, a, act) => act.addFreeWall(0, 0, 0, 0, -200, { thickness: 15 })); ok('an edit marks Unsaved changes', /Unsaved/.test(await page.locator('.ax-save').innerText()));
  await page.keyboard.press('Control+s'); await page.waitForTimeout(300); ok('Ctrl+S quick-saves without a dialog', (await page.locator('#save-name').count()) === 0 && (await page.locator('.ax-save').innerText()) === 'Saved');
  await S((m) => m.undo()); await page.keyboard.press('Control+s'); await page.waitForTimeout(200);
  await page.goto(`${BASE}#/my-designs`); await page.reload(); await page.waitForTimeout(1200);
  ok('My Designs lists the project', /Test House/.test(await page.locator('#app-main').innerText()));
  await page.locator('.design-card', { hasText: 'Test House' }).first().getByText('Duplicate').click(); await page.waitForTimeout(300); ok('Duplicate makes a second card', (await page.locator('.design-card').count()) === 2);
  await page.locator('.design-card', { hasText: 'Test House' }).first().getByText('Open in Studio').click(); await page.waitForTimeout(1500);
  ok('reopened project has identical walls / openings / furniture', JSON.stringify(await geom()) === JSON.stringify(snap0), JSON.stringify(snap0));
  await page.click('.ax-menubtn:has-text("File")'); const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.ws-menu__item:has-text("Export project")')]);
  const jsonPath = path.join(OUT, 'project.json'); await dl.saveAs(jsonPath); const exported = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  ok('JSON export: ARCHORA envelope + schema v3 design', exported.app === 'ARCHORA' && exported.design.version === 3 && exported.design.walls.length === 4);
  await S((m, a, act) => act.addFreeWall(0, 0, 0, 0, -200, { thickness: 15 })); await page.setInputFiles('input[aria-label="Import design JSON file"]', jsonPath); await page.waitForTimeout(300);
  if (await page.locator('.modal .btn--primary').count()) await page.locator('.modal .btn--primary').click(); await page.waitForTimeout(400);
  ok('re-importing the export restores the project', JSON.stringify(await geom()) === JSON.stringify(snap0));

  /* F — error handling */
  const imp = async (body) => { fs.writeFileSync(path.join(OUT, 'in.json'), body); await page.setInputFiles('input[aria-label="Import design JSON file"]', path.join(OUT, 'in.json')); await page.waitForTimeout(300); if (await page.locator('.modal .btn--primary').count()) await page.locator('.modal .btn--primary').click(); await page.waitForTimeout(300); };
  await imp('{{{ nope'); ok('invalid JSON is rejected and the project is untouched', (await geom()).walls === 4);
  await imp(JSON.stringify({ hello: 'world' })); ok('wrong-shape JSON is rejected and the project is untouched', (await geom()).walls === 4);
  await imp(JSON.stringify({ app: 'ARCHORA', version: 2, design: { version: 3, name: '<img src=x onerror=alert(1)>', style: '<script>alert(2)</script>', walls: [{ id: '"><svg onload=alert(3)>', x1: 0, z1: 0, x2: 300, z2: 0, thickness: 15, level: 0, color: 'url(javascript:alert(4))' }] } }));
  const dom = await page.evaluate(() => ({ img: !!document.querySelector('img[src="x"]'), svg: !!document.querySelector('svg[onload]') }));
  const leaked = await S((m) => /<script|javascript:|onload=/.test(JSON.stringify({ ...m.getState(), name: '' })));
  ok('hostile import: no dialog, nothing injected, config sanitised', dialogs === 0 && !dom.img && !dom.svg && !leaked, `dialogs=${dialogs}`);
  await page.evaluate(() => localStorage.setItem('archora.designs.v1', '{broken')); await page.goto(`${BASE}#/my-designs`); await page.reload(); await page.waitForTimeout(1000);
  ok('corrupted storage does not crash My Designs', (await page.locator('#app-main').innerText()).length > 20);

  /* exports + interaction */
  await page.goto(`${BASE}#/studio`); await page.waitForTimeout(1200); await S((m) => { m.resetState('default'); m.setUi({ units: 'm', viewMode: '2d' }); });
  for (const [view, fmt] of [['2d', 'svg'], ['2d', 'png'], ['3d', 'png']]) {
    if (view === '3d') { await page.locator('.ws-seg__btn', { hasText: '3D' }).click(); await page.waitForTimeout(2500); }
    await page.click('button[aria-label="Export image / SVG…"]'); await page.waitForSelector('#ex-view'); await page.selectOption('#ex-view', view); await page.selectOption('#ex-format', fmt); if (fmt !== 'svg') await page.selectOption('#ex-size', '1280');
    const [d] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.click('.modal .btn--primary')]); const p = path.join(OUT, `out-${view}.${fmt}`); await d.saveAs(p); const buf = fs.readFileSync(p);
    ok(`export ${view.toUpperCase()} ${fmt.toUpperCase()} is a valid file`, buf.length > 2000 && (fmt === 'svg' ? /^<svg[\s\S]*<\/svg>$/.test(buf.toString()) && !/<script/i.test(buf.toString()) : buf.slice(1, 4).toString() === 'PNG'), `${buf.length} bytes`);
  }
  await page.locator('.ws-seg__btn', { hasText: '2D' }).click(); await S((m, a, act) => { m.resetState('blank'); [[100, 100, 500, 100], [500, 100, 500, 400], [500, 400, 100, 400], [100, 400, 100, 100]].forEach(([x1, z1, x2, z2]) => act.addFreeWall(0, x1, z1, x2, z2, { thickness: 20 })); act.placeItem('sofa-l', 0, 300, 250, 0); m.getState().slabs.forEach((sl) => act.deleteSlab(sl.id)); });
  await page.keyboard.press('f'); await page.waitForTimeout(300); const b2 = await page.locator('.plan2d__svg').boundingBox(); const cx = b2.x + b2.width / 2; const cy = b2.y + b2.height / 2;
  await page.mouse.click(cx, cy); await page.mouse.click(cx, cy, { button: 'right' }); await page.waitForSelector('.ws-menu');
  await page.locator('.ws-menu__item', { hasText: 'Duplicate' }).click(); await page.waitForTimeout(200); const n = () => S((m) => m.getState().items.length);
  ok('right-click menu → Duplicate', (await n()) === 2); await page.keyboard.press('Delete'); ok('Delete removes the selection', (await n()) === 1);
  await page.keyboard.press('Control+z'); ok('Ctrl+Z undo', (await n()) === 2); await page.keyboard.press('Control+Shift+z'); ok('Ctrl+Shift+Z redo', (await n()) === 1);
  await page.keyboard.press('g'); ok('G toggles the grid', (await S((m) => m.getUi().showGrid)) === false); await page.keyboard.press('?'); await page.waitForSelector('.ws-keys'); ok('? opens the shortcut reference', true); await page.keyboard.press('Escape');
  for (const [name, vw, vh] of [['tablet 1024', 1024, 768], ['phone 390', 390, 844]]) { await page.setViewportSize({ width: vw, height: vh }); await page.waitForTimeout(500); ok(`${name}px: no horizontal page overflow`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1))); }

  console.log(results.join('\n')); const failed = results.filter((r) => r.startsWith('FAIL')).length; console.log(`\n${results.length - failed}/${results.length} passed; console errors: ${errors.length ? '\n' + errors.join('\n') : 'none'}`);
  await browser.close(); process.exit(failed || errors.length ? 1 : 0);
})().catch((e) => { console.log(results.join('\n')); console.log('CRASH', e.message.split('\n')[0]); process.exit(1); });
