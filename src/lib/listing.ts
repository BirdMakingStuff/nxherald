import { normalizeHtml } from "@/lib/rewrite";

export type ListingLink = {
	href: string;
	label: string;
};

export type ListingStory = {
	href: string;
	title: string;
	kicker: string;
	kickerHref: string;
	deck: string;
	timestamp: string;
	image: string;
	imageAlt: string;
	opinion: boolean;
	video: boolean;
	variant: string;
};

export type ListingSection = {
	title: string;
	href: string;
	stories: ListingStory[];
};

export type ListingPaginationItem = {
	kind: "page" | "previous" | "next" | "ellipsis";
	href: string;
	label: string;
	current: boolean;
};

export type ListingModel = {
	title: string;
	breadcrumbs: ListingLink[];
	sections: ListingSection[];
	pagination: ListingPaginationItem[];
};

export type ListingMetadata = {
	title: string;
	description: string;
	image: string;
};

type PositionedStory = ListingStory & { position: number };
type PositionedHeader = { title: string; href: string; position: number };

const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
	nbsp: " ",
	hellip: "…",
	mdash: "—",
	ndash: "–",
	lsquo: "‘",
	rsquo: "’",
	ldquo: "“",
	rdquo: "”",
	middot: "·",
	copy: "©",
	reg: "®",
	trade: "™",
};

function decodeEntities(value: string) {
	return value
		.replace(/&#x([0-9a-f]+);/gi, (_, hex: string) =>
			String.fromCodePoint(Number.parseInt(hex, 16)),
		)
		.replace(/&#(\d+);/g, (_, decimal: string) =>
			String.fromCodePoint(Number.parseInt(decimal, 10)),
		)
		.replace(/&([a-z]+);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match);
}

function textFromHtml(html: string) {
	return decodeEntities(html.replace(/<[^>]*>/g, " "))
		.replace(/\s+/g, " ")
		.trim();
}

function readAttribute(tag: string, name: string) {
	const match = new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i").exec(tag);
	return decodeEntities(match?.[1] ?? "");
}

// Text inside the first element carrying a given data-test-ui value.
function readTestContent(html: string, testId: string) {
	const match = new RegExp(
		`<([a-z0-9]+)\\b[^>]*data-test-ui=["']${testId}["'][^>]*>([\\s\\S]*?)<\\/\\1>`,
		"i",
	).exec(html);

	return match?.[2] ?? "";
}

function readLinkHref(html: string, testId: string) {
	const match = new RegExp(
		`<a\\b[^>]*data-test-ui=["']${testId}["'][^>]*>`,
		"i",
	).exec(html);

	return match ? readAttribute(match[0], "href") : "";
}

