// Smoke run: the paths a reader actually takes. Each test is deliberately
// coarse - it asks "did the thing appear", not "is the pixel right" - so a
// data refresh or a copy change does not break the build, while a dead
// script chain, a broken deep link or a silent empty table does.
import { test, expect } from "@playwright/test";

const ROW = "#myGrid .slick-row";

async function enter(page) {
  const browse = page.getByRole("button", { name: /Browse Articles|Loading articles/ });
  const first = await browse.isVisible().catch(() => false);
  if (first) await browse.click();
  await expect(page.locator(ROW).first()).toBeVisible();
  // A first entry starts the guided tour (browser-tour.js) over the table;
  // leave it so the test can reach what it came for.
  if (first) {
    await page.locator(".oa-tour-skip").click();
    await expect(page.locator(".oa-tour")).toHaveCount(0);
  }
}

// The author cells on screen, scrolled through the first ~60 articles: none
// shows a row that ends below the cell (a cut name or "+N"), and each "+N"
// counts exactly the authors its cell leaves out. Read once the clamp
// (articles-grid.js clampAuthorCells) has had its frame.
async function authorCellsWhole(page) {
  return page.evaluate(async () => {
    const vp = document.querySelector("#myGrid .slick-viewport");
    const byId = new Map(window.ARTICLES_DATA.map((a) => [a.id, a]));
    const bad = [];
    let cells = 0;
    for (let s = 0; s < 12; s += 1) {
      await new Promise((r) => setTimeout(r, 300));
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const v = vp.getBoundingClientRect();
      for (const c of vp.querySelectorAll(".slick-cell > .author-cell:not(.author-cell--all)")) {
        const b = c.getBoundingClientRect();
        if (b.top < v.top || b.bottom > v.bottom) continue;
        cells += 1;
        const shown = [...c.children].filter((r) => r.style.display !== "none");
        const more = c.querySelector(".author-etal");
        const n = more ? parseInt(more.textContent.slice(1), 10) : 0;
        const id = c.closest(".slick-row").querySelector(".title-link[data-id]").getAttribute("data-id");
        const total = byId.get(id).authors.length;
        if (shown.some((r) => r.getBoundingClientRect().bottom > b.bottom + 1) || shown.length - (more ? 1 : 0) + n !== total) bad.push(id);
      }
      vp.scrollTop += vp.clientHeight * 0.8;
    }
    return { cells, bad };
  });
}

test("no uncaught errors on the way to the table", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/");
  await enter(page);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => (window.OAErrorLog || []).filter((e) => e.kind !== "resource").length)).toBe(0);
});

test("the entry screen shows once, then the table opens directly", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#tableGate")).toBeVisible();
  await expect(page.locator(".oa-subtitle")).toContainText(/ articles by [\d ]+ authors from \d{4} to \d{4},/);   // "from N authors since 1997 to 2026"
  await enter(page);
  await page.reload();
  await expect(page.locator("#tableGate")).toHaveCount(0);
  await expect(page.locator(ROW).first()).toBeVisible();
});

test("the tour runs on the first entry only, offers two tours, steps with the keyboard, and replays from Settings", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Browse Articles|Loading articles/ }).click();
  const tour = page.locator(".oa-tour");
  await expect(tour).toBeVisible();
  // The welcome card is the chooser: no count, a Quick and a Full button.
  await expect(page.locator(".oa-tour-count")).toBeHidden();
  await expect(page.locator(".oa-tour-next")).toHaveText("Quick tour");
  await expect(page.locator(".oa-tour-full")).toBeVisible();
  await expect(page.locator(".oa-tour-ring")).toBeHidden();         // the welcome card has no spotlight
  await page.keyboard.press("ArrowRight");                          // the quick tour
  await expect(page.locator(".oa-tour-count")).toHaveText(/^1 \/ \d+$/);
  const total = (await page.locator(".oa-tour-count").innerText()).split("/")[1].trim();
  await expect(page.locator(".oa-tour-ring")).toBeVisible();
  await expect(page.locator("#articles-app")).toHaveAttribute("inert", "");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".oa-tour-count")).toHaveText("2 / " + total);   // the total holds
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);
  await expect(page.locator("#articles-app")).not.toHaveAttribute("inert", "");
  await page.reload();
  await expect(page.locator(ROW).first()).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(tour).toHaveCount(0);
  await page.locator("#searchSettings").click();
  await page.locator("#ssTour").click();
  await expect(tour).toBeVisible();
  await expect(page.locator("#searchSettingsPanel")).toBeHidden();
  await page.locator(".oa-tour-skip").click();
  await expect(tour).toHaveCount(0);
});

// The tour drives the table on one demo article and undoes that at the end,
// whenever it ends: an Esc mid-way leaves the list as the reader had it.
async function tourSettled(page) {
  await page.waitForFunction(() => {
    const n = document.querySelector(".oa-tour-next"), c = document.querySelector(".oa-tour-card");
    return !n || (!n.hasAttribute("aria-busy") && !(c && c.classList.contains("is-pending")));
  }, null, { timeout: 40000 });
}
test("a replayed tour left with Esc puts the list back where the reader had it", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  const vp = page.locator("#myGrid .slick-viewport").first();
  await vp.evaluate((v) => { v.scrollTop = 4000; v.dispatchEvent(new Event("scroll")); });
  await page.waitForTimeout(500);
  const before = await vp.evaluate((v) => v.scrollTop);
  await page.locator("#searchSettings").click();
  await page.locator("#ssTour").click();
  await expect(page.locator(".oa-tour")).toBeVisible();
  await tourSettled(page);
  expect(Math.abs(await vp.evaluate((v) => v.scrollTop) - before)).toBeLessThan(2);   // the welcome card jumped to the top
  for (let n = 0; n < 4; n += 1) { await page.keyboard.press("ArrowRight"); await tourSettled(page); }   // on to the demo row
  await page.keyboard.press("Escape");
  await expect(page.locator(".oa-tour")).toHaveCount(0);
  await expect.poll(() => vp.evaluate((v) => v.scrollTop)).toBeGreaterThan(before - 2);
  expect(Math.abs(await vp.evaluate((v) => v.scrollTop) - before)).toBeLessThan(2);   // 0 before
});

test("the tour's row stop says what the # and $ keyword marks and the buttons under the star do", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await enter(page);
  await page.locator("#searchSettings").click();
  await page.locator("#ssTour").click();
  await expect(page.locator(".oa-tour")).toBeVisible();
  await tourSettled(page);
  const title = page.locator(".oa-tour-title");
  for (let n = 0; n < 6 && (await title.textContent()) !== "Every row opens"; n += 1) {
    await page.keyboard.press("ArrowRight");
    await tourSettled(page);
  }
  await expect(title).toHaveText("Every row opens");
  await expect(page.locator(".oa-tour-text")).toContainText("# marks a topical one, $ a derived one");   // a hover tooltip only, before
  await expect(page.locator(".oa-tour-text")).toContainText("Under the star: copy the reference");      // the copy and BibTeX buttons were in no stop
});

test("Esc at the full tour's Centralities stop closes the abstract the tour opened", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  await expect(page.locator("#collapseAbstracts")).toHaveAttribute("title", /^No open abstracts/);
  await page.locator("#searchSettings").click();
  await page.locator("#ssTour").click();
  await expect(page.locator(".oa-tour")).toBeVisible();
  await tourSettled(page);
  await page.locator(".oa-tour-full").click();
  await tourSettled(page);
  const title = page.locator(".oa-tour-title");
  for (let n = 0; n < 15 && (await title.textContent()) !== "Centralities"; n += 1) {
    await page.keyboard.press("ArrowRight");
    await tourSettled(page);
  }
  await expect(title).toHaveText("Centralities");
  await page.keyboard.press("Escape");
  await expect(page.locator(".oa-tour")).toHaveCount(0);
  await expect(page.locator("#resetFilters")).toBeDisabled();                                  // the pin is gone
  await expect(page.locator("#collapseAbstracts")).toHaveAttribute("title", /^No open abstracts/);   // "Hide 1 open abstract" before
});

