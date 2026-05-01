"use client";

import { FormEvent, useState } from "react";

function parseInputToPath(input: string): string | null {
	const trimmed = input.trim();
	if (!trimmed) return null;

	const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

	try {
		const parsed = new URL(withProtocol);
		return `${parsed.pathname}${parsed.search}${parsed.hash}`;
	} catch {
		return null;
	}
}

export default function Home() {
	const [inputUrl, setInputUrl] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();

		const path = parseInputToPath(inputUrl);
		if (!path) {
			setError("Please enter a valid URL.");
			return;
		}

		setError("");
		window.location.assign(`${window.location.origin}${path}`);
	};

	return (
		<main className="news-page min-h-screen bg-[linear-gradient(180deg,#f7f4ee_0%,#f0ebe4_100%)] px-4 py-6 sm:px-6 lg:px-8 lg:py-10">
			<section className="mx-auto max-w-4xl overflow-hidden rounded-4xl border border-black/10 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
				<div className="border-b border-black/10 bg-neutral-50 px-5 py-4 sm:px-8">
					<span className="text-sm font-semibold uppercase text-neutral-500 font-serif">The Northern Express Herald</span>
				</div>
				<form onSubmit={handleSubmit} className="px-5 py-6 sm:px-8 lg:px-12 lg:py-10">
					<input
						type="url"
						value={inputUrl}
						onChange={(event) => setInputUrl(event.target.value)}
						placeholder="Paste in the URL and press enter"
						className="w-full rounded-xl border border-black/20 px-4 py-3 text-base text-[#172033] outline-none focus:border-black/40 focus:ring-2 focus:ring-black/10"
						required
						autoFocus
					/>
					{error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
				</form>
			</section>
		</main>
	);
}
