import {
  emojify,
  gfmHeadingId,
  GitHubSlugger,
  htmlEscape,
  katex,
  Marked,
  markedAlert,
  markedFootnote,
  Prism,
  sanitizeHtml,
} from "./deps.ts";
import { CSS, KATEX_CLASSES, KATEX_CSS } from "./style.js";
export { CSS, KATEX_CSS, Marked };

Marked.marked.use(markedAlert());
Marked.marked.use(gfmHeadingId());
Marked.marked.use(markedFootnote());

export class Renderer extends Marked.Renderer {
  allowMath: boolean;
  baseUrl: string | undefined;
  #slugger: GitHubSlugger;

  constructor(options: Marked.MarkedOptions & RenderOptions = {}) {
    super(options);
    this.baseUrl = options.baseUrl;
    this.allowMath = options.allowMath ?? false;
    this.#slugger = new GitHubSlugger();
  }

  heading(
    text: string,
    level: 1 | 2 | 3 | 4 | 5 | 6,
    raw: string,
  ): string {
    const slug = this.#slugger.slug(raw);
    return `<h${level} id="${slug}"><a class="anchor" aria-hidden="true" tabindex="-1" href="#${slug}"><svg class="octicon octicon-link" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill-rule="evenodd" d="M7.775 3.275a.75.75 0 001.06 1.06l1.25-1.25a2 2 0 112.83 2.83l-2.5 2.5a2 2 0 01-2.83 0 .75.75 0 00-1.06 1.06 3.5 3.5 0 004.95 0l2.5-2.5a3.5 3.5 0 00-4.95-4.95l-1.25 1.25zm-4.69 9.64a2 2 0 010-2.83l2.5-2.5a2 2 0 012.83 0 .75.75 0 001.06-1.06 3.5 3.5 0 00-4.95 0l-2.5 2.5a3.5 3.5 0 004.95 4.95l1.25-1.25a.75.75 0 00-1.06-1.06l-1.25 1.25a2 2 0 01-2.83 0z"></path></svg></a>${text}</h${level}>`;
  }

  image(src: string, title: string | null, alt: string) {
    return `<img src="${src}" alt="${alt}" title="${title ?? ""}" />`;
  }

  code(code: string, language?: string) {
    // a language of `ts, ignore` should really be `ts`
    // and it should be lowercase to ensure it has parity with regular github markdown
    language = language?.split(",")?.[0].toLocaleLowerCase();

    // transform math code blocks into HTML+MathML
    // https://github.blog/changelog/2022-06-28-fenced-block-syntax-for-mathematical-expressions/
    if (language === "math" && this.allowMath) {
      return katex.renderToString(code, { displayMode: true });
    }
    const grammar =
      language && Object.hasOwnProperty.call(Prism.languages, language)
        ? Prism.languages[language]
        : undefined;
    if (grammar === undefined) {
      return `<pre><code class="notranslate">${htmlEscape(code)}</code></pre>`;
    }
    const html = Prism.highlight(code, grammar, language!);
    return `<div class="highlight highlight-source-${language} notranslate"><pre>${html}</pre></div>`;
  }

  link(href: string, title: string | null, text: string) {
    const titleAttr = title ? ` title="${title}"` : "";
    if (href.startsWith("#")) {
      return `<a href="${href}"${titleAttr}>${text}</a>`;
    }
    if (this.baseUrl) {
      try {
        href = new URL(href, this.baseUrl).href;
      } catch (_) {
        //
      }
    }
    return `<a href="${href}"${titleAttr} rel="noopener noreferrer">${text}</a>`;
  }
}

/** Convert inline and block math to katex */
function mathify(markdown: string) {
  // Deal with block math
  markdown = markdown.replace(/\$\$\s(.+?)\s\$\$/g, (match, p1) => {
    try {
      return katex.renderToString(p1.trim(), { displayMode: true });
    } catch (e) {
      console.warn(e);
      // Don't replace the math if there's an error
      return match;
    }
  });

  // Deal with inline math
  markdown = markdown.replace(/\s\$((?=\S).*?(?=\S))\$/g, (match, p1) => {
    try {
      return " " + katex.renderToString(p1, { displayMode: false });
    } catch (e) {
      console.warn(e);
      // Don't replace the math if there's an error
      return match;
    }
  });

  return markdown;
}

export interface RenderOptions {
  baseUrl?: string;
  mediaBaseUrl?: string;
  inline?: boolean;
  allowIframes?: boolean;
  allowMath?: boolean;
  disableHtmlSanitization?: boolean;
  renderer?: Renderer;
  allowedClasses?: { [index: string]: boolean | Array<string | RegExp> };
  allowedTags?: string[];
  allowedAttributes?: Record<string, sanitizeHtml.AllowedAttribute[]>;
  breaks?: boolean;
}