test("the quick tour shows kiosk mode just before its last stop, the ring on the kiosk button", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Browse Articles|Loading articles/ }).click();
  await expect(page.locator(".oa-tour-body")).toContainText("kiosk mode");   // the welcome card names it
  await page.keyboard.press("ArrowRight");                                   // the quick tour
  const count = page.locator(".oa-tour-count");
  await expect(count).toHaveText(/^1 \/ \d+$/);
  const total = Number((await count.innerText()).split("/")[1]);
  for (let n = 2; n < total; n += 1) {
    await page.keyboard.press("ArrowRight");
    await expect(count).toHaveText(n + " / " + total);
  }
  await expect(page.locator(".oa-tour-title")).toHaveText("Kiosk mode");
  // Around the button and no wider (the ring moves into place).
  await expect.poll(async () => {
    const r = await page.locator(".oa-tour-ring").boundingBox(), b = await page.locator(".oa-toprow .oa-kiosk-btn").boundingBox();
    return r.x <= b.x && r.y <= b.y && r.x + r.width >= b.x + b.width && r.y + r.height >= b.y + b.height && r.width < 2 * b.width;
  }).toBe(true);
  await page.keyboard.press("ArrowRight");
  await expect(count).toHaveText(total + " / " + total);
});

test("a ?q= deep link filters to the named article", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  const id = await page.evaluate(() => window.ARTICLES_DATA[0].id);
  await page.goto("/?q=" + encodeURIComponent('ID IS "' + id + '"'));
  await expect(page.locator(ROW).first()).toBeVisible();
  await expect(page.locator("#resultCount")).toContainText(/^1\b/);
});

test("the tab names the view: an author, a search, nothing for two rules", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  const own = await page.title();
  await page.goto("/?q=" + encodeURIComponent('AUTHOR IS "bos_freek"'));
  await expect(page).toHaveTitle("Bos, Freek • 3dcp.fyi");
  await page.goto("/?search=shotcrete");
  await expect(page).toHaveTitle("“shotcrete” • 3dcp.fyi");
  await page.goto("/?q=" + encodeURIComponent('AUTHOR IS "bos_freek" AND KEYWORD IS "#rheology"'));
  await expect(page.locator("#resultCount")).toContainText("of");   // the rules have applied
  await expect(page).toHaveTitle(own);
});

test("keyword search returns a result set", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  const before = await page.locator("#resultCount").innerText();
  const box = page.locator("#semanticSearch");
  await box.fill("printable concrete");
  await box.press("Enter");
  await expect(page.locator("#resultCount")).not.toHaveText(before);
});

test("a short word is searched as written: 'sand' is not 'and'", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  const box = page.locator("#semanticSearch");
  await box.fill("sand");
  await box.press("Enter");
  // "577 of 5 724": nowhere near every article (one typo made it "and": 5 723).
  await expect.poll(async () => {
    const m = (await page.locator("#resultCount").innerText()).replace(/\s+/g, "").match(/^(\d+)of(\d+)$/);
    return m ? Number(m[1]) / Number(m[2]) : -1;
  }).toBeGreaterThan(0);
  const m = (await page.locator("#resultCount").innerText()).replace(/\s+/g, "").match(/^(\d+)of(\d+)$/);
  expect(Number(m[1])).toBeLessThan(Number(m[2]) / 2);
});

test("an author's name and Enter list at least that author's works", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  // The first author of the first row, and how many works list that person.
  const { name, works } = await page.evaluate(() => {
    const first = window.ARTICLES_DATA[0].authors[0];
    const works = window.ARTICLES_DATA.filter((row) => (row.authors || []).some((a) => a.id === first.id)).length;
    return { name: [first.firstName, first.lastName].filter(Boolean).join(" "), works };
  });
  const box = page.locator("#semanticSearch");
  await box.fill(name);
  await box.press("Enter");
  // "35 of 5 724" once the search has run; -1 until then.
  await expect.poll(async () => {
    const m = (await page.locator("#resultCount").innerText()).replace(/\s+/g, "").match(/^(\d+)of\d+$/);
    return m ? Number(m[1]) : -1;
  }).toBeGreaterThanOrEqual(works);
});

test("Back undoes a right-click filter and a name picked in the author panel, as it does a click", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  await page.evaluate(() => { window.__samePage = true; });
  const q = () => page.evaluate(() => new URLSearchParams(location.search).get("q") || "");
  await page.locator("#myGrid .slick-row.oa-row-head .author-link").first().click({ button: "right" });
  await expect.poll(q).toMatch(/^AUTHOR IS /);
  await page.goBack();
  await expect.poll(q).toBe("");
  expect(await page.evaluate(() => window.__samePage)).toBe(true);   // Back stayed on the table
  await page.goto("/?q=" + encodeURIComponent('AUTHOR IS "bos_freek"'));
  await page.evaluate(() => { window.__samePage = true; });
  const coauthor = page.locator('[data-part="author"] a[data-ap-author]').first();
  await coauthor.scrollIntoViewIfNeeded();
  await coauthor.click();
  await expect.poll(q).not.toBe('AUTHOR IS "bos_freek"');
  await page.goBack();
  await expect.poll(q).toBe('AUTHOR IS "bos_freek"');
  expect(await page.evaluate(() => window.__samePage)).toBe(true);
});

test.describe("at 1440 x 900", () => {
  test.use({ viewport: { width: 1440, height: 900 } });
  test("Tab and the arrow key walk down the table without dropping focus", async ({ page }) => {
    await page.goto("/");
    await enter(page);
    for (const key of ["Tab", "ArrowDown"]) {
      await page.evaluate(() => {
        const rows = [...document.querySelectorAll("#myGrid .slick-row.oa-row-head")]
          .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
        rows[0].querySelector(".title-link").focus();
      });
      // The rows that scroll in are measured and the table rebuilt: focus used
      // to fall to <body> after a dozen rows.
      for (let i = 1; i <= 20; i += 1) {
        await page.keyboard.press(key);
        await page.waitForTimeout(250);
        expect(await page.evaluate(() => !!document.activeElement.closest("#myGrid .slick-row")), key + " #" + i).toBe(true);
      }
      await page.reload();
      await expect(page.locator(ROW).first()).toBeVisible();
    }
  });

  test("a category chip's name starts with the code it shows", async ({ page }) => {
    await page.goto("/");
    await enter(page);
    const chips = await page.evaluate(() => [...document.querySelectorAll("#myGrid .oa-cat-chip")]
      .map((c) => ({ text: c.textContent.trim(), label: c.getAttribute("aria-label") })));
    expect(chips.length).toBeGreaterThan(0);
    for (const c of chips) expect(c.label.startsWith(c.text), c.label).toBe(true);
  });

  test("Tab enters the table on an article and Shift+Tab walks back up in order", async ({ page }) => {
    await page.goto("/");
    await enter(page);
    // No invisible stops: SlickGrid's sinks, panes, viewports and canvas.
    expect(await page.evaluate(() => [...document.querySelectorAll("#myGrid [tabindex='0']")]
      .filter((e) => !e.closest(".slick-row") && !e.closest(".slick-header-column")).length)).toBe(0);
    await page.locator("#myGrid .slick-header-column .oa-sort-btn").last().focus();
    const rowOf = () => page.evaluate(() => {
      const row = document.activeElement.closest("#myGrid .slick-row.oa-row-head");
      return row ? Number(row.getAttribute("data-row")) : null;
    });
    await page.keyboard.press("Tab");
    expect(await rowOf()).not.toBeNull();
    for (let i = 0; i < 25; i += 1) await page.keyboard.press("Tab");
    await page.waitForTimeout(300);
    // Rows drawn on the way back up are added at the end of the page: Shift+Tab
    // used to jump out of the table there.
    let previous = await rowOf();
    for (let i = 1; i <= 20; i += 1) {
      await page.keyboard.press("Shift+Tab");
      await page.waitForTimeout(120);
      const now = await rowOf();
      expect(now, "Shift+Tab #" + i).not.toBeNull();
      expect(now, "Shift+Tab #" + i).toBeLessThan(previous);
      previous = now;
    }
  });
});

test("a graph tile clicked during a search ends the search and lists what its count says", async ({ page }) => {
  await page.goto("/?search=" + encodeURIComponent("contour crafting"));
  await enter(page);
  await expect(page.locator("#resultCount")).toContainText("of");
  // The top result's abstract (a search opens its hits' abstracts; open it if not).
  await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#myGrid .slick-row.oa-row-head")]
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    const toggle = rows[0].querySelector(".abstract-toggle");
    if (!toggle.classList.contains("is-open")) toggle.click();
  });
  // A live tile whose count is a plain number (1000 and up read "1.2k"). Found
  // again by its rule and article, not by a mark: the search can re-render the
  // drop under the test (it failed 4 runs in 6 on the marked node).
  let pick = null;
  await expect.poll(async () => {
    pick = await page.evaluate(() => {
      const tile = [...document.querySelectorAll("#myGrid .oa-graph-link.has-count:not(.is-disabled)")]
        .find((t) => /^\d+$/.test(t.querySelector(".oa-index-n").textContent));
      return tile ? { rule: tile.dataset.graphRule, id: tile.dataset.graphId, n: Number(tile.querySelector(".oa-index-n").textContent) } : null;
    });
    return !!pick;
  }).toBe(true);
  const tile = page.locator('#myGrid .oa-graph-link[data-graph-rule="' + pick.rule + '"][data-graph-id="' + pick.id + '"]').first();
  const promised = pick.n;
  await tile.click();
  await expect(page.locator("#semanticSearch")).toHaveValue("");
  await expect.poll(() => page.evaluate(() => location.search)).not.toContain("search=");
  await expect.poll(async () => {
    const m = (await page.locator("#resultCount").innerText()).replace(/\s+/g, "").match(/^(\d+)of\d+$/);
    return m ? Number(m[1]) : -1;
  }).toBe(promised);
});

