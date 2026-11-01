import Link from "next/link";
import type {
	ListingModel,
	ListingPaginationItem,
	ListingStory,
} from "@/lib/listing";
import { resizeResizerImage } from "@/lib/rewrite";

function linkProps(href: string) {
	const external = /^(?:https?:)?\/\//i.test(href);

	return {
		href,
		...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
	};
}

function Kicker({ story, dark = false }: { story: ListingStory; dark?: boolean }) {
	if (!story.kicker) return null;

	const className = [
		"text-[0.68rem] font-bold uppercase tracking-[0.12em] no-underline",
		story.opinion
			? dark
				? "text-rose-300"
				: "text-rose-900"
			: dark
				? "text-white/65"
				: "text-neutral-500",
	].join(" ");

	if (story.kickerHref && !dark) {
		return (
			<a {...linkProps(story.kickerHref)} className={`${className} hover:underline`}>
				{story.kicker}
			</a>
		);
	}

	return <span className={className}>{story.kicker}</span>;
}

function PlayBadge() {
	return (
		<span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-black/75 text-white ring-1 ring-white/25">
			<svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
				<path d="M8 5.5v13l11-6.5-11-6.5Z" />
			</svg>
		</span>
	);
}

function StoryCard({ story }: { story: ListingStory }) {
	return (
		<article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-black/10 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.04)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15,23,42,0.09)]">
			{story.image ? (
				<a
					{...linkProps(story.href)}
					className="relative block overflow-hidden bg-neutral-100"
					tabIndex={-1}
					aria-hidden="true"
				>
					<img
						src={resizeResizerImage(story.image, 800, 450)}
						alt=""
						loading="lazy"
						decoding="async"
						className="aspect-[16/9] w-full object-cover transition duration-300 group-hover:scale-[1.03]"
					/>
					<span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-transparent" />
					{story.video ? (
						<span className="absolute bottom-3 left-3">
							<PlayBadge />
						</span>
					) : null}
				</a>
			) : null}

			<div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
				<div className="flex flex-wrap items-center gap-2">
					<Kicker story={story} />
				</div>

				<a {...linkProps(story.href)} className="no-underline">
					<h3 className="font-serif text-lg leading-snug tracking-[-0.01em] text-slate-900 transition group-hover:text-slate-700">
						{story.title}
					</h3>
				</a>

				{story.deck ? (
					<p className="line-clamp-3 text-sm leading-relaxed text-slate-500">{story.deck}</p>
				) : null}

				{story.timestamp ? (
					<time className="mt-auto block pt-2 text-[0.7rem] font-medium uppercase tracking-[0.06em] text-neutral-400">
						{story.timestamp}
					</time>
				) : null}
			</div>
		</article>
	);
}

function CompactCard({ story }: { story: ListingStory }) {
	return (
		<article className="group flex gap-3 py-4 first:pt-0 last:pb-0">
			{story.image ? (
				<a
					{...linkProps(story.href)}
					className="relative block h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-neutral-100 sm:h-24 sm:w-32"
					tabIndex={-1}
					aria-hidden="true"
				>
					<img
						src={resizeResizerImage(story.image, 400, 300)}
						alt=""
						loading="lazy"
						decoding="async"
						className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]"
					/>
					{story.video ? (
						<span className="absolute bottom-1.5 left-1.5 scale-75">
							<PlayBadge />
						</span>
					) : null}
				</a>
			) : null}

			<div className="min-w-0 flex-1">
				<div className="flex flex-wrap items-center gap-2">
					<Kicker story={story} />
				</div>
				<a {...linkProps(story.href)} className="no-underline">
					<h3 className="mt-1 font-serif text-base leading-snug tracking-[-0.005em] text-slate-900 transition group-hover:text-slate-700">
						{story.title}
					</h3>
				</a>
				{story.timestamp ? (
					<time className="mt-1.5 block text-[0.7rem] font-medium uppercase tracking-[0.06em] text-neutral-400">
						{story.timestamp}
					</time>
				) : null}
			</div>
		</article>
	);
}

function HeroCard({ story }: { story: ListingStory }) {
	return (
		<article className="group relative min-h-[20rem] overflow-hidden rounded-3xl bg-slate-900 sm:min-h-[24rem]">
			<a {...linkProps(story.href)} className="relative flex h-full min-h-[20rem] flex-col justify-end sm:min-h-[24rem]">
				{story.image ? (
					<img
						src={resizeResizerImage(story.image, 1400, 800)}
						alt=""
						fetchPriority="high"
						decoding="async"
						className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.02]"
					/>
				) : (
					<span className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,#334155_0%,#0f172a_58%,#020617_100%)]" />
				)}
				<span className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/55 to-slate-950/5" />

				<div className="relative flex flex-col gap-3 p-5 sm:p-7">
					<div className="flex flex-wrap items-center gap-2">
						<Kicker story={story} dark />
						{story.video ? <PlayBadge /> : null}
					</div>

					<h2 className="max-w-2xl font-serif text-3xl leading-[1.05] tracking-[-0.03em] text-white sm:text-4xl">
						{story.title}
					</h2>

					{story.deck ? (
						<p className="max-w-2xl text-sm leading-relaxed text-white/75 sm:text-base">
							{story.deck}
						</p>
					) : null}

					{story.timestamp ? (
						<time className="text-[0.7rem] font-medium uppercase tracking-[0.08em] text-white/55">
							{story.timestamp}
						</time>
					) : null}
				</div>
			</a>
		</article>
	);
}

