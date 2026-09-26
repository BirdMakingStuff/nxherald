import { HTMLRewriter } from 'htmlrewriter'
import type { Metadata } from "next";

export const runtime = 'nodejs';

type PageProps = {
  params: Promise<{
    category: string;
    slug?: string[];
  }>;
};

type RewriterEl = {
  getAttribute(name: string): string | null;
  setAttribute(name: string, value: string): void;
  removeAttribute(name: string): void;
  getAttributeNames?: () => string[];
  tagName?: string;
  remove?: () => void;
};

type CoverImage = {
  src: string;
  alt: string;
};

// NZ Herald serves a generic promo image on pages that are not stories.
const PLACEHOLDER_IMAGE = /\/pf\/resources\/images\//i;

function parseBestSrcFromSrcset(srcset: string) {
  const candidates = srcset
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const [url, descriptor] = entry.split(/\s+/, 2);
      const widthMatch = descriptor?.match(/(\d+)w$/i);

      return {
        url,
        width: widthMatch ? Number.parseInt(widthMatch[1], 10) : 0,
      };
    })
    .filter((candidate) => candidate.url);

  if (!candidates.length) {
    return "";
  }

  const best = candidates.reduce((currentBest, candidate) => {
    if (candidate.width > currentBest.width) {
      return candidate;
    }

    return currentBest;
  });

  return best.url;
}

// Pulls a string field out of the story object NZ Herald embeds in the page.
function readJsonString(source: string, key: string) {
  const match = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(source);

  if (!match) return "";

  try {
    return JSON.parse(`"${match[1]}"`) as string;
  } catch {
    return "";
  }
}

function decodeUrl(value: string) {
  return value.replace(/&amp;/g, "&").replace(/\\u002F/gi, "/").trim();
}