test("Enter works on a row's links and buttons, and focus stays on the control", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  // The top row on screen: SlickGrid adds rows to the DOM in the order it renders them.
  const focusTop = (sel) => page.evaluate((s) => {
    const rows = [...document.querySelectorAll("#myGrid .slick-row.oa-row-head")]
      .filter((r) => r.getBoundingClientRect().height > 0)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    rows[0].querySelector(s).focus();
    return document.activeElement.dataset.absId || document.activeElement.textContent.trim();
  }, sel);
  const focused = () => page.evaluate(() => {
    const a = document.activeElement;
    return a === document.body ? "body" : a.className + "|" + (a.dataset.absId || a.textContent.trim());
  });
  const id = await focusTop(".abstract-toggle");
  await page.keyboard.press("Enter");
  await expect(page.locator(`#myGrid .abs-drop[data-abs-drop="${id}"]`)).toHaveCount(1);
  await expect.poll(focused).toBe("abstract-toggle is-open|" + id);   // not <body>: the row was rebuilt
  await page.keyboard.press(" ");
  await expect(page.locator("#myGrid .abs-drop[data-abs-drop]")).toHaveCount(0);
  await expect.poll(focused).toBe("abstract-toggle|" + id);
  const author = await focusTop(".author-link");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/AUTHOR\+IS/);
  await expect.poll(focused).toMatch(new RegExp("^html-link author-link.*\\|" + author.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"));
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("the search field keeps room for the typed text, and nothing spills out of it", async ({ page }) => {
    await page.goto("/");
    await enter(page);
    await page.locator("#semanticSearch").fill("printable concrete");
    const room = await page.evaluate(() => {
      const input = document.querySelector("#semanticSearch"), cs = getComputedStyle(input);
      const field = document.querySelector(".oa-tsearch").getBoundingClientRect();
      return {
        text: input.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
        spill: [...document.querySelectorAll(".oa-tsearch > *")].some((el) => el.getBoundingClientRect().right > field.right + 0.5)
      };
    });
    expect(room.spill).toBe(false);
    expect(room.text).toBeGreaterThan(100);   // it was 0: the text could not be seen while typing
  });

  test("a tapped author leaves the table its room: builder shut, statistics folded", async ({ page }) => {
    await page.goto("/");
    await enter(page);
    await page.locator("#myGrid .slick-row.oa-row-head .author-link").first().tap();
    await expect(page.locator("#authorFooter")).toBeVisible();
    await expect(page.locator("#ruleBuilderToggle")).toHaveClass(/has-rules/);   // the Filters button says so
    await expect(page.locator("#ruleBuilderBody")).toBeHidden();
    await expect(page.locator("#authorFooter")).toHaveClass(/is-folded/);
    // One article on screen before (builder and statistics open); four now.
    const rows = await page.evaluate(() => {
      const vp = document.querySelector("#myGrid .slick-viewport").getBoundingClientRect();
      return [...document.querySelectorAll("#myGrid .slick-row.oa-row-head")]
        .filter((r) => { const t = r.getBoundingClientRect().top; return t >= vp.top - 1 && t < Math.min(vp.bottom, innerHeight) - 10; }).length;
    });
    expect(rows).toBeGreaterThanOrEqual(3);
    await page.locator("#authorFooter .af-fold").tap();
    await expect(page.locator("#authorFooter")).not.toHaveClass(/is-folded/);
  });

  test("a third tap on a sorted header goes back to newest first", async ({ page }) => {
    await page.goto("/");
    await enter(page);
    const article = page.locator("#myGrid .slick-header-column").filter({ hasText: "Article" });
    const sortBy = () => page.evaluate(() => new URLSearchParams(location.search).get("SORT_BY"));
    await article.tap();
    await expect.poll(sortBy).toBe("TITLE");
    await article.tap();
    await expect.poll(sortBy).toBe("TITLE_DESC");
    await article.tap();
    await expect.poll(sortBy).toBe("NEW");   // phones hide the Date column: there was no way back
    await expect(article).not.toHaveAttribute("aria-sort", /./);
  });

  test("author cells show whole names, and their \"+N\" counts the rest", async ({ page }) => {
    await page.goto("/");
    await enter(page);
    const r = await authorCellsWhole(page);
    expect(r.cells).toBeGreaterThan(20);
    expect(r.bad).toEqual([]);   // 23 of 50 articles cut a name or their "+N"
  });

  test("every rule's field and condition names fit their boxes", async ({ page }) => {
    await page.goto("/");
    await enter(page);
    await page.goto("/?q=" + encodeURIComponent('TOC CONTAINS "slump" OR CITED_BY_AUTHOR IS "bos_freek" OR KEYWORD IS "#rheology" OR CATEGORY IS "MAT"'));
    await expect(page.locator(ROW).first()).toBeVisible();
    const toggle = page.locator("#ruleBuilderToggle");
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.tap();
    await expect(page.locator("#ruleBuilderBody")).toBeVisible();
    const cut = await page.evaluate(() => [...document.querySelectorAll("#ruleBuilderBody .rule-row select")].filter((s) => {
      const cs = getComputedStyle(s), c = document.createElement("canvas").getContext("2d");
      c.font = cs.fontWeight + " " + cs.fontSize + " " + cs.fontFamily;
      return c.measureText(s.options[s.selectedIndex].text).width > s.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 0.5;
    }).map((s) => s.options[s.selectedIndex].text));
    expect(cut).toEqual([]);   // the field kept 58px here: KEYWORD, CATEGORY, TABLE OF CONTENTS were cut
  });

  test("author cells give initials and no marks, and the \"+N\" list keeps both", async ({ page }) => {
    await page.goto("/");
    await enter(page);
    const cells = await page.evaluate(() => [...document.querySelectorAll("#myGrid .slick-cell > .author-cell")].map((c) => ({
      marks: c.querySelectorAll(".author-orcid, .author-aff").length,
      names: [...c.querySelectorAll(".author-link")].map((a) => a.textContent)
    })));
    expect(cells.length).toBeGreaterThan(5);
    expect(cells.filter((c) => c.marks)).toEqual([]);   // two 18px mark slots left a name ~80px of 129
    const initials = /, (\p{Lu}\.[ -]?)+$/u;
    expect(cells.flatMap((c) => c.names).filter((n) => n.includes(", ") && !initials.test(n))).toEqual([]);   // "Zhu, B."
    // A "+N" somewhere down the list: its list has the full names and the marks.
    const more = page.locator("#myGrid .author-etal").first();
    for (let s = 0; s < 30 && !(await more.count()); s += 1) {
      await page.evaluate(() => { const vp = document.querySelector("#myGrid .slick-viewport"); vp.scrollTop += vp.clientHeight; });
      await page.waitForTimeout(250);
    }
    await more.scrollIntoViewIfNeeded();
    await more.tap();
    const pop = page.locator(".kw-pop:not([hidden])");
    await expect(pop).toBeVisible();
    const list = await pop.evaluate((p) => ({ rows: p.querySelectorAll("li").length, marks: p.querySelectorAll(".author-orcid").length,
      names: [...p.querySelectorAll(".author-link")].map((a) => a.textContent) }));
    expect(list.marks).toBe(list.rows);
    expect(list.names.some((n) => n.includes(", ") && !initials.test(n))).toBe(true);
  });

  test("the Favorites menu and a rule's value suggestions open on screen", async ({ page }) => {
    await page.goto("/");
    await enter(page);
    await page.evaluate(() => window.OAFavorites.toggle(window.ARTICLES_DATA[0].id));
    await page.locator("#favMenuBtn").tap();
    const inside = (sel) => page.evaluate((s) => {
      const el = [...document.querySelectorAll(s)].find((e) => !e.hidden && e.getBoundingClientRect().width);
      const r = el.getBoundingClientRect();
      return r.left >= 0 && r.right <= innerWidth;
    }, sel);
    await expect(page.locator("#favMenu")).toBeVisible();
    expect(await inside("#favMenu")).toBe(true);                    // it ran 42px off the left edge
    await page.locator("#favMenuBtn").tap();
    await page.goto("/?q=" + encodeURIComponent('AUTHOR IS "bos_freek"'));
    await expect(page.locator(ROW).first()).toBeVisible();
    await page.locator("#ruleBuilderToggle").tap();
    await expect(page.locator("#ruleBuilderBody")).toBeVisible();
    const value = page.locator("#ruleBuilderBody .rule-row .rule-value input").first();
    await value.tap();
    await value.fill("w");
    await expect(page.locator("#ruleBuilderBody .sf-menu:not([hidden])")).toBeVisible();
    expect(await inside("#ruleBuilderBody .sf-menu")).toBe(true);   // it ran 38px off the right edge
  });
});

