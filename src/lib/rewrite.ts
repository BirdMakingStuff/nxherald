import { HTMLRewriter } from "htmlrewriter";

export type RewriterEl = {
	getAttribute(name: string): string | null;
	setAttribute(name: string, value: string): void;
	removeAttribute(name: string): void;
	getAttributeNames?: () => string[];
	tagName?: string;
	remove?: () => void;
};

// Every rendition of a photo shares one resizer asset id, so two URLs carrying
// the same id are the same image at different sizes.
export function imageAssetId(url: string) {
	return /\/v2\/([A-Z0-9]{8,})/i.exec(url)?.[1] ?? "";
}

export function parseBestSrcFromSrcset(srcset: string) {
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

	return candidates.reduce((currentBest, candidate) =>
		candidate.width > currentBest.width ? candidate : currentBest,
	).url;
}

// NZ Herald ships lazy images: the real source sits in data-src/data-srcset.
// Promote those to real attributes and use the largest rendition.
export function imageRewriteHandler(el: RewriterEl) {
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
}

// Absolute nzherald links become site-relative so every link stays inside this
// mirror. Links to other hosts are left alone.
export function linkRewriteHandler(el: RewriterEl) {
	const href = el.getAttribute("href");
	if (!href) return;

	const nzHostRegex = /^(?:https?:)?\/\/(?:www\.)?nzherald\.co\.nz/i;

	if (/^mailto:|^tel:|^javascript:/i.test(href) || href.startsWith("#")) return;

	let newHref = href;

	if (nzHostRegex.test(href)) {
		newHref = href.replace(nzHostRegex, "");
		if (!newHref.startsWith("/")) newHref = "/" + newHref;
	} else if (href.startsWith("/")) {
		newHref = href;
	} else {
		return;
	}

	el.setAttribute("href", newHref);
	el.setAttribute("rel", "noopener noreferrer");
}

// Runs the shared link/image rewrites without touching anything else. Used by
// listing pages, which are parsed into structured data rather than rendered
// as one big HTML blob.
export async function normalizeHtml(html: string) {
	const rewriter = new HTMLRewriter()
		.on("img, source", { element: imageRewriteHandler })
		.on("a", { element: linkRewriteHandler });

	const response = await rewriter.transform(new Response(`<body>${html}</body>`));
	const transformed = await response.text();
	const bodyMatch = transformed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

	return bodyMatch
		? bodyMatch[1]
		: transformed.replace(/^\s*<body[^>]*>/i, "").replace(/<\/body>[\s\S]*$/i, "");
}