function SectionHeading({ title, href }: { title: string; href: string }) {
	return (
		<div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b border-black/10 pb-3">
			<h2 className="font-serif text-2xl leading-tight tracking-[-0.02em] text-slate-900 sm:text-3xl">
				{title}
			</h2>
			{href ? (
				<a
					{...linkProps(href)}
					className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-neutral-500 no-underline hover:text-slate-900"
				>
					View all →
				</a>
			) : null}
		</div>
	);
}

function Pagination({ items }: { items: ListingPaginationItem[] }) {
	if (!items.length) return null;

	return (
		<nav
			aria-label="Pagination"
			className="mt-12 flex flex-wrap items-center justify-center gap-2 border-t border-black/10 pt-8"
		>
			{items.map((item, index) => {
				if (item.kind === "ellipsis") {
					return (
						<span key={`ellipsis-${index}`} className="px-2 text-neutral-400">
							…
						</span>
					);
				}

				return (
					<a
						key={`${item.href}-${index}`}
						{...linkProps(item.href)}
						aria-current={item.current ? "page" : undefined}
						className={[
							"inline-flex h-9 min-w-9 items-center justify-center rounded-full border px-3 text-sm font-semibold no-underline transition",
							item.current
								? "border-slate-900 bg-slate-900 text-white"
								: "border-black/15 text-neutral-600 hover:border-black/30 hover:bg-neutral-50 hover:text-slate-900",
						].join(" ")}
					>
						{item.kind === "previous"
							? "← Previous"
							: item.kind === "next"
								? "Next →"
								: item.label}
					</a>
				);
			})}
		</nav>
	);
}

function sectionGridClass(count: number) {
	return count === 4
		? "grid gap-5 sm:grid-cols-2 xl:grid-cols-4"
		: "grid gap-5 sm:grid-cols-2 lg:grid-cols-3";
}

export default function ListingView({ listing }: { listing: ListingModel }) {
	const [leadSection, ...remainingSections] = listing.sections;
	const [hero, ...leadRest] = leadSection?.stories ?? [];
	const secondary = leadRest.slice(0, 4);
	const moreStories = leadRest.slice(4);

	return (
		<main className="news-page min-h-screen bg-[linear-gradient(180deg,#f7f4ee_0%,#f0ebe4_100%)] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
			<div className="news-index mx-auto max-w-6xl overflow-hidden rounded-4xl border border-black/10 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
				<div className="border-b border-black/10 bg-neutral-50 px-5 py-4 sm:px-8">
					<Link
						href="/"
						className="font-serif text-sm font-semibold uppercase text-neutral-500 no-underline hover:text-neutral-700"
					>
						The Northern Express Herald
					</Link>
				</div>

				<div className="px-5 py-6 sm:px-8 lg:px-10 lg:py-9">
					{listing.breadcrumbs.length ? (
						<nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5">
							{listing.breadcrumbs.map((crumb, index) => (
								<span key={`${crumb.href}-${index}`} className="flex items-center gap-1.5">
									<a
										{...linkProps(crumb.href)}
										className="text-[0.68rem] font-bold uppercase tracking-[0.1em] text-neutral-500 no-underline hover:text-slate-900"
									>
										{crumb.label}
									</a>
									{index < listing.breadcrumbs.length - 1 ? (
										<span className="text-[0.68rem] text-neutral-300">/</span>
									) : null}
								</span>
							))}
						</nav>
					) : null}

					<header className="mt-4 border-b border-black/10 pb-6">
						<h1 className="font-serif text-4xl leading-[1.02] tracking-[-0.035em] text-slate-900 sm:text-5xl">
							{listing.title}
						</h1>
						<p className="mt-3 text-sm text-neutral-500">
							Stories and analysis from The Northern Express Herald.
						</p>
					</header>

					<div className="mt-8 space-y-12">
						{hero ? (
							<section>
								<div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
									<HeroCard story={hero} />

									{secondary.length ? (
										<div className="flex flex-col divide-y divide-black/10">
											{secondary.map((story) => (
												<CompactCard key={story.href} story={story} />
											))}
										</div>
									) : null}
								</div>

								{moreStories.length ? (
									<div className={`mt-8 ${sectionGridClass(moreStories.length)}`}>
										{moreStories.map((story) => (
											<StoryCard key={story.href} story={story} />
										))}
									</div>
								) : null}
							</section>
						) : null}

						{remainingSections.map((section, index) => (
							<section key={`${section.title}-${index}`}>
								<SectionHeading title={section.title} href={section.href} />
								<div className={sectionGridClass(section.stories.length)}>
									{section.stories.map((story) => (
										<StoryCard key={story.href} story={story} />
									))}
								</div>
							</section>
						))}
					</div>

					<Pagination items={listing.pagination} />
				</div>
			</div>
		</main>
	);
}