test.describe("on a phone held sideways", () => {
  test.use({ viewport: { width: 844, height: 340 }, isMobile: true, hasTouch: true });   // iPhone 12, browser bars shown
  test("the tour card fits the screen, its buttons in reach", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: /Browse Articles|Loading articles/ }).click();
    await expect(page.locator(".oa-tour")).toBeVisible();
    await page.locator(".oa-tour-next").click();   // the quick tour
    for (let n = 1; n <= 3; n += 1) {
      await expect(page.locator(".oa-tour-count")).toHaveText(new RegExp("^" + n + " / "));
      await page.waitForTimeout(400);              // the card moves into place
      const fit = await page.evaluate(() => {
        const c = document.querySelector(".oa-tour-card").getBoundingClientRect();
        const next = document.querySelector(".oa-tour-next").getBoundingClientRect();
        return c.top >= 0 && c.bottom <= innerHeight && next.bottom <= innerHeight;
      });
      expect(fit, "stop " + n).toBe(true);         // 350px of card on a 340px screen
      await page.keyboard.press("ArrowRight");
    }
  });
  test("only the rows scroll: the page stays put, with the filters open and on an author's page too", async ({ page }) => {
    // How far the page itself scrolls, and how far the rows' pane spills past the table.
    const settled = async () => {
      await page.waitForTimeout(400);              // the table re-fits to its box
      return page.evaluate(() => {
        const root = document.querySelector(".oa-root");
        const grid = document.querySelector("#myGrid").getBoundingClientRect();
        const rows = document.querySelector("#myGrid .slick-viewport").getBoundingClientRect();
        return { page: Math.max(0, root.scrollHeight - root.clientHeight - 1), spill: Math.max(0, Math.round(rows.bottom - grid.bottom)) };
      });
    };
    const openFilters = async () => {
      const toggle = page.locator("#ruleBuilderToggle");
      if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.tap();
      await expect(page.locator("#ruleBuilderBody")).toBeVisible();
    };
    await page.goto("/");
    await enter(page);
    expect(await settled()).toEqual({ page: 0, spill: 0 });   // the page scrolled 14px: the table kept 62% of the window
    await page.goto("/?q=" + encodeURIComponent('(KEYWORD IS "#rheology" OR TITLE CONTAINS "nozzle") AND DATE >= 2020-01'));
    await expect(page.locator(ROW).first()).toBeVisible();
    await openFilters();
    expect(await settled()).toEqual({ page: 0, spill: 0 });   // 160px with the filter panel open
    await page.goto("/?q=" + encodeURIComponent('AUTHOR IS "bos_freek"'));
    await expect(page.locator("#authorFooter:not([hidden])")).toBeVisible();
    expect(await settled()).toEqual({ page: 0, spill: 0 });   // 19px past an author's footer
    await openFilters();
    expect(await settled()).toEqual({ page: 0, spill: 0 });   // 141px with both; with no floor at all the rows' pane spilled over the footer
  });
});

test("with the Authors column hidden, an abstract lists the authors one per line, no stray separators", async ({ page }) => {
  await page.addInitScript(() => { try { localStorage.setItem("oa-hidden-columns", '["authors"]'); } catch (e) { /* storage off */ } });
  await page.goto("/");
  await enter(page);
  await page.locator("#myGrid .slick-row.oa-row-head .abstract-toggle").first().click();
  const list = page.locator("#myGrid .slick-viewport .abs-meta-authors .abs-meta-v").first();
  await expect(list).toBeVisible();
  expect(await list.locator(".author-row").count()).toBeGreaterThan(0);
  const loose = await list.evaluate((el) => [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent));
  expect(loose).toEqual([]);   // a "; " stood alone on a line between every two names
});

test("at every width the Authors column outlives Date and Access", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  const without = [];
  for (let w = 560; w <= 760; w += 8) {
    await page.setViewportSize({ width: w, height: 800 });
    await page.waitForTimeout(450);
    const ids = await page.evaluate(() => [...document.querySelectorAll("#myGrid .slick-header-column")].map((h) => h.id.replace(/^slickgrid_\d+/, "")));
    if (!ids.includes("authors")) without.push(w + "px: " + ids.join(", "));
  }
  expect(without).toEqual([]);   // 600 to 695px showed Date and Article, no Authors
});

test("beside the metrics panel, a rule row's eye, x and + stay inside the builder", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await enter(page);
  await page.goto("/?q=" + encodeURIComponent('AUTHOR IS "bos_freek"'));
  await expect(page.locator("#authorPanel")).toBeVisible();
  await page.locator("#ruleBuilderToggle").click();
  const rows = page.locator("#ruleBuilderBody .rule-row");
  await expect(rows).toHaveCount(1);
  await rows.first().locator(".rule-add").click();   // Playwright refuses a click the panel covers
  await expect(rows).toHaveCount(2);
});

test("a shared favorites link asks before it adds to the reader's own list, or just shows the papers", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  const ids = await page.evaluate(() => window.ARTICLES_DATA.slice(0, 3).map((a) => a.id));
  await page.evaluate((id) => window.OAFavorites.toggle(id), ids[0]);   // one of the three is saved already
  const dialog = page.getByRole("alertdialog");
  await page.goto("/?favs=" + ids.join(",") + "#favorites");
  await expect(dialog).toContainText("Add 2 shared papers to your favorites?");
  await expect(dialog).toContainText("already saved");
  await dialog.getByRole("button", { name: "Just show them" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("#resultCount")).toContainText(/^3\b/);   // the three shared papers, the saved one too
  const listed = await page.evaluate(() => [...document.querySelectorAll("#myGrid .slick-row.oa-row-head .title-link[data-id]")].map((a) => a.getAttribute("data-id")).sort());
  expect(listed).toEqual([...ids].sort());                             // "Don't add" left the normal table
  expect(await page.evaluate(() => window.OAFavorites.count())).toBe(1);   // all three went in unasked
  expect(page.url()).not.toContain("favs=");
  expect(page.url()).not.toContain("#favorites");
  await page.goto("/?favs=" + ids.join(",") + "#favorites");
  await dialog.getByRole("button", { name: "Add to favorites" }).click();
  await expect.poll(() => page.evaluate(() => window.OAFavorites.count())).toBe(3);
});

test("a favorite survives a reload", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  const star = page.locator(ROW).first().locator(".oa-fav-toggle, [data-fav-id], button[aria-label*='avorite']").first();
  await star.click();
  const badge = page.locator("[data-fav-count]").first();
  await expect(badge).toContainText("1");
  await page.reload();
  await expect(page.locator("[data-fav-count]").first()).toContainText("1");
});

test("the 404 router keeps the legacy legal URL alive", async ({ page }) => {
  await page.goto("/impressum");
  await expect(page).toHaveURL(/rechtliches\.html#impressum$/);
  await expect(page.locator("#impressum")).toBeVisible();
});

test("on the dark themes the sponsor logos are drawn white", async ({ page }) => {
  const filterIn = async (theme) => {
    await page.evaluate((t) => localStorage.setItem("oa-scheme", t), theme);
    await page.reload();
    return page.locator(".oa-sponsor-logo").first().evaluate((img) => getComputedStyle(img).filter);
  };
  await page.goto("/");
  expect(await filterIn("mint")).toContain("invert(1)");    // greyed blue on the dark ground: 1.6:1, white now 7:1
  expect(await filterIn("dark")).toContain("invert(1)");
  expect(await filterIn("light")).toContain("grayscale(1)");
});

test("the table view is the page's main landmark, headed for screen readers", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  await expect(page.getByRole("main")).toHaveCount(1);                              // none before
  await expect(page.getByRole("main").getByRole("heading", { level: 1, name: "3dcp.fyi" })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);             // the entry screen's left with it
});