// The cover image is not present as an <img> in the server-rendered article
// markup (NZ Herald hydrates it client-side), so take it from the page's own
// metadata: the <meta property="og:image"> tag, then the embedded story object.
function resolveCoverImage(html: string): CoverImage {
  const metaTag = html.match(/<meta[^>]*property=["']og:image["'][^>]*>/i);
  const metaSrc = metaTag?.[0] ? decodeUrl(/content=["']([^"']*)["']/i.exec(metaTag[0])?.[1] ?? "") : "";
  const src = metaSrc || decodeUrl(readJsonString(html, "ogImage"));

  if (!src || PLACEHOLDER_IMAGE.test(src)) {
    return { src: "", alt: "" };
  }

  return { src, alt: readJsonString(html, "ogImageAlt").replace(/\s+/g, " ").trim() };
}

// Every rendition of a photo shares one resizer asset id, so two URLs carrying
// the same id are the same image at different sizes.
function imageAssetId(url: string) {
  return /\/v2\/([A-Z0-9]{8,})/i.exec(url)?.[1] ?? "";
}

function escapeAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function coverImageTag(cover: CoverImage) {
  return `<img src="${escapeAttribute(cover.src)}" alt="${escapeAttribute(cover.alt)}" data-test-ui="article-media__image" fetchpriority="high" />`;
}

function coverFigure(cover: CoverImage) {
  return `<figure data-test-ui="hero-figure">${coverImageTag(cover)}</figure>`;
}

// Photo stories repeat the hero caption in a paragraph straight after the header,
// while video stories only carry it inside the hero figure. Drop the stray copy
// so the caption stays with the image and is only rendered once.
function dropDuplicateHeroCaption(articleHtml: string) {
  const strayCaption = /<\/header>\s*<p[^>]*data-test-ui=["']figure__caption["'][^>]*>[\s\S]*?<\/p>/i.exec(articleHtml);

  return strayCaption ? articleHtml.replace(strayCaption[0], "</header>") : articleHtml;
}

// Puts the cover in the hero slot when the layout has one, keeping the caption
// the slot already carries. Layouts without a slot get the cover up front.
function insertCoverImage(articleHtml: string, cover: CoverImage) {
  const heroFigure = /<figure[^>]*data-test-ui=["']hero-figure["'][^>]*>[\s\S]*?<\/figure>/i.exec(articleHtml);

  if (!heroFigure) return coverFigure(cover) + articleHtml;

  const opened = heroFigure[0].replace(/^(<figure[^>]*>)/i, `$1${coverImageTag(cover)}`);

  return articleHtml.replace(heroFigure[0], opened);
}

async function pruneHtml(html: string, cover: CoverImage) {

  const mediaTags = new Set(["audio", "figure", "img", "picture", "video"]);

  const selectorsToRemove = [
    "#share-bar-above",
    "#share-bar-below",
    "div#ad-container",
    "div[data-test-ui='ad']",
    "button",
    "hr",
    "[data-test-ui='article-sidebar-bottom']",
    "#article-RHRLatestfrom",
    "[data-test-ui='author--information'] img",
    "[data-test-ui='follow-authors-skeleton']",
    "div[data-test-ui='author-role-distributor-container']",
    "div[data-test-ui='nzh-premium-badge']",
    "div[data-test-ui='author-meta-container']",
  ];

  // The hero slot is always empty in the server-rendered markup, so it is where
  // the cover image belongs: below the headline, above the body. Layouts without
  // a hero slot (big reads, sponsored, puzzles) render the cover themselves, and
  // adding it again here would show the same photo twice.
  const hasHeroSlot = /data-test-ui=["']hero-container["']/i.test(html);
  const coverAssetId = imageAssetId(cover.src);
  const coverAlreadyShown = Boolean(coverAssetId) && html.includes(coverAssetId);
  const showCover = Boolean(cover.src) && (hasHeroSlot || !coverAlreadyShown);

  const rewriter = new HTMLRewriter()
    .on("div[data-test-ui='hero-container']", {
      element(el: RewriterEl) {
        // Nothing to put in the slot, so drop it rather than leave a gap.
        if (!showCover) el.remove?.();
      },
    })
    .on("img, source", {
      element(el: RewriterEl) {
        const dataSrcset = el.getAttribute("data-srcset");
        const dataSrc = el.getAttribute("data-src");

        if (dataSrcset && !el.getAttribute("srcset")) {
          el.setAttribute("srcset", dataSrcset);
        }

        if (dataSrc && !el.getAttribute("src")) {
          el.setAttribute("src", dataSrc);
        }

        const srcset = el.getAttribute("srcset") ?? "";
        const bestSrc = parseBestSrcFromSrcset(srcset);

        if (bestSrc && String(el.tagName).toLowerCase() === "img") {
          el.setAttribute("src", bestSrc);
        }
      },
    })
    .on("*", {
      element(el: RewriterEl) {
        el.removeAttribute("class");
        el.removeAttribute("id");

        // remove data-* attributes if method exists
        const getNames = typeof el.getAttributeNames === "function" ? el.getAttributeNames : undefined;
        const names: string[] = getNames ? getNames.call(el) : [];
        for (const name of names) {
          if (name.startsWith("data-")) el.removeAttribute(name);
        }

        const style = el.getAttribute("style") ?? "";
        if (style) {
          const cleanedStyle = String(style)
            .replace(/(?:^|;)\s*display\s*:\s*none\s*;?/gi, ";")
            .replace(/;{2,}/g, ";")
            .replace(/^;|;$/g, "")
            .trim();

          if (cleanedStyle) {
            el.setAttribute("style", cleanedStyle);
          } else {
            el.removeAttribute("style");
          }
        }
      },
    })
    .on("a", {
      element(el: RewriterEl) {
        const href = el.getAttribute("href");
        if (!href) return;

        // Rewrite absolute nzherald links (including protocol-relative) to site-relative paths
        const nzHostRegex = /^(?:https?:)?\/\/(?:www\.)?nzherald\.co\.nz/i;

        // skip non-http links and fragments/mailto
        if (/^mailto:|^tel:|^javascript:/i.test(href) || href.startsWith('#')) return;

        let newHref = href;

        if (nzHostRegex.test(href)) {
          // strip the host (leaves path and query)
          newHref = href.replace(nzHostRegex, '');
          if (!newHref.startsWith('/')) newHref = '/' + newHref;
        } else if (href.startsWith('/')) {
          // already a site-root-relative path; keep as-is
          newHref = href;
        } else {
          // not a nzherald or root-relative link — leave it alone
          return;
        }

        el.setAttribute('href', newHref);
        el.setAttribute('rel', 'noopener noreferrer');
      },
    });

  for (const sel of selectorsToRemove) {
    rewriter.on(sel, {
      element(el: RewriterEl) {
        el.remove?.();
      },
    });
  }

  const response = await rewriter.transform(new Response(`<body>${html}</body>`));
  const transformed = await response.text();
  const bodyMatch = transformed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const inner = bodyMatch ? bodyMatch[1] : transformed;

  // As a final pass: remove elements that are empty (no text and not media).
  // Use a simple regex-based cleanup to strip empty tags not containing media content.
  let cleaned = inner.replace(/<([a-zA-Z0-9-]+)([^>]*)>\s*<\/\1>/g, (_m, tag) => {
    return mediaTags.has(tag.toLowerCase()) ? _m : "";
  });

  if (showCover) {
    cleaned = insertCoverImage(cleaned, cover);
    cleaned = dropDuplicateHeroCaption(cleaned);
  }

  // keep the action bar contents but strip its border/margin/padding styles
  rewriter.on("section[data-test-ui='article__action-bar']", {
    element(el: RewriterEl) {
      const style = el.getAttribute("style") ?? "";
      // remove border and top spacing, preserve other styles, then enforce bottom margin
      let cleanedStyle = String(style)
        .replace(/border[^;]*;?/gi, "")
        .replace(/margin-top[^;]*;?/gi, "")
        .replace(/padding-top[^;]*;?/gi, "")
        .replace(/;{2,}/g, ";")
        .replace(/^;|;$/g, "")
        .trim();

      // ensure there's a bottom margin
      const hasMarginBottom = /margin-bottom\s*:/i.test(cleanedStyle);
      if (!hasMarginBottom) {
        cleanedStyle = (cleanedStyle ? cleanedStyle + ";" : "") + "margin-bottom:1rem";
      }

      if (cleanedStyle) {
        el.setAttribute("style", cleanedStyle);
      } else {
        el.removeAttribute("style");
      }
    },
  });

  return cleaned.trim();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug ?? [];
  const url = `https://nzherald.co.nz/${resolvedParams.category}/${slug.join("/")}`;

  try {
    const html = await fetch(url).then((res) => res.text());

    // Extract title from raw HTML (heading is reliable there)
    const titleMatch = html.match(/<h1\b[^>]*data-test-ui="article__heading"[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch?.[1]?.trim() ?? "";

    // Extract article HTML, prune it, then derive description and image from the cleaned output
    const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
    const articleHtml = articleMatch?.[1] ?? "";
    const cleaned = articleHtml ? await pruneHtml(articleHtml, resolveCoverImage(html)) : "";

    // Description: first paragraph from the cleaned HTML (strip tags)
    let description = "";
    const descMatch = cleaned.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
    if (descMatch) {
      description = descMatch[1].replace(/<[^>]+>/g, "").trim();
    } else {
      // fallback to raw HTML first paragraph
      const rawDescMatch = html.match(/<p\b[^>]*>([^<]+)<\/p>/i);
      description = rawDescMatch?.[1]?.trim() || "";
    }

    // Social image: the story's cover, falling back to the first image in the body.
    const cover = resolveCoverImage(html);
    const image = cover.src || cleaned.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i)?.[1] || "";

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        type: "article",
        images: image ? [{ url: image, alt: cover.alt }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch {
    return {
      title: "Article",
    };
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug ?? [];

  const html = await fetch(`https://nzherald.co.nz/${resolvedParams.category}/${slug.join("/")}`).then((res) => res.text());
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const article = articleMatch?.[1] ?? "";

  const cleanedArticle = article ? await pruneHtml(article, resolveCoverImage(html)) : "";

  return (
    <main className="news-page min-h-screen bg-[linear-gradient(180deg,#f7f4ee_0%,#f0ebe4_100%)] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
      <article className="news-article mx-auto max-w-4xl overflow-hidden rounded-4xl border border-black/10 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="border-b border-black/10 bg-neutral-50 px-5 py-4 sm:px-8">
          <span className="text-sm font-semibold uppercase text-neutral-500 font-serif">The Northern Express Herald</span>
        </div>
        <div className="px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
          {cleanedArticle ? (
            <div dangerouslySetInnerHTML={{ __html: cleanedArticle }} />
          ) : (
            <p className="text-base text-neutral-600">No article found.</p>
          )}
        </div>
      </article>
    </main>
  );
}