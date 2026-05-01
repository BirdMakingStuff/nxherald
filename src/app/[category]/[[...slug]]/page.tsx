import { JSDOM } from "jsdom";
import type { Metadata } from "next";

type PageProps = {
  params: Promise<{
    category: string;
    slug?: string[];
  }>;
};

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

function pruneHtml(html: string) {
  const dom = new JSDOM(`<body>${html}</body>`);
  const { document } = dom.window;
  const mediaTags = new Set(["audio", "figure", "img", "picture", "video"]);

  document.querySelector("#share-bar-above")?.remove();
  document.querySelector("#share-bar-below")?.remove();
  document.querySelectorAll("div#ad-container").forEach((element) => element.remove());
  document.querySelector("[data-test-ui='article-sidebar-bottom']")?.remove();
  document.querySelector("#article-RHRLatestfrom")?.remove();
  document.querySelectorAll("[data-test-ui='follow-authors-skeleton']").forEach((element) => element.remove());
  document.querySelectorAll("div[data-test-ui='author-role-distributor-container']").forEach((element) => element.remove());
  document.querySelectorAll("div[data-test-ui='nzh-premium-badge']").forEach((element) => element.remove());
  document.querySelectorAll("div[data-test-ui='author-meta-container']").forEach((element) => element.remove());
  document.querySelectorAll("div[data-test-ui='hero-container']").forEach((element) => element.remove());

  document.querySelectorAll("img, source").forEach((element) => {
    const dataSrcset = element.getAttribute("data-srcset");
    const dataSrc = element.getAttribute("data-src");

    if (dataSrcset && !element.getAttribute("srcset")) {
      element.setAttribute("srcset", dataSrcset);
    }

    if (dataSrc && !element.getAttribute("src")) {
      element.setAttribute("src", dataSrc);
    }

    const srcset = element.getAttribute("srcset") ?? "";
    const bestSrc = parseBestSrcFromSrcset(srcset);

    if (bestSrc && element.tagName.toLowerCase() === "img") {
      element.setAttribute("src", bestSrc);
    }
  });

  const elements = Array.from(document.body.querySelectorAll("*"));

  for (const element of elements.reverse()) {
    element.removeAttribute("class");
    element.removeAttribute("id");

    const attributes = Array.from(element.attributes);

    for (const attribute of attributes) {
      if (attribute.name.startsWith("data-")) {
        element.removeAttribute(attribute.name);
      }
    }

    const style = element.getAttribute("style") ?? "";

    if (style) {
      const cleanedStyle = style
        .replace(/(?:^|;)\s*display\s*:\s*none\s*;?/gi, ";")
        .replace(/;{2,}/g, ";")
        .replace(/^;|;$/g, "")
        .trim();

      if (cleanedStyle) {
        element.setAttribute("style", cleanedStyle);
      } else {
        element.removeAttribute("style");
      }
    }

    if (!element.textContent?.trim() && !mediaTags.has(element.tagName.toLowerCase())) {
      element.remove();
    }
  }

  return document.body.innerHTML.trim();
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  const slug = resolvedParams.slug ?? [];
  const url = `https://nzherald.co.nz/${resolvedParams.category}/${slug.join("/")}`;

  try {
    const html = await fetch(url).then((res) => res.text());

    // Extract title
    const titleMatch = html.match(/<h1\b[^>]*data-test-ui="article__heading"[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch?.[1]?.trim() ?? "";

    // Extract description (first paragraph)
    const descMatch = html.match(/<p\b[^>]*>([^<]+)<\/p>/i);
    const description = descMatch?.[1]?.trim() || "";

    // Extract image from srcset
    const imgMatch = html.match(/data-srcset="([^"]+)"/);
    let image = "";
    if (imgMatch) {
      image = parseBestSrcFromSrcset(imgMatch[1]);
    }

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url,
        type: "article",
        images: image ? [{ url: image }] : undefined,
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: image ? [image] : undefined,
      },
    };
  } catch (error) {
    return {
      title: "NZ Herald Article",
    };
  }
}

export default async function ArticlePage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug ?? [];

  const html = await fetch(`https://nzherald.co.nz/${resolvedParams.category}/${slug.join("/")}`).then((res) => res.text());
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const article = articleMatch?.[1] ?? "";

  const cleanedArticle = article ? pruneHtml(article) : "";

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