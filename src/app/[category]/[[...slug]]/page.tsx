import sanitizeHtml from "sanitize-html";

type PageProps = {
  params: Promise<{
    category: string;
    slug?: string[];
  }>;
};

export default async function ArticlePage({ params }: PageProps) {
  const resolvedParams = await params;
  const slug = resolvedParams.slug ?? [];

  const html = await fetch(`https://nzherald.co.nz/${resolvedParams.category}/${slug.join("/")}`).then((res) => res.text());
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  const article = articleMatch?.[1] ?? "";

  const cleanArticle = sanitizeHtml(article, {
    allowedTags: ["p", "a", "strong", "em", "ul", "ol", "li", "img"],
    allowedAttributes: {
      a: ["href"],
      img: ["src", "alt"],
    },
  });

  return <article dangerouslySetInnerHTML={{ __html: cleanArticle }} />;
}