function readHeaders(html: string): PositionedHeader[] {
	const headerRe = /<h([1-6])\b[^>]*data-test-ui=["']chain__header-label["'][^>]*>([\s\S]*?)<\/h\1>/gi;
	const linkRe = /<a\b[^>]*data-test-ui=["']chain__header-label--link["'][^>]*>/gi;

	const headerLinks: { start: number; end: number; href: string }[] = [];
	let linkMatch: RegExpExecArray | null;

	while ((linkMatch = linkRe.exec(html))) {
		const close = html.indexOf("</a>", linkMatch.index);
		headerLinks.push({
			start: linkMatch.index,
			end: close === -1 ? linkMatch.index + linkMatch[0].length : close,
			href: readAttribute(linkMatch[0], "href"),
		});
	}

	const headers: PositionedHeader[] = [];
	let headerMatch: RegExpExecArray | null;

	while ((headerMatch = headerRe.exec(html))) {
		const position = headerMatch.index;
		const link = headerLinks.find((entry) => entry.start <= position && position <= entry.end);

		headers.push({
			title: textFromHtml(headerMatch[2]),
			href: link?.href ?? "",
			position,
		});
	}

	return headers;
}

function readCardKicker(card: string) {
	const open = /<a\b[^>]*data-test-ui=["'](story-card--kicker[^"']*)["'][^>]*>/i.exec(card);
	if (!open) return { label: "", href: "", opinion: false };

	const start = open.index + open[0].length;
	const end = card.indexOf("</a>", start);

	return {
		label: textFromHtml(end === -1 ? "" : card.slice(start, end)),
		href: readAttribute(open[0], "href"),
		opinion: open[1].includes("kicker-opinion"),
	};
}

function readStoryCard(card: string, variant: string): PositionedStory | null {
	const position = 0;
	const title = textFromHtml(readTestContent(card, "story-card--headline"));
	const href =
		readLinkHref(card, "story-card--link--title") ||
		readLinkHref(card, "story-card--link--image");

	if (!title || !href) return null;

	const kicker = readCardKicker(card);
	const imageTag = /<img\b[^>]*>/i.exec(card)?.[0] ?? "";
	const imageSrc = readAttribute(imageTag, "src");
	const image = /\/pf\/resources\/images\//i.test(imageSrc) ? "" : imageSrc;

	return {
		href,
		title,
		kicker: kicker.label,
		kickerHref: kicker.href,
		deck: textFromHtml(readTestContent(card, "story-card__deck")),
		timestamp: textFromHtml(readTestContent(card, "meta-data__time-stamp")),
		image,
		imageAlt: readAttribute(imageTag, "alt"),
		opinion: kicker.opinion || kicker.label.toLowerCase() === "opinion",
		video: /data-test-ui=["']story-card--(?:herovideo|standalone-video|watch)-icon["']/i.test(card),
		variant,
		position,
	};
}

function readStories(html: string): PositionedStory[] {
	const storyRe =
		/<article\b[^>]*data-test-ui=["'](storycard[^"']*)["'][^>]*>[\s\S]*?<\/article>/gi;
	const stories: PositionedStory[] = [];
	let match: RegExpExecArray | null;

	while ((match = storyRe.exec(html))) {
		const story = readStoryCard(match[0], match[1]);
		if (!story) continue;

		stories.push({ ...story, position: match.index });
	}

	return stories;
}

function readBreadcrumbs(html: string): ListingLink[] {
	const container = readTestContent(html, "breadcrumbs");
	const anchorRe = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
	const crumbs: ListingLink[] = [];
	let match: RegExpExecArray | null;

	while ((match = anchorRe.exec(container))) {
		const href = readAttribute(match[0].slice(0, match[0].indexOf(">") + 1), "href");
		const label = textFromHtml(match[1]);

		if (href && label) crumbs.push({ href, label });
	}

	return crumbs;
}

function cleanPaginationHref(href: string) {
	if (!href.includes("_x_tr_")) return href;

	const [pathname, query = ""] = href.split("?");
	const kept = query
		.split("&")
		.filter((part) => part && !part.startsWith("_x_tr_"));

	return kept.length ? `${pathname}?${kept.join("&")}` : pathname;
}

function readPagination(html: string): ListingPaginationItem[] {
	const container = readTestContent(html, "topic-pagination-box");
	const tokenRe = /<a\b[^>]*>[\s\S]*?<\/a>|<span\b[^>]*>[\s\S]*?<\/span>/gi;
	const items: ListingPaginationItem[] = [];
	let match: RegExpExecArray | null;

	while ((match = tokenRe.exec(container))) {
		const token = match[0];
		const openTag = token.slice(0, token.indexOf(">") + 1);
		const href = readAttribute(openTag, "href");
		const label = textFromHtml(token);

		if (!href) {
			if (label) items.push({ kind: "ellipsis", href: "", label, current: false });
			continue;
		}

		const isPrevious = /\bpagination-previous\b/i.test(readAttribute(openTag, "class"));
		const isNext =
			/data-test-ui=["']topic-pagination-next["']/i.test(openTag) ||
			/\bpagination-next\b/i.test(readAttribute(openTag, "class"));

		items.push({
			kind: isPrevious ? "previous" : isNext ? "next" : "page",
			href: cleanPaginationHref(href),
			label: isPrevious ? "Previous" : isNext ? "Next" : label,
			current: /\bpagination-item--current\b/i.test(readAttribute(openTag, "class")),
		});
	}

	return items;
}

function readDocumentTitle(html: string) {
	const title = textFromHtml(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
	return title.replace(/\s*[-–|]\s*NZ Herald.*$/i, "").trim();
}

function readPrimaryHeading(html: string) {
	const mainHtml = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
	const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(mainHtml)?.[1] ?? "";

	return textFromHtml(heading);
}

function readFallbackTitle(html: string, breadcrumbs: ListingLink[], headers: PositionedHeader[]) {
	return (
		headers[0]?.title ||
		readPrimaryHeading(html) ||
		breadcrumbs.at(-1)?.label ||
		readDocumentTitle(html)
	);
}

export function isListingPage(html: string) {
	const isArticle =
		/data-test-ui=["'](?:article__heading|article-bigread-v2__heading|article-sponsored__header)["']/i.test(
			html,
		) || /<article\b[^>]*class=["'][^"']*\bv2-article\b/i.test(html);
	const storyCardCount = (
		html.match(/<article\b[^>]*data-test-ui=["']storycard[^"']*["']/gi) ?? []
	).length;

	return !isArticle && storyCardCount > 0;
}

export async function parseListing(html: string): Promise<ListingModel | null> {
	const mainHtml = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
	const normalized = await normalizeHtml(mainHtml);

	const breadcrumbs = readBreadcrumbs(normalized);
	const headers = readHeaders(normalized);
	const stories = readStories(normalized);
	const title = readFallbackTitle(html, breadcrumbs, headers) || "The Northern Express Herald";

	if (!stories.length) return null;

	const sections: ListingSection[] = headers.length
		? headers.map(({ title: sectionTitle, href }) => ({ title: sectionTitle, href, stories: [] }))
		: [{ title, href: "", stories: [] }];

	for (const story of stories) {
		let sectionIndex = -1;

		for (let index = 0; index < headers.length; index += 1) {
			if (headers[index].position <= story.position) sectionIndex = index;
		}

		sections[Math.max(0, sectionIndex)].stories.push(story);
	}

	// The same story can appear in more than one rail; keep its first card only.
	const seen = new Set<string>();
	const deduped = sections
		.map((section) => {
			const kept: ListingStory[] = [];

			for (const story of section.stories) {
				if (seen.has(story.href)) continue;
				seen.add(story.href);
				kept.push(story);
			}

			return { ...section, stories: kept };
		})
		.filter((section) => section.stories.length > 0);

	return {
		title,
		breadcrumbs,
		sections: deduped,
		pagination: readPagination(normalized),
	};
}

export function readListingMetadata(html: string): ListingMetadata {
	const breadcrumbs = readBreadcrumbs(html);
	const headers = readHeaders(html);
	const title = readFallbackTitle(html, breadcrumbs, headers) || "The Northern Express Herald";
	const descriptionTag = /<meta\b[^>]*name=["']description["'][^>]*>/i.exec(html)?.[0] ?? "";
	const imageTag = /<meta\b[^>]*property=["']og:image["'][^>]*>/i.exec(html)?.[0] ?? "";

	return {
		title,
		description: readAttribute(descriptionTag, "content"),
		image: readAttribute(imageTag, "content"),
	};
}