test("the legal notice sets its prose at a reading measure", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/rechtliches.html");
  const widest = await page.evaluate(() => Math.max(...[...document.querySelectorAll(".oa-legal p, .oa-legal li")].map((p) => p.getBoundingClientRect().width)));
  expect(widest).toBeLessThan(800);   // 1044px before: some 120 characters a line
});

test("the landing page links the legal notice", async ({ page }) => {
  await page.goto("/");
  await page.locator('#tableGate .oa-gate-legal a[href$="#impressum"]').click();
  await expect(page).toHaveURL(/rechtliches\.html#impressum$/);
  await expect(page.locator("#impressum")).toBeVisible();
});

test("the table links the legal notice from Settings, on every tab", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  await page.locator("#searchSettings").click();
  const legal = page.locator("#searchSettingsPanel .ss-legal a");
  for (const tab of ["search", "look", "read"]) {
    await page.locator("#ssTab-" + tab).click();
    await expect(legal).toHaveCount(3);
    await expect(legal.first()).toBeVisible();
  }
  await legal.first().click();
  await expect(page).toHaveURL(/rechtliches\.html#impressum$/);
  await expect(page.locator("#impressum")).toBeVisible();
});

test("Tab out of either end of Settings closes it; focus goes on from the Settings button", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  const panel = page.locator("#searchSettingsPanel");
  const button = page.locator("#searchSettings");
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await page.keyboard.press("Shift+Tab");   // before the first control
  await expect(panel).toBeHidden();
  await expect(button).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(panel).toBeVisible();
  await page.locator("#searchSettingsPanel .ss-legal a").last().focus();
  await page.keyboard.press("Tab");         // past the last control
  await expect(panel).toBeHidden();
  const landed = await page.evaluate(() => {
    const a = document.activeElement, r = a.getBoundingClientRect();
    return { body: a === document.body, visible: r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= innerHeight };
  });
  expect(landed).toEqual({ body: false, visible: true });
});

test("a failed data script shows an error with a working retry", async ({ page }) => {
  // First visit with the dataset blocked: the table must say so, not stay
  // blank. Lifting the block and pressing Retry must then build the table.
  // data-load.js fetches the file in a worker, then falls back to a <script>;
  // the route blocks both.
  let block = true;
  await page.route("**/data/tabular_data.js", (route) => (block ? route.abort() : route.continue()));
  await page.goto("/");
  await page.getByRole("button", { name: /Browse Articles|Loading articles/ }).click();
  await expect(page.getByRole("alert")).toContainText(/could not be downloaded/);
  block = false;
  await page.getByRole("button", { name: "Retry loading articles" }).click();
  await expect(page.locator(ROW).first()).toBeVisible();
});

test("the dataset is parsed off the main thread", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  // No <script src=data/tabular_data.js> on the happy path: the worker did it.
  expect(await page.locator('script[src*="tabular_data"]').count()).toBe(0);
  expect(await page.evaluate(() => Array.isArray(window.ARTICLES_DATA) && window.ARTICLES_DATA.length > 1000)).toBe(true);
});

test("header actions are grouped, and the More menu lists them with labels", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.goto("/");
  await enter(page);
  const row = page.locator(".oa-toprow");
  await expect(row.locator(".oa-top-sep")).toHaveCount(3);
  // settings leads the List group; favorites follow the first separator
  const order = await row.evaluate((r) => [...r.children].map((c) => c.id || c.className.split(" ")[0]));
  expect(order.indexOf("oa-tb-head")).toBeLessThan(order.indexOf("oa-top-sep"));
  const chevron = page.locator("#myGrid .slick-row.oa-row-head .abstract-toggle").first();
  await chevron.click();
  await expect(chevron).toHaveAttribute("aria-expanded", "true");
  await page.locator(".oa-top-more-btn").click();
  const items = page.locator(".oa-top-more-menu [role^='menuitem']");
  expect(await items.count()).toBeGreaterThan(5);
  await expect(items.filter({ hasText: "Favorites" })).toHaveCount(1);
  await expect(items.filter({ hasText: "Suggest a paper" })).toHaveCount(1);
  // Escape closes it - and only it: the open abstract stays open
  await page.keyboard.press("Escape");
  await expect(page.locator(".oa-top-more-menu")).toBeHidden();
  await expect(page.locator("#myGrid .abstract-toggle[aria-expanded='true']")).toHaveCount(1);
});

test("settings open on three tabs and remember the last one", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  await page.locator("#searchSettings").click();
  await expect(page.locator(".ss-tab")).toHaveCount(3);
  await expect(page.locator("#ssPane-search")).toBeVisible();
  await page.locator("#ssTab-look").click();
  await expect(page.locator("#ssPane-look")).toBeVisible();
  await expect(page.locator("#ssPane-search")).toBeHidden();
  await expect(page.locator(".ss-swatch, .ss-color")).toHaveCount(0);
  await page.reload();
  await enter(page);
  await page.locator("#searchSettings").click();
  await expect(page.locator("#ssPane-look")).toBeVisible();
});

test("the reset button names the open Settings tab and resets that tab only", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  await page.locator("#searchSettings").click();
  const reset = page.locator("#ssReset");
  await expect(reset).toHaveText("Reset search");
  await page.locator("#ssTol").evaluate((el) => { el.value = "0"; el.dispatchEvent(new Event("change")); });
  await page.locator("#ssTab-look").click();
  await expect(reset).toHaveText("Reset appearance");
  await page.locator("#ssChipFill").click();
  await page.locator("#ssAbsLines").click();
  await page.locator('#ssPane-look [data-oa-theme="light"]').click();
  await page.locator("#ssTab-read").click();
  await expect(reset).toHaveText("Reset reader");
  await page.locator("#ssCiteStyle").selectOption("IEEE");
  await reset.click();                                      // the reader's: the reference style only
  await expect(page.locator("#ssCiteStyle")).toHaveValue("Chicago");
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "light");
  await expect(html).toHaveAttribute("data-cat-chips", "fill");
  await page.locator("#ssTab-look").click();
  await reset.click();                                      // the look's: it never reset before
  await expect(html).toHaveAttribute("data-theme", "mint");
  await expect(html).toHaveAttribute("data-cat-chips", "dot");
  await expect(html).toHaveAttribute("data-abs-layout", "flow");
  await page.locator("#ssTab-search").click();
  await expect(page.locator("#ssTol")).toHaveValue("0");     // the search's stays as set
  await reset.click();
  await expect(page.locator("#ssTol")).not.toHaveValue("0");
});

test("a whole-database BibTeX download asks first", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  await page.locator("#exportResults").click();
  await expect(page.locator(".oa-confirm")).toContainText(/Download \d{1,3}(\u202F\d{3})+ articles as BibTeX/);   // "5,724" before; the site groups digits with a narrow no-break space
  await page.locator(".oa-confirm button:not(.oa-confirm-ok)").click();
  await expect(page.locator(".oa-confirm")).toHaveCount(0);
});

/* ---- Kiosk mode (kiosk.js) ----------------------------------------------
   Headless Chromium has no voices, so speech is stubbed: an utterance "ends"
   a moment after it starts. That runs the real reader (oa-tts.js) and the
   kiosk's own loop. With `gated`, the stub refuses to speak ("not-allowed")
   until the page has had a click or a key, as Chrome does. (It keeps its own
   count: under automation navigator.userActivation reports a click that
   never happened.) */
async function stubSpeech(page, gated) {
  await page.addInitScript((gate) => {
    window.__spoken = [];
    window.__rates = [];
    let clicked = false;
    ["pointerdown", "keydown"].forEach((type) => window.addEventListener(type, () => { clicked = true; }, true));
    const synth = window.speechSynthesis;
    synth.cancel = () => {};
    synth.speak = (u) => setTimeout(() => {
      if (gate && !clicked) { if (u.onerror) u.onerror({ error: "not-allowed" }); return; }
      window.__spoken.push(u.text);
      window.__rates.push(u.rate);
      if (u.onend) u.onend();
    }, 30);
  }, !!gated);
}
test("a drop's Read aloud that the speech engine fails says so", async ({ page }) => {
  await page.addInitScript(() => {
    window.speechSynthesis.cancel = () => {};
    window.speechSynthesis.speak = (u) => setTimeout(() => { if (u.onerror) u.onerror({ error: "synthesis-failed" }); }, 30);
  });
  await page.goto("/");
  await enter(page);
  await page.locator("#myGrid .slick-row.oa-row-head .abstract-toggle").first().click();
  const listen = page.locator("#myGrid .abs-drop .oa-tts-btn").first();
  await listen.click();
  await expect(page.locator(".oa-copy-toast")).toHaveText(/Read aloud failed \(synthesis-failed\)/);   // it went quiet without a word
});
const kiosk = (page) => page.locator(".oa-kiosk");
const kioskKey = (page) => page.locator(".oa-kiosk .oa-crumb .oa-muted");
// A work that has an abstract and a row: kiosk mode can play it.
const readableId = (page) => page.evaluate(async () => {
  const data = await window.OAData.load("data/abstract_data.js", "ABSTRACT_DATA");
  const rows = new Set(window.ARTICLES_DATA.map((r) => r.id));
  return data.records.find((r) => rows.has(r.id) && r.sentences && r.sentences.length).id;
});

