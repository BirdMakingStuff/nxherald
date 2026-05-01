import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

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
  const document = new JSDOM(html).window.document;
  const article = document.querySelectorAll("article")[0]?.innerHTML ?? "";

  const cleanArticle = DOMPurify.sanitize(article, {
    ALLOWED_TAGS: ["p", "a", "strong", "em", "ul", "ol", "li", "img"],
    ALLOWED_ATTR: ["href"],
  });

  return <article dangerouslySetInnerHTML={{ __html: cleanArticle }} />;
}