export function render(markdown: string, opts: RenderOptions = {}): string {
  opts.mediaBaseUrl ??= opts.baseUrl;
  markdown = emojify(markdown);
  if (opts.allowMath) {
    markdown = mathify(markdown);
  }

  const marked_opts = {
    baseUrl: opts.baseUrl,
    breaks: opts.breaks ?? false,
    gfm: true,
    mangle: false,
    renderer: opts.renderer ? opts.renderer : new Renderer(opts),
    async: false,
  };

  const html =
    (opts.inline
      ? Marked.marked.parseInline(markdown, marked_opts)
      : Marked.marked.parse(markdown, marked_opts)) as string;

  if (opts.disableHtmlSanitization) {
    return html;
  }

  let defaultAllowedTags = sanitizeHtml.defaults.allowedTags.concat([
    "img",
    "video",
    "svg",
    "path",
    "circle",
    "figure",
    "figcaption",
    "del",
    "details",
    "summary",
  ]);
  if (opts.allowIframes) {
    defaultAllowedTags.push("iframe");
  }
  if (opts.allowMath) {
    defaultAllowedTags = defaultAllowedTags.concat([
      "math",
      "maction",
      "annotation",
      "annotation-xml",
      "menclose",
      "merror",
      "mfenced",
      "mfrac",
      "mi",
      "mmultiscripts",
      "mn",
      "mo",
      "mover",
      "mpadded",
      "mphantom",
      "mprescripts",
      "mroot",
      "mrow",
      "ms",
      "semantics",
      "mspace",
      "msqrt",
      "mstyle",
      "msub",
      "msup",
      "msubsup",
      "mtable",
      "mtd",
      "mtext",
      "mtr",
    ]);
  }

  function transformMedia(tagName: string, attribs: sanitizeHtml.Attributes) {
    if (opts.mediaBaseUrl && attribs.src) {
      try {
        attribs.src = new URL(attribs.src, opts.mediaBaseUrl).href;
      } catch {
        delete attribs.src;
      }
    }
    return { tagName, attribs };
  }

  const defaultAllowedClasses = {
    div: [
      "highlight",
      "highlight-source-*",
      "notranslate",
      "markdown-alert",
      "markdown-alert-*",
    ],
    span: [
      "token",
      "keyword",
      "operator",
      "number",
      "boolean",
      "function",
      "string",
      "comment",
      "class-name",
      "regex",
      "regex-delimiter",
      "tag",
      "attr-name",
      "punctuation",
      "script-punctuation",
      "script",
      "plain-text",
      "property",
      "prefix",
      "line",
      "deleted",
      "inserted",
      ...(opts.allowMath ? KATEX_CLASSES : []),
    ],
    a: ["anchor"],
    p: ["markdown-alert-title"],
    svg: ["octicon", "octicon-alert", "octicon-link"],
    h2: ["sr-only"],
    section: ["footnotes"],
  };

  const defaultAllowedAttributes = {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "height", "width", "align", "title"],
    video: [
      "src",
      "alt",
      "height",
      "width",
      "autoplay",
      "muted",
      "loop",
      "playsinline",
      "poster",
      "controls",
      "title",
    ],
    a: [
      "id",
      "aria-hidden",
      "href",
      "tabindex",
      "rel",
      "target",
      "title",
      "data-footnote-ref",
      "data-footnote-backref",
      "aria-label",
      "aria-describedby",
    ],
    svg: ["viewbox", "width", "height", "aria-hidden", "background"],
    path: ["fill-rule", "d"],
    circle: ["cx", "cy", "r", "stroke", "stroke-width", "fill", "alpha"],
    span: opts.allowMath ? ["aria-hidden", "style"] : [],
    h1: ["id"],
    h2: ["id"],
    h3: ["id"],
    h4: ["id"],
    h5: ["id"],
    h6: ["id"],
    li: ["id"],
    td: ["colspan", "rowspan", "align"],
    iframe: ["src", "width", "height"], // Only used when iframe tags are allowed in the first place.
    math: ["xmlns"], // Only enabled when math is enabled
    annotation: ["encoding"], // Only enabled when math is enabled
    details: ["open"],
    section: ["data-footnotes"],
  };

  return sanitizeHtml(html, {
    transformTags: {
      img: transformMedia,
      video: transformMedia,
    },
    allowedTags: [...defaultAllowedTags, ...opts.allowedTags ?? []],
    allowedAttributes: mergeAttributes(
      defaultAllowedAttributes,
      opts.allowedAttributes ?? {},
    ),
    allowedClasses: { ...defaultAllowedClasses, ...opts.allowedClasses },
    allowProtocolRelative: false,
  });
}

function mergeAttributes(
  defaults: Record<string, sanitizeHtml.AllowedAttribute[]>,
  customs: Record<string, sanitizeHtml.AllowedAttribute[]>,
) {
  const merged = { ...defaults };
  for (const tag in customs) {
    merged[tag] = [...(merged[tag] || []), ...customs[tag]];
  }
  return merged;
}