test("kiosk mode reads a sentence at a time, moves on by itself, steps with the keys and closes with Esc", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await stubSpeech(page);
  await page.goto("/");
  await enter(page);
  await page.locator(".oa-toprow .oa-kiosk-btn").click();
  await expect(kiosk(page)).toBeVisible();
  await expect(page.locator(".oa-kiosk-title")).not.toBeEmpty();
  await expect(page.locator(".oa-kiosk-meta dt").first()).toHaveText("Date");
  await expect(page.locator(".oa-kiosk-qr svg")).toBeVisible();
  const first = await kioskKey(page).innerText();
  // The reading ends, and after the pause the next work comes up on its own.
  await expect(kioskKey(page)).not.toHaveText(first, { timeout: 20000 });
  const second = await kioskKey(page).innerText();
  await expect(page.locator(".oa-kiosk-count")).toHaveText(/^2 \/ [\d\u202F]+$/);
  const spoken = await page.evaluate(() => window.__spoken);
  expect(spoken.length).toBeGreaterThan(2);
  // The kiosk's own speed, 1.125x (about 180 words a minute), in chunks of ~10 s.
  expect(await page.evaluate(() => window.__rates.every((r) => r === 1.125))).toBe(true);
  expect(spoken.every((t) => t.trim().split(/\s+/).length <= 30)).toBe(true);
  await page.keyboard.press("ArrowLeft");
  await expect(kioskKey(page)).toHaveText(first);
  await page.keyboard.press("PageDown");
  await expect(kioskKey(page)).toHaveText(second);
  await page.keyboard.press(" ");
  await expect(kiosk(page)).toHaveClass(/is-paused/);
  await page.keyboard.press(" ");
  await expect(kiosk(page)).not.toHaveClass(/is-paused/);
  await page.keyboard.press("m");
  await expect(page.locator('.oa-kiosk-btn[aria-label="Mute (M)"]')).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("m");
  await page.keyboard.press("Escape");
  await expect(kiosk(page)).toHaveCount(0);
  await expect(page.locator(".oa-toprow .oa-kiosk-btn")).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});

test("a kiosk link starts by itself, plays only the filtered selection, and hides the pointer when idle", async ({ page }) => {
  await stubSpeech(page);
  await page.goto("/");
  await enter(page);
  const id = await readableId(page);
  await page.goto("/?kiosk&q=" + encodeURIComponent('ID IS "' + id + '"'));
  await expect(kiosk(page)).toBeVisible();
  await expect(kioskKey(page)).toHaveText(id);
  await expect(page.locator(".oa-kiosk-count")).toHaveText("1 / 1");
  await expect(kiosk(page)).toHaveClass(/is-idle/, { timeout: 8000 });
  await page.mouse.move(200, 300);
  await expect(kiosk(page)).not.toHaveClass(/is-idle/);
});

// The readable work with the longest table of contents: taller than its column.
const longTocId = (page) => page.evaluate(async () => {
  await window.OATocLoad;
  const data = await window.OAData.load("data/abstract_data.js", "ABSTRACT_DATA");
  const rows = new Set(window.ARTICLES_DATA.map((r) => r.id));
  let best = null, most = 0;
  data.records.forEach((r) => {
    const toc = window.TOC_DATA[r.id];
    if (rows.has(r.id) && r.sentences && r.sentences.length && toc && toc.length > most) { best = r.id; most = toc.length; }
  });
  return best;
});

test("kiosk mode sets abstract, contents and list side by side with the QR code top right, and a long table of contents moves up with the reading", async ({ page }) => {
  await stubSpeech(page);
  await page.goto("/");
  await enter(page);
  const id = await longTocId(page);
  await page.goto("/?kiosk&q=" + encodeURIComponent('ID IS "' + id + '"'));
  await expect(kioskKey(page)).toHaveText(id);
  await expect(page.locator(".oa-kiosk-toc .entry .page").first()).not.toBeEmpty();
  await expect(page.locator(".oa-kiosk-qr svg")).toBeVisible();
  await expect(page.locator(".oa-kiosk-qr svg")).toHaveAttribute("viewBox", "0 0 37 37");   // one size for every link
  const rect = (sel) => page.locator(sel).evaluate((n) => n.getBoundingClientRect().toJSON());
  const [text, toc, side, qr, title] = await Promise.all([".oa-kiosk-text", ".oa-kiosk-toc", ".oa-kiosk-side", ".oa-kiosk-qr", ".oa-kiosk-title"].map(rect));
  expect(text.right).toBeLessThan(toc.left);
  expect(toc.right).toBeLessThan(side.left);
  expect(Math.abs(qr.right - side.right)).toBeLessThan(1);   // the work's right edge
  expect(qr.top).toBeLessThanOrEqual(title.top + 1);         // level with the title
  expect(qr.bottom).toBeLessThan(side.top);
  const view = page.locator(".oa-kiosk-toc-view");
  expect(await view.evaluate((v) => v.firstElementChild.offsetHeight > v.clientHeight)).toBe(true);
  await expect(view).toHaveClass(/is-above/, { timeout: 20000 });   // moved up, faded at the top
});

// The readable work with the most authors: its list is the longest there is.
const crowdedId = (page) => page.evaluate(async () => {
  const data = await window.OAData.load("data/abstract_data.js", "ABSTRACT_DATA");
  const readable = new Set(data.records.filter((r) => r.sentences && r.sentences.length).map((r) => r.id));
  return window.ARTICLES_DATA.filter((r) => readable.has(r.id))
    .reduce((a, b) => ((b.authors || []).length > (a.authors || []).length ? b : a)).id;
});

test("a kiosk list too long for its room is shortened to fit and refitted on a resize; every 16:9 size shows the same; 4:3 keeps the 16:9 proportions", async ({ page }) => {
  await stubSpeech(page);
  // Full screen refused, so kiosk mode runs in the window and the window can be resized.
  await page.addInitScript(() => { Element.prototype.requestFullscreen = () => Promise.reject(new Error("refused")); });
  await page.goto("/");
  await enter(page);
  const id = await crowdedId(page);
  // 960x540 is under the type's 12px floor (a 60th would be 9px), so the
  // room there is smaller than any 16:9 screen above it gets: the longest
  // list does not fit.
  await page.setViewportSize({ width: 960, height: 540 });
  await page.goto("/?kiosk&q=" + encodeURIComponent('ID IS "' + id + '"'));
  await expect(kioskKey(page)).toHaveText(id);
  await expect(kiosk(page)).toHaveCSS("font-size", "12px");
  const fits = () => page.locator(".oa-kiosk-meta").evaluate((m) => m.scrollHeight - m.clientHeight <= 1);
  // How many items the list leaves out, over its "+N more" markers.
  const left = () => page.locator(".oa-kiosk-meta").evaluate((m) =>
    [...m.querySelectorAll(".oa-kiosk-more")].reduce((n, x) => n + Number(x.textContent.replace(/\D/g, "")), 0));
  const settled = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await expect(page.locator(".oa-kiosk-meta .oa-kiosk-more").first()).toHaveText(/^\+[\d\u202F]+ more$/);
  expect(await fits()).toBe(true);
  const before = await left();
  // A 1080p screen (18px) has more room: less is left out.
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(kiosk(page)).toHaveCSS("font-size", "18px");
  await expect.poll(left).toBeLessThan(before);
  expect(await fits()).toBe(true);
  const at1080 = await left();
  // Another 16:9 size shows the same picture, so the list leaves out as much.
  await page.setViewportSize({ width: 1280, height: 720 });
  await expect(kiosk(page)).toHaveCSS("font-size", "12px");
  await settled();
  expect(await left()).toBe(at1080);
  // 4:3: the width caps the type, so the layout keeps the 16:9 proportions.
  await page.setViewportSize({ width: 1600, height: 1200 });
  await expect(kiosk(page)).toHaveCSS("font-size", "15px");   // .9375vw
  await settled();
  expect(await fits()).toBe(true);
});

