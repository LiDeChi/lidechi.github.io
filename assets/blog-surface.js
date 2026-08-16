/**
 * Dense blog surface for the GitHub Pages Quarto site.
 * Modes: preview stream (month scale + archive) → immersive (+ right TOC).
 */
(() => {
  const listing = document.querySelector(".quarto-listing");
  if (!listing || listing.dataset.blogSurface === "ready") return;

  const posts = Array.from(listing.querySelectorAll(".quarto-post"));
  if (!posts.length) return;

  listing.dataset.blogSurface = "ready";
  document.documentElement.dataset.blogSurface = "preview";

  const state = {
    mode: "preview",
    activeIndex: 0,
    cache: new Map(),
  };

  function cleanText(value) {
    return String(value || "")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function collectPlainFromArticle(article) {
    if (!article) return "";
    const chunks = [];
    const push = (v) => {
      const t = cleanText(typeof v === "string" ? v : v?.zh || v?.en || "");
      if (t) chunks.push(t);
    };
    push(article.summary);
    push(article.note);
    for (const block of article.blocks || []) {
      if (
        block.type === "paragraph" ||
        block.type === "callout" ||
        block.type === "heading"
      ) {
        push(block.text);
      } else if (block.type === "list") {
        for (const item of block.items || []) push(item);
      }
    }
    for (const p of article.paragraphs || []) push(p);
    return cleanText(chunks.join(" "));
  }

  function previewParts(text) {
    const full = cleanText(text);
    if (!full) return { html: "", expandable: false };
    return { html: escapeHtml(full), expandable: false };
  }

  function postHref(post) {
    const link =
      post.querySelector(".listing-title a") ||
      post.querySelector("a.no-external") ||
      post.querySelector("a[href]");
    return link ? link.getAttribute("href") : null;
  }

  function postTitle(post) {
    return cleanText(
      post.querySelector(".listing-title")?.textContent ||
        post.querySelector("h3")?.textContent ||
        "",
    );
  }

  function postDate(post) {
    return cleanText(post.querySelector(".listing-date")?.textContent || "");
  }

  function postDescription(post) {
    return cleanText(
      post.querySelector(".listing-description")?.textContent || "",
    );
  }

  function hrefKey(href) {
    if (!href) return "";
    try {
      const url = new URL(href, window.location.href);
      return url.pathname.replace(/\/+$/, "").split("/").pop() || "";
    } catch {
      return href.split("/").pop() || "";
    }
  }

  /**
   * Parse listing dates such as "2026年7月23日", "2026-07-23", "2026.07.23".
   */
  function parseMonth(dateStr) {
    const s = cleanText(dateStr);
    let m = s.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
    if (m) {
      const year = m[1];
      const month = Number(m[2]);
      return {
        key: `${year}-${String(month).padStart(2, "0")}`,
        year,
        month,
        label: `${year}年${month}月`,
      };
    }
    m = s.match(/(\d{4})[-./](\d{1,2})(?:[-./]\d{1,2})?/);
    if (m) {
      const year = m[1];
      const month = Number(m[2]);
      return {
        key: `${year}-${String(month).padStart(2, "0")}`,
        year,
        month,
        label: `${year}年${month}月`,
      };
    }
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const year = String(d.getFullYear());
      const month = d.getMonth() + 1;
      return {
        key: `${year}-${String(month).padStart(2, "0")}`,
        year,
        month,
        label: `${year}年${month}月`,
      };
    }
    return {
      key: "unknown",
      year: "",
      month: 0,
      label: "未标注",
    };
  }

  // Shell — preview only (+ immersive)
  const shell = document.createElement("div");
  shell.className = "blog-surface-shell";
  shell.innerHTML = `
    <div class="blog-browse" data-browse>
      <div class="blog-browse-layout">
        <div class="blog-preview-stack" data-preview-main></div>
        <div class="blog-archive" aria-label="有文章的年月" data-archive role="navigation"></div>
      </div>
    </div>
    <div class="blog-immersive" data-panel="immersive" hidden>
      <div class="blog-immersive-layout">
        <article class="blog-immersive-article">
          <h1 class="blog-immersive-title"></h1>
          <div class="blog-immersive-body"></div>
        </article>
        <div class="blog-toc" aria-label="大纲" role="navigation">
          <div class="blog-toc-label">大纲</div>
          <nav class="blog-toc-nav"></nav>
        </div>
      </div>
    </div>
    <div class="blog-media-lightbox" data-media-lightbox role="dialog" aria-modal="true" aria-label="查看插图" hidden>
      <button type="button" class="blog-media-lightbox-close" data-media-lightbox-close aria-label="关闭插图">关闭</button>
      <figure class="blog-media-lightbox-figure">
        <img class="blog-media-lightbox-image" data-media-lightbox-image alt="" />
        <figcaption class="blog-media-lightbox-caption" data-media-lightbox-caption hidden></figcaption>
      </figure>
    </div>
    <div class="blog-reading-dock" aria-label="博客阅读控制" hidden>
      <button type="button" class="blog-dock-secondary" data-dock="catalog">返回目录</button>
      <div class="blog-dock-cluster" data-dock-cluster="prev">
        <div class="blog-dock-menu" data-dock-menu="prev" aria-label="前面的文章"></div>
        <button type="button" class="blog-dock-nav" data-dock="prev" disabled>
          <span class="blog-dock-label">上一篇</span>
          <span class="blog-dock-text" data-dock="prev-text"></span>
        </button>
      </div>
      <div class="blog-dock-cluster" data-dock-cluster="next">
        <div class="blog-dock-menu" data-dock-menu="next" aria-label="后面的文章"></div>
        <button type="button" class="blog-dock-nav blog-dock-primary" data-dock="next" disabled>
          <span class="blog-dock-label">下一篇</span>
          <span class="blog-dock-text" data-dock="next-text"></span>
        </button>
      </div>
    </div>
  `;

  listing.classList.add("blog-surface-source");
  listing.setAttribute("aria-hidden", "true");
  listing.after(shell);

  document
    .querySelector("#title-block-header")
    ?.classList.add("blog-title-hidden");

  const browseRoot = shell.querySelector("[data-browse]");
  const previewMain = shell.querySelector("[data-preview-main]");
  const archiveEl = shell.querySelector("[data-archive]");
  const immersive = shell.querySelector('[data-panel="immersive"]');
  const immersiveTitle = shell.querySelector(".blog-immersive-title");
  const immersiveBody = shell.querySelector(".blog-immersive-body");
  const toc = shell.querySelector(".blog-toc");
  const tocNav = shell.querySelector(".blog-toc-nav");
  const mediaLightbox = shell.querySelector("[data-media-lightbox]");
  const mediaLightboxImage = shell.querySelector("[data-media-lightbox-image]");
  const mediaLightboxCaption = shell.querySelector("[data-media-lightbox-caption]");
  const mediaLightboxClose = shell.querySelector("[data-media-lightbox-close]");
  const dockCatalog = shell.querySelector('[data-dock="catalog"]');
  const dockPrev = shell.querySelector('[data-dock="prev"]');
  const dockNext = shell.querySelector('[data-dock="next"]');
  const dockPrevText = shell.querySelector('[data-dock="prev-text"]');
  const dockNextText = shell.querySelector('[data-dock="next-text"]');
  const dockPrevMenu = shell.querySelector('[data-dock-menu="prev"]');
  const dockNextMenu = shell.querySelector('[data-dock-menu="next"]');

  function renderPreviewHtml(item) {
    const source = item.fullText || item.description || "";
    const parts = previewParts(source);
    const textHtml = parts.html
      ? `<p class="blog-preview-text">${parts.html}</p>`
      : "";
    return `
      <button type="button" class="blog-preview-hit" aria-label="展开：${escapeHtml(item.title)}">
        <h2 class="blog-preview-title">${escapeHtml(item.title)}</h2>
        ${textHtml}
      </button>
    `;
  }

  function updatePreviewTruncation(root = previewMain) {
    window.requestAnimationFrame(() => {
      root.querySelectorAll(".blog-preview-text").forEach((text) => {
        text.classList.toggle(
          "is-truncated",
          text.scrollHeight > text.clientHeight + 1,
        );
      });
    });
  }

  function makeMonthLabel(group) {
    const label = document.createElement("div");
    label.className = "blog-month-label";
    label.setAttribute("aria-label", group.label);
    // Always show year + month together, e.g. 2026年 / 7月
    if (group.year && group.month) {
      label.innerHTML =
        `<span class="blog-month-year">${escapeHtml(group.year)}年</span>` +
        `<span class="blog-month-num">${escapeHtml(String(group.month))}月</span>`;
    } else {
      label.textContent = group.label;
    }
    return label;
  }

  const items = posts
    .map((post) => {
      const href = postHref(post);
      const title = postTitle(post);
      const date = postDate(post);
      const month = parseMonth(date);
      const description = postDescription(post);
      return {
        post,
        href,
        title,
        date,
        month,
        description,
        fullText: description,
        key: hrefKey(href),
      };
    })
    .filter((item) => item.title && item.href)
    .map((item, index) => {
      const entry = document.createElement("article");
      entry.className = "blog-preview-item";
      entry.dataset.index = String(index);
      entry.dataset.month = item.month.key;
      entry.innerHTML = renderPreviewHtml(item);
      return { ...item, card: entry };
    });

  if (!items.length) return;

  // Month-grouped preview + right archive
  const monthOrder = [];
  const monthMap = new Map();
  for (const item of items) {
    const key = item.month.key;
    if (!monthMap.has(key)) {
      monthMap.set(key, {
        key,
        label: item.month.label,
        year: item.month.year,
        month: item.month.month,
        items: [],
      });
      monthOrder.push(key);
    }
    monthMap.get(key).items.push(item);
  }

  for (const key of monthOrder) {
    const group = monthMap.get(key);
    const section = document.createElement("section");
    section.className = "blog-month-group";
    section.dataset.month = key;
    section.id = `preview-month-${key}`;

    const postsCol = document.createElement("div");
    postsCol.className = "blog-month-posts";
    for (const item of group.items) {
      postsCol.appendChild(item.card);
    }

    section.appendChild(makeMonthLabel(group));
    section.appendChild(postsCol);
    previewMain.appendChild(section);
  }

  updatePreviewTruncation();
  window.addEventListener("resize", () => updatePreviewTruncation());

  function scrollToMonth(key) {
    const target = previewMain.querySelector(
      `.blog-month-group[data-month="${key}"]`,
    );
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    archiveEl.querySelectorAll(".blog-archive-item").forEach((n) => {
      n.classList.toggle("is-active", n.dataset.month === key);
    });
  }

  for (const key of monthOrder) {
    const group = monthMap.get(key);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "blog-archive-item";
    btn.dataset.month = key;
    btn.innerHTML = `${escapeHtml(group.label)}<span class="blog-archive-count">（${group.items.length}）</span>`;
    btn.setAttribute(
      "aria-label",
      `${group.label}，${group.items.length} 篇文章`,
    );
    btn.addEventListener("click", () => scrollToMonth(key));
    archiveEl.appendChild(btn);
  }

  fetch(new URL("articles.json", window.location.href).href, {
    credentials: "same-origin",
    cache: "no-cache",
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((arts) => {
      if (!Array.isArray(arts)) return;
      const byKey = new Map();
      for (const art of arts) {
        const fromSource = hrefKey(art.sourceUrl || "");
        if (fromSource) byKey.set(fromSource, art);
        if (art.id) byKey.set(`${art.id}.html`, art);
        if (art.id) byKey.set(art.id, art);
      }
      for (const item of items) {
        const art =
          byKey.get(item.key) ||
          byKey.get(item.key.replace(/\.html$/u, "")) ||
          null;
        const plain = collectPlainFromArticle(art);
        if (plain.length > cleanText(item.fullText).length) {
          item.fullText = plain;
          item.card.innerHTML = renderPreviewHtml(item);
          item.card
            .querySelector(".blog-preview-hit")
            ?.addEventListener("click", () => {
              openImmersive(Number(item.card.dataset.index));
            });
          updatePreviewTruncation(item.card);
        }
      }
    })
    .catch(() => {});

  function buildToc(root) {
    tocNav.innerHTML = "";
    const heads = Array.from(
      root.querySelectorAll("h2, h3, h4, .anchored"),
    ).filter((el) => {
      const tag = el.tagName.toLowerCase();
      return tag === "h2" || tag === "h3" || tag === "h4";
    });
    toc.hidden = heads.length === 0;
    if (!heads.length) {
      return;
    }
    heads.forEach((el, i) => {
      if (!el.id) el.id = `blog-h-${i}`;
      const level = Number(el.tagName.slice(1)) || 2;
      const a = document.createElement("a");
      a.href = `#${el.id}`;
      a.className = `blog-toc-link blog-toc-h${level}`;
      a.textContent = cleanText(el.textContent).replace(/^§\s*\d+\s*/u, "");
      a.addEventListener("click", (event) => {
        event.preventDefault();
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        tocNav
          .querySelectorAll(".blog-toc-link")
          .forEach((n) => n.classList.remove("is-active"));
        a.classList.add("is-active");
      });
      tocNav.appendChild(a);
    });
  }

  async function loadArticle(item) {
    if (!item.href) throw new Error("missing href");
    if (state.cache.has(item.href)) return state.cache.get(item.href);

    const response = await fetch(item.href, { credentials: "same-origin" });
    if (!response.ok) throw new Error(`fetch failed: ${response.status}`);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    const main =
      doc.querySelector("main#quarto-document-content") ||
      doc.querySelector("main.content") ||
      doc.querySelector("main") ||
      doc.body;
    const clone = main.cloneNode(true);
    clone.querySelector("#title-block-header")?.remove();
    clone.querySelector("header#title-block-header")?.remove();
    clone.querySelector(".quarto-title-block")?.remove();
    clone.querySelector("nav.quarto-secondary-nav")?.remove();
    clone.querySelector("#quarto-appendix")?.remove();
    clone
      .querySelectorAll(".quarto-appendix, .quarto-appendix-contents")
      .forEach((node) => node.remove());

    let bodyHtml = clone.innerHTML.trim();
    if (!cleanText(clone.textContent)) {
      const description = cleanText(
        doc.querySelector(".description")?.textContent ||
          item.fullText ||
          item.description,
      );
      bodyHtml = description
        ? `<p>${escapeHtml(description)}</p>`
        : `<p><a href="${item.href}">打开原页面</a></p>`;
    }
    const payload = {
      title:
        cleanText(doc.querySelector("h1.title")?.textContent) || item.title,
      bodyHtml,
    };
    state.cache.set(item.href, payload);
    return payload;
  }

  function renderDockMenu(menu, nearbyItems, direction) {
    menu.replaceChildren();
    nearbyItems.forEach((item) => {
      const entry = document.createElement("button");
      entry.type = "button";
      entry.className = "blog-dock-menu-item";
      entry.dataset.dockIndex = String(items.indexOf(item));
      entry.innerHTML = `
        <span class="blog-dock-menu-label">${direction}</span>
        <span class="blog-dock-menu-title">${escapeHtml(item.title)}</span>
      `;
      menu.append(entry);
    });
  }

  function updateDock() {
    const prev = items[state.activeIndex - 1] || null;
    const next = items[state.activeIndex + 1] || null;
    const nearbyPrev = items
      .slice(Math.max(0, state.activeIndex - 3), state.activeIndex)
      .reverse();
    const nearbyNext = items.slice(state.activeIndex + 1, state.activeIndex + 4);

    dockCatalog.textContent = "返回目录";

    dockPrev.disabled = !prev;
    dockPrev.querySelector(".blog-dock-label").textContent = "上一篇";
    dockPrevText.textContent = prev ? prev.title : "";

    dockNext.disabled = !next;
    dockNext.querySelector(".blog-dock-label").textContent = "下一篇";
    dockNextText.textContent = next ? next.title : "已经到最后一篇";

    renderDockMenu(dockPrevMenu, nearbyPrev, "上一篇");
    renderDockMenu(dockNextMenu, nearbyNext, "下一篇");
  }

  function setMode(mode) {
    state.mode = mode;
    document.documentElement.dataset.blogSurface = mode;
    document.body.classList.toggle("blog-is-immersive", mode === "immersive");
    document.body.classList.toggle("blog-is-preview", mode === "preview");

    browseRoot.hidden = mode !== "preview";
    immersive.hidden = mode !== "immersive";
    shell.querySelector(".blog-reading-dock").hidden = mode !== "immersive";

    updateDock();

    items.forEach((item, index) => {
      item.card.classList.toggle("is-active", index === state.activeIndex);
    });

    if (mode === "preview") {
      const key = items[state.activeIndex]?.month?.key;
      archiveEl.querySelectorAll(".blog-archive-item").forEach((n) => {
        n.classList.toggle("is-active", n.dataset.month === key);
      });
    }
  }

  let mathEnginePromise;

  function loadMathEngine() {
    if (window.MathJax || window.katex) return Promise.resolve();
    if (mathEnginePromise) return mathEnginePromise;

    mathEnginePromise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        "script[data-blog-mathjax], script[src*='mathjax']",
      );
      const ready = async () => {
        try {
          await window.MathJax?.startup?.promise;
          if (window.MathJax || window.katex) resolve();
          else reject(new Error("math engine unavailable"));
        } catch (error) {
          reject(error);
        }
      };

      if (existing) {
        existing.addEventListener("load", ready, { once: true });
        existing.addEventListener("error", () => reject(new Error("math engine failed to load")), { once: true });
        return;
      }

      const script = document.createElement("script");
      script.dataset.blogMathjax = "true";
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-chtml-full.js";
      script.async = true;
      script.addEventListener("load", ready, { once: true });
      script.addEventListener("error", () => reject(new Error("math engine failed to load")), { once: true });
      document.head.append(script);
    }).catch((error) => {
      mathEnginePromise = undefined;
      throw error;
    });

    return mathEnginePromise;
  }

  async function typesetMath(el) {
    if (!el || !el.querySelector(".math")) return;

    try {
      await loadMathEngine();

      if (window.MathJax) {
        if (window.MathJax.startup?.promise) {
          await window.MathJax.startup.promise;
        }
        if (typeof window.MathJax.typesetClear === "function") {
          try {
            window.MathJax.typesetClear([el]);
          } catch {
            /* ignore */
          }
        }
        if (typeof window.MathJax.typesetPromise === "function") {
          await window.MathJax.typesetPromise([el]);
        } else if (typeof window.MathJax.typeset === "function") {
          window.MathJax.typeset([el]);
        }
      }

      if (window.katex) {
        const nodes = el.querySelectorAll("span.math");
        nodes.forEach((node) => {
          if (node.querySelector(".katex")) return;
          let tex = node.textContent || "";
          tex = tex
            .replace(/^\s*\\\((.*)\\\)\s*$/s, "$1")
            .replace(/^\s*\\\[(.*)\\\]\s*$/s, "$1")
            .replace(/^\s*\$\$(.*)\$\$\s*$/s, "$1")
            .replace(/^\s*\$(.*)\$\s*$/s, "$1");
          try {
            window.katex.render(tex, node, {
              displayMode: node.classList.contains("display"),
              throwOnError: false,
              fleqn: false,
            });
          } catch {
            /* keep raw */
          }
        });
      }
    } catch (error) {
      console.warn("math typeset skipped", error);
    }
  }

  function mediaSourceForImage(image) {
    const figure = image.closest("figure, .quarto-figure");
    if (figure) return figure;
    const parent = image.parentElement;
    if (parent?.tagName === "P" && !cleanText(parent.textContent)) {
      return parent;
    }
    return image;
  }

  function mediaBlockForImage(image) {
    const wrapper = image.closest(".quarto-figure");
    if (wrapper) return wrapper;
    return mediaSourceForImage(image);
  }

  function rootBlockForNode(node, root) {
    let block = node;
    while (block.parentElement && block.parentElement !== root) {
      block = block.parentElement;
    }
    return block.parentElement === root ? block : null;
  }

  function flattenArticleSections(root) {
    const blocks = [];
    const appendChildren = (container) => {
      Array.from(container.children).forEach((child) => {
        if (child.tagName === "SECTION") {
          appendChildren(child);
        } else {
          blocks.push(child);
        }
      });
    };
    appendChildren(root);
    root.replaceChildren(...blocks);
  }

  function makeStorySection() {
    const section = document.createElement("section");
    section.className = "blog-story-section";
    // Quarto reserves the semantic <aside> tag for its page-margin grid.
    // This is a local media track, so use a neutral wrapper and preserve
    // the accessible label without entering Quarto's outer grid.
    const media = document.createElement("div");
    media.className = "blog-story-media";
    media.setAttribute("aria-label", "文中插图");
    const prose = document.createElement("div");
    prose.className = "blog-story-prose";
    section.append(media, prose);
    return { section, media, prose };
  }

  function setupMediaFlow(root) {
    flattenArticleSections(root);
    const mediaByRootBlock = new Map();
    root.querySelectorAll("img").forEach((image) => {
      if (image.closest(".article-translation, .callout, table, pre, .sourceCode")) {
        return;
      }
      const source = mediaBlockForImage(image);
      const rootBlock = rootBlockForNode(source, root);
      if (!rootBlock) return;
      mediaByRootBlock.set(rootBlock, source);
    });
    if (!mediaByRootBlock.size) return;

    let story = null;
    Array.from(root.children).forEach((node) => {
      const source = mediaByRootBlock.get(node);
      if (source) {
        story = makeStorySection();
        root.append(story.section);
        story.media.append(source);
        if (node !== source) story.prose.append(node);
        return;
      }

      if (story) {
        story.prose.append(node);
      } else {
        root.append(node);
      }
    });
    root.classList.add("blog-has-media-flow");
  }

  function imageCaption(image) {
    return cleanText(
      image.closest("figure, .quarto-figure")?.querySelector("figcaption")?.textContent ||
      image.getAttribute("alt") ||
      "",
    );
  }

  function closeMediaLightbox() {
    if (mediaLightbox.hidden) return;
    mediaLightbox.hidden = true;
    document.body.classList.remove("blog-media-lightbox-open");
    mediaLightboxImage.removeAttribute("src");
  }

  function openMediaLightbox(image) {
    const src = image.currentSrc || image.src;
    if (!src) return;
    const caption = imageCaption(image);
    mediaLightboxImage.src = src;
    mediaLightboxImage.alt = image.alt || caption || "文章插图";
    mediaLightboxCaption.textContent = caption;
    mediaLightboxCaption.hidden = !caption;
    mediaLightbox.hidden = false;
    document.body.classList.add("blog-media-lightbox-open");
    mediaLightboxClose.focus({ preventScroll: true });
  }

  function prepareZoomableImages(root) {
    root.querySelectorAll("img").forEach((image) => {
      if (image.closest(".article-translation")) return;
      image.classList.add("blog-zoomable-image");
      image.tabIndex = 0;
      image.setAttribute("role", "button");
      image.setAttribute("aria-label", `放大查看：${imageCaption(image) || "文章插图"}`);
    });
  }

  function scrollToArticleStart() {
    const navHeight = document.querySelector(".navbar")?.getBoundingClientRect()
      .height || 0;
    const top = immersive.getBoundingClientRect().top + window.scrollY - navHeight - 12;
    window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
  }

  async function openImmersive(index) {
    const item = items[index];
    if (!item) return;
    state.activeIndex = index;
    setMode("immersive");
    immersiveBody.innerHTML = `<p class="blog-immersive-loading">…</p>`;
    immersiveTitle.textContent = item.title;
    toc.hidden = true;
    tocNav.innerHTML = "";

    try {
      const article = await loadArticle(item);
      immersiveTitle.textContent = article.title;
      immersiveBody.innerHTML = article.bodyHtml;
      setupMediaFlow(immersiveBody);
      prepareZoomableImages(immersiveBody);
      buildToc(immersiveBody);
      await typesetMath(immersiveBody);
      buildToc(immersiveBody);
      if (item.href) {
        const url = new URL(window.location.href);
        url.hash = `article-${index}`;
        history.replaceState({}, "", url);
      }
      scrollToArticleStart();
    } catch (error) {
      immersiveBody.innerHTML = `<p class="blog-immersive-error"><a href="${item.href || "#"}">打开原页面</a></p>`;
      console.error(error);
    }
  }

  function backToPreview() {
    closeMediaLightbox();
    setMode("preview");
    const url = new URL(window.location.href);
    url.hash = "";
    history.replaceState({}, "", url);
    items[state.activeIndex]?.card.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }

  items.forEach((item, index) => {
    item.card
      .querySelector(".blog-preview-hit")
      ?.addEventListener("click", () => openImmersive(index));
  });

  dockCatalog.addEventListener("click", () => {
    backToPreview();
  });

  immersiveBody.addEventListener("click", (event) => {
    const image = event.target.closest(".blog-zoomable-image");
    if (!image || !immersiveBody.contains(image)) return;
    event.preventDefault();
    openMediaLightbox(image);
  });

  immersiveBody.addEventListener("keydown", (event) => {
    const image = event.target.closest(".blog-zoomable-image");
    if (!image || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    openMediaLightbox(image);
  });

  mediaLightbox.addEventListener("click", (event) => {
    if (event.target === mediaLightbox || event.target === mediaLightboxImage) {
      closeMediaLightbox();
    }
  });
  mediaLightboxClose.addEventListener("click", closeMediaLightbox);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMediaLightbox();
  });

  dockPrev.addEventListener("click", () => {
    if (state.mode !== "immersive") return;
    const prev = state.activeIndex - 1;
    if (prev >= 0) openImmersive(prev);
  });

  dockNext.addEventListener("click", () => {
    if (state.mode !== "immersive") return;
    const next = state.activeIndex + 1;
    if (next < items.length) openImmersive(next);
  });

  [dockPrevMenu, dockNextMenu].forEach((menu) => {
    menu.addEventListener("click", (event) => {
      const entry = event.target.closest("[data-dock-index]");
      if (!entry || !menu.contains(entry)) return;
      const index = Number(entry.dataset.dockIndex);
      if (Number.isInteger(index) && index >= 0 && index < items.length) {
        openImmersive(index);
      }
    });
  });

  const observer = new IntersectionObserver(
    (entries) => {
      if (state.mode !== "preview") return;
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const index = Number(visible.target.dataset.index);
      if (Number.isFinite(index) && index !== state.activeIndex) {
        state.activeIndex = index;
        items.forEach((item, i) => {
          item.card.classList.toggle("is-active", i === index);
        });
        const key = items[index]?.month?.key;
        if (key) {
          archiveEl.querySelectorAll(".blog-archive-item").forEach((n) => {
            n.classList.toggle("is-active", n.dataset.month === key);
          });
        }
      }
    },
    { rootMargin: "-20% 0px -55% 0px", threshold: [0.2, 0.5, 0.8] },
  );
  items.forEach((item) => observer.observe(item.card));

  const monthObserver = new IntersectionObserver(
    (entries) => {
      if (state.mode !== "preview") return;
      const visible = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      const key = visible.target.dataset.month;
      archiveEl.querySelectorAll(".blog-archive-item").forEach((n) => {
        n.classList.toggle("is-active", n.dataset.month === key);
      });
    },
    { rootMargin: "-15% 0px -60% 0px", threshold: [0.15, 0.4, 0.7] },
  );
  previewMain
    .querySelectorAll(".blog-month-group")
    .forEach((section) => monthObserver.observe(section));

  const params = new URLSearchParams(window.location.search);
  const hashMatch = window.location.hash.match(/^#article-(\d+)$/);
  const deepIndex = hashMatch
    ? Number(hashMatch[1])
    : items.findIndex(
        (item) =>
          item.href &&
          params.get("article") &&
          item.href.includes(params.get("article")),
      );
  if (deepIndex >= 0) openImmersive(deepIndex);
  else setMode("preview");
})();