test("a kiosk link without a click says the voice is held back, and the first click brings it", async ({ page }) => {
  await stubSpeech(page, true);
  await page.goto("/?kiosk");
  await expect(kiosk(page)).toBeVisible();
  await expect(page.locator(".oa-kiosk-hint")).toBeVisible();
  expect(await page.evaluate(() => window.__spoken.length)).toBe(0);
  await page.mouse.click(8, 400);
  await expect(page.locator(".oa-kiosk-hint")).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBeGreaterThan(0);
});

test("a kiosk link without a click: the first key brings the voice and does nothing else (Enter does not close)", async ({ page }) => {
  await stubSpeech(page, true);
  await page.goto("/?kiosk");
  await expect(page.locator(".oa-kiosk-hint")).toBeVisible();
  // The overlay holds the focus, not a button: Enter has nothing to press.
  expect(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains("oa-kiosk"))).toBe(true);
  await page.keyboard.press("Enter");
  await expect(page.locator(".oa-kiosk-hint")).toBeHidden();
  await expect(kiosk(page)).toBeVisible();
  await expect(kiosk(page)).not.toHaveClass(/is-paused/);
  await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBeGreaterThan(0);
});

test.describe("on a touch screen", () => {
  test.use({ hasTouch: true });
  test("a kiosk link without a click: the first tap brings the voice", async ({ page }) => {
    await stubSpeech(page, true);
    await page.goto("/?kiosk");
    await expect(page.locator(".oa-kiosk-hint")).toBeVisible();
    await page.touchscreen.tap(200, 400);
    await expect(page.locator(".oa-kiosk-hint")).toBeHidden();
    await expect.poll(() => page.evaluate(() => window.__spoken.length)).toBeGreaterThan(0);
  });
});

test("while the kiosk runs the page underneath takes no focus and no keys", async ({ page }) => {
  await stubSpeech(page);
  await page.goto("/");
  await enter(page);
  await page.locator(".oa-toprow .oa-kiosk-btn").click();
  await expect(page.locator(".oa-kiosk-title")).not.toBeEmpty();
  expect(await page.locator("#articles-app").evaluate((n) => n.closest("[inert]") !== null)).toBe(true);
  await page.keyboard.press("/");   // the table's shortcut to its search box
  expect(await page.evaluate(() => document.activeElement && document.activeElement.id)).not.toBe("semanticSearch");
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest(".oa-kiosk") || document.activeElement === document.body)).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(kiosk(page)).toHaveCount(0);
  expect(await page.locator("#articles-app").evaluate((n) => n.closest("[inert]") === null)).toBe(true);
});

test("kiosk mode plays the marked rows when rows are marked", async ({ page }) => {
  await stubSpeech(page);
  await page.goto("/");
  await enter(page);
  // Mark the first three works with a drag down the first column, below the
  // abstract toggle (a press on a button or a link starts no drag). Rows by
  // screen position: SlickGrid adds rows to the DOM in the order it renders them.
  await page.evaluate(() => document.fonts.ready);
  const at = await page.evaluate((sel) => [...document.querySelectorAll(sel)]
    .map((c) => c.getBoundingClientRect()).filter((b) => b.height > 0)
    .sort((a, b) => a.top - b.top).map((b) => ({ x: b.left + 10, y: b.top + 60 })), ROW + ".oa-row-head .slick-cell.l0");
  await page.mouse.move(at[0].x, at[0].y);
  await page.mouse.down();
  await page.mouse.move(at[2].x, at[2].y, { steps: 4 });
  await page.mouse.up();
  const ids = await page.evaluate(() => window.OAArticlesGrid.targetIds());
  expect(ids.length).toBe(3);
  const readable = await page.evaluate(async (marked) => {
    const data = await window.OAData.load("data/abstract_data.js", "ABSTRACT_DATA");
    const has = new Set(data.records.filter((r) => r.sentences && r.sentences.length).map((r) => r.id));
    return marked.filter((id) => has.has(id));
  }, ids);
  await page.locator(".oa-toprow .oa-kiosk-btn").click();
  await expect(page.locator(".oa-kiosk-count")).toHaveText("1 / " + readable.length);
  expect(readable).toContain(await kioskKey(page).innerText());
});

test("paused, the kiosk stays on its work; muted, it goes on in silence; unmuting while paused keeps the pause", async ({ page }) => {
  await stubSpeech(page);
  await page.goto("/");
  await enter(page);
  await page.locator(".oa-toprow .oa-kiosk-btn").click();
  await expect(page.locator(".oa-kiosk-title")).not.toBeEmpty();
  const spoken = () => page.evaluate(() => window.__spoken.length);
  const bar = () => page.locator(".oa-kiosk-bar > span").evaluate((s) => Number((/scaleX\(([\d.]+)\)/.exec(s.style.transform) || [0, 0])[1]));
  await page.keyboard.press("m");
  await expect(page.locator('.oa-kiosk-btn[aria-label="Mute (M)"]')).toHaveAttribute("aria-pressed", "true");
  const said = await spoken();
  await expect.poll(bar, { timeout: 10000 }).toBeGreaterThan(0);   // the silent reading runs
  await page.waitForTimeout(1500);
  expect(await spoken()).toBe(said);                               // ... in silence
  const key = await kioskKey(page).innerText();
  await page.keyboard.press(" ");
  await expect(kiosk(page)).toHaveClass(/is-paused/);
  await page.waitForTimeout(400);                                  // the hairline's last tick before the pause
  const held = await bar();
  await page.waitForTimeout(1500);
  expect(await bar()).toBe(held);                                  // paused: nothing moves
  await expect(kioskKey(page)).toHaveText(key);
  await page.keyboard.press("m");                                  // unmute while paused
  await expect(kiosk(page)).toHaveClass(/is-paused/);
  await page.waitForTimeout(1500);
  expect(await spoken()).toBe(said);                               // still held: no voice yet
  await page.keyboard.press(" ");
  await expect.poll(spoken, { timeout: 10000 }).toBeGreaterThan(said);   // on, aloud
});

test("in portrait the abstract runs across the top, contents and list side by side under it, no more than half the room", async ({ page }) => {
  await stubSpeech(page);
  await page.goto("/");
  await enter(page);
  const id = await crowdedId(page);
  await page.setViewportSize({ width: 540, height: 960 });
  await page.goto("/?kiosk&q=" + encodeURIComponent('ID IS "' + id + '"'));
  await expect(kioskKey(page)).toHaveText(id);
  const rect = (sel) => page.locator(sel).evaluate((n) => n.getBoundingClientRect().toJSON());
  const [body, text, toc, side, qr, title] = await Promise.all([".oa-kiosk-body", ".oa-kiosk-text", ".oa-kiosk-toc", ".oa-kiosk-side", ".oa-kiosk-qr", ".oa-kiosk-title"].map(rect));
  expect(text.bottom).toBeLessThan(toc.top);
  expect(Math.abs(toc.top - side.top)).toBeLessThan(1);
  expect(toc.right).toBeLessThan(side.left);
  expect(side.height).toBeLessThanOrEqual(body.height / 2 + 1);   // the longest list, held to half
  expect(qr.top).toBeLessThanOrEqual(title.top + 1);
  const fits = await page.locator(".oa-kiosk-meta").evaluate((m) => m.scrollHeight - m.clientHeight <= 1);
  expect(fits).toBe(true);
});

test("on a short window the citation matrix's readout stays in sight while the lower rows are pointed at", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 540 });
  await page.goto("/adjacency.html");
  await expect(page.locator("[data-adj-key]")).toContainText("works", { timeout: 120000 });
  const canvas = page.locator("#adj canvas");
  await canvas.scrollIntoViewIfNeeded();
  await page.mouse.move(1220, 500);
  await page.mouse.wheel(0, 400);   // down to the last rows
  await page.waitForTimeout(400);
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + 160, box.y + box.height - 76);
  await expect(page.locator(".adj-ro-a .adj-ro-id")).toBeVisible();
  const geo = await page.evaluate(() => ({
    header: document.querySelector(".oa-top").getBoundingClientRect().bottom,
    id: document.querySelector(".adj-ro-a .adj-ro-id").getBoundingClientRect().top
  }));
  expect(geo.id).toBeGreaterThanOrEqual(geo.header);   // it slid behind the sticky header
});

test.describe("on a touch screen", () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  test("a tapped dot on the affiliation map keeps its tip", async ({ page }) => {
    await page.goto("/map-affiliations.html");
    await page.waitForSelector("#oa-map[data-state=ready] svg", { timeout: 120000 });
    const dot = await page.evaluate(() => {
      const b = [...document.querySelectorAll("circle.oa-map-dot")].map((c) => c.getBoundingClientRect()).find((r) => r.width >= 8);
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    });
    await page.touchscreen.tap(dot.x, dot.y);
    await page.waitForTimeout(1500);   // the zoom to its country
    await expect(page.locator(".oa-map-tip")).toBeVisible();   // it was cleared as the gesture began
  });
});

test.describe("on a touch tablet", () => {
  test.use({ viewport: { width: 1194, height: 834 }, hasTouch: true });
  test("a row's tiles, author marks and chips take a 24px tap", async ({ page }) => {
    await page.goto("/");
    await enter(page);
    const m = await page.evaluate(() => {
      const rows = [...document.querySelectorAll("#myGrid .slick-row.oa-row-head")];
      const pitch = (sel) => {
        for (const r of rows) {
          const els = [...r.querySelectorAll(sel)].map((e) => e.getBoundingClientRect().top);
          if (els.length > 1) return Math.round(els[1] - els[0]);
        }
        return null;
      };
      // How tall a tap on the chip reaches: probed up and down from its centre.
      const chip = rows.map((r) => r.querySelector(".category-cell .oa-cat-chip")).find(Boolean);
      const b = chip.getBoundingClientRect(), x = b.left + b.width / 2, y = b.top + b.height / 2;
      let up = 0, down = 0;
      while (up < 20 && chip.contains(document.elementFromPoint(x, y - up - 1))) up++;
      while (down < 20 && chip.contains(document.elementFromPoint(x, y + down + 1))) down++;
      return { coarse: matchMedia("(any-pointer: coarse)").matches, tiles: pitch(".fav-stack > button"), authors: pitch(".author-cell .author-row"), chipTap: up + down + 1 };
    });
    expect(m.coarse).toBe(true);
    expect(m.tiles).toBeGreaterThanOrEqual(24);     // 22 before
    expect(m.authors).toBeGreaterThanOrEqual(24);   // 22 before
    expect(m.chipTap).toBeGreaterThanOrEqual(24);   // 18 before
  });
});

test("author cells show whole names, and their \"+N\" counts the rest", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await enter(page);
  const r = await authorCellsWhole(page);
  expect(r.cells).toBeGreaterThan(20);
  expect(r.bad).toEqual([]);   // 9 of 63 articles cut a name or their "+N"
  // Wider than a phone, every name keeps its mark slots and its given name.
  const rows = await page.evaluate(() => [...document.querySelectorAll("#myGrid .slick-cell > .author-cell .author-row:not(.author-row--etal)")]
    .map((r) => r.querySelectorAll(".author-orcid").length));
  expect(rows.length).toBeGreaterThan(20);
  expect(rows.filter((n) => n !== 1)).toEqual([]);
  expect(await page.locator("#myGrid .author-cell--compact").count()).toBe(0);
});

test("the Date header still toggles both ways, and other headers take a third click back to newest first", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  const head = (name) => page.locator("#myGrid .slick-header-column").filter({ hasText: name });
  const sortBy = () => page.evaluate(() => new URLSearchParams(location.search).get("SORT_BY"));
  await head("Date").click();
  await expect.poll(sortBy).toBe("OLD");
  await head("Date").click();
  await expect.poll(sortBy).toBe("NEW");
  await head("Date").click();
  await expect.poll(sortBy).toBe("OLD");
  for (const want of ["VENUE", "VENUE_DESC", "NEW"]) {
    await head("Venue").click();
    await expect.poll(sortBy).toBe(want);
  }
  await expect(head("Date")).toHaveAttribute("aria-sort", "descending");
});

// WCAG contrast of a CSS colour (rgb()/rgba(), with an extra opacity) over an
// opaque ground, both as getComputedStyle reports them.
function contrast(fg, bg, opacity) {
  const rgb = (s) => s.match(/[\d.]+/g).slice(0, 4).map(Number);
  const [r, g, b, a = 1] = rgb(fg), [R, G, B] = rgb(bg), k = a * (opacity == null ? 1 : opacity);
  const lum = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = (x, y, z) => 0.2126 * lum(x) + 0.7152 * lum(y) + 0.0722 * lum(z);
  const l1 = L(k * r + (1 - k) * R, k * g + (1 - k) * G, k * b + (1 - k) * B), l2 = L(R, G, B);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test("rule placeholders and the idle sort arrows keep their contrast on every theme", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  for (const theme of ["mint", "dark", "light"]) {
    await page.evaluate((t) => localStorage.setItem("oa-scheme", t), theme);
    await page.goto("/?q=" + encodeURIComponent('KEYWORD IS "#rheology"'));   // its value box has a placeholder
    await expect(page.locator(ROW).first()).toBeVisible();
    await page.locator("#ruleBuilderToggle").click();
    const m = await page.evaluate(() => {
      const ground = getComputedStyle(document.querySelector(".oa-root")).backgroundColor;
      const input = document.querySelector("#ruleBuilderBody input.rule-value");
      input.value = "";
      const icon = [...document.querySelectorAll("#myGrid .slick-header-column:not(.slick-header-column-sorted) .col-sort-icon")][0];
      return { ground, placeholder: getComputedStyle(input, "::placeholder").color, icon: getComputedStyle(icon).color, opacity: getComputedStyle(icon).opacity };
    });
    expect(contrast(m.placeholder, m.ground), theme + " placeholder").toBeGreaterThanOrEqual(4.5);   // 4.0 on mint
    expect(contrast(m.icon, m.ground, Number(m.opacity)), theme + " sort arrows").toBeGreaterThanOrEqual(3);   // 2.8 on light
  }
});

// The stylesheets set no !important against their own rules: three rules win
// on specificity instead. These are the layouts those three hold.
test("a rule's selects fill their box, the height probe stays off screen, and a phone drop stacks its contents", async ({ page }) => {
  await page.goto("/");
  await enter(page);
  await page.goto("/?q=" + encodeURIComponent('(AUTHOR IS "bos_freek" OR KEYWORD CONTAINS "rheology") AND TITLE CONTAINS "print"'));
  await expect(page.locator(ROW).first()).toBeVisible();
  await page.locator("#ruleBuilderToggle").click();
  await expect(page.locator("#ruleBuilderBody")).toBeVisible();
  const selects = await page.evaluate(() => [...document.querySelectorAll("#ruleBuilderBody .rule-select-wrap > select")].map((s) => ({
    fills: s.getBoundingClientRect().height === s.parentElement.clientHeight,
    bracket: s.parentElement.classList.contains("rule-paren"), inset: getComputedStyle(s).paddingLeft
  })));
  expect(selects.length).toBeGreaterThan(4);
  expect(selects.filter((s) => !s.fills)).toEqual([]);                          // 28px tall in a 26px box
  expect(selects.filter((s) => s.bracket && s.inset !== "2px")).toEqual([]);   // the bracket cells' narrow inset
  await page.locator("#myGrid .slick-row.oa-row-head .abstract-toggle").first().click();
  await expect(page.locator("#myGrid .slick-viewport .abs-drop").first()).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.querySelector("#myGrid > .abs-drop-measure")).position)).toBe("fixed");   // relative, it sat in the grid
  await page.setViewportSize({ width: 390, height: 844 });
  const id = await page.evaluate(async () => {
    const toc = await window.OAData.load("data/toc_data.js", "TOC_DATA");
    const abs = await window.OAData.load("data/abstract_data.js", "ABSTRACT_DATA");
    const read = new Set(abs.records.filter((r) => r.sentences && r.sentences.length).map((r) => r.id));
    const rows = new Set(window.ARTICLES_DATA.map((r) => r.id));
    return Object.keys(toc).find((k) => rows.has(k) && read.has(k) && toc[k].length >= 4);
  });
  await page.goto("/?q=" + encodeURIComponent('ID IS "' + id + '"'));
  const toggle = page.locator("#myGrid .slick-row.oa-row-head .abstract-toggle").first();
  await expect(toggle).toBeVisible();
  await page.waitForTimeout(1000);
  if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();   // a one-article link may open it itself
  await expect(page.locator("#myGrid .slick-viewport .abs-has-toc .abs-toc").first()).toBeVisible();
  const drop = await page.evaluate(() => {
    const main = document.querySelector("#myGrid .slick-viewport .abs-has-toc .abs-drop-main"), toc = main.parentElement.querySelector(".abs-toc");
    const flex = (el) => { const cs = getComputedStyle(el); return cs.flexGrow + " " + cs.flexShrink + " " + cs.flexBasis; };
    return { flex: [flex(main), flex(toc)], stacked: toc.getBoundingClientRect().top >= main.getBoundingClientRect().bottom - 1 };
  });
  expect(drop.flex).toEqual(["0 0 auto", "0 0 auto"]);   // the side-by-side flex gave the abstract a height basis
  expect(drop.stacked).toBe(true);
});
