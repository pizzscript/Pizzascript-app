/*
 * PizzaScript article embed. Paste on the client's blog page:
 *   <div id="ps-blog"></div>
 *   <script src="https://<app>/embed/blog.js" data-client="<short-name>" defer></script>
 * It lists the articles, opens one when the address has ?article=<slug>, and sets the page's title, description,
 * canonical link and Google article data. Style it with the client's own CSS (classes start with ps-).
 */
(function () {
  var script = document.currentScript;
  var client = script && script.getAttribute("data-client");
  var target = document.getElementById((script && script.getAttribute("data-target")) || "ps-blog");
  if (!client || !target) return;
  var api = new URL("/api/feed/" + encodeURIComponent(client), script.src).href;
  var slug = new URLSearchParams(location.search).get("article");

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") node.textContent = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) {
      if (c) node.appendChild(c);
    });
    return node;
  }
  function meta(name, content, property) {
    var key = property ? "property" : "name";
    var tag = document.head.querySelector("meta[" + key + '="' + name + '"]') || document.head.appendChild(el("meta", { [key]: name }));
    tag.setAttribute("content", content);
  }
  function canonical(href) {
    var link = document.head.querySelector('link[rel="canonical"]') || document.head.appendChild(el("link", { rel: "canonical" }));
    link.setAttribute("href", href);
  }
  function date(iso) {
    return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }
  function style() {
    if (document.getElementById("ps-blog-style") || script.hasAttribute("data-no-style")) return;
    document.head.appendChild(
      el("style", {
        id: "ps-blog-style",
        text:
          ".ps-list{list-style:none;padding:0;display:grid;gap:2rem}.ps-card a{text-decoration:none;color:inherit}.ps-card img,.ps-cover{width:100%;height:auto;border-radius:12px}" +
          ".ps-meta{opacity:.7;font-size:.875rem}.ps-article{max-width:760px;margin:0 auto;line-height:1.7}.ps-article pre{overflow:auto;padding:1rem;border-radius:8px;background:rgba(127,127,127,.12)}" +
          ".ps-article table{border-collapse:collapse;width:100%}.ps-article td,.ps-article th{border:1px solid rgba(127,127,127,.3);padding:.5rem}.ps-back{display:inline-block;margin-bottom:1.5rem}",
      }),
    );
  }

  function list(data) {
    target.innerHTML = "";
    if (!data.posts.length) return target.appendChild(el("p", { class: "ps-empty", text: "No articles yet." }));
    target.appendChild(
      el(
        "ul",
        { class: "ps-list" },
        data.posts.map(function (p) {
          return el("li", { class: "ps-card" }, [
            el("a", { href: p.url }, [
              p.coverImageUrl ? el("img", { src: p.coverImageUrl, alt: p.coverImageAlt || "", loading: "lazy", width: "1600", height: "686" }) : null,
              el("h2", { class: "ps-title", text: p.title }),
              el("p", { class: "ps-meta", text: date(p.publishedAt) + (p.readingMinutes ? " · " + p.readingMinutes + " min read" : "") }),
              el("p", { class: "ps-excerpt", text: p.excerpt }),
            ]),
          ]);
        }),
      ),
    );
  }

  function article(data) {
    var p = data.post;
    document.title = p.seoTitle + " | " + data.site.name;
    meta("description", p.seoDescription);
    meta("og:title", p.seoTitle, true);
    meta("og:description", p.seoDescription, true);
    meta("og:type", "article", true);
    if (p.coverImageUrl) meta("og:image", p.coverImageUrl, true);
    canonical(p.url);
    document.head.appendChild(
      el("script", {
        type: "application/ld+json",
        text: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          headline: p.title,
          description: p.seoDescription,
          image: p.coverImageUrl || undefined,
          datePublished: p.publishedAt,
          dateModified: p.updatedAt,
          mainEntityOfPage: p.url,
          author: { "@type": "Organization", name: data.site.name, url: data.site.siteUrl },
          publisher: { "@type": "Organization", name: data.site.name, url: data.site.siteUrl },
        }),
      }),
    );
    var body = el("div", { class: "ps-body" });
    body.innerHTML = p.bodyHtml; // already cleaned on the server
    target.innerHTML = "";
    target.appendChild(
      el("article", { class: "ps-article" }, [
        el("a", { class: "ps-back", href: location.pathname, text: "← All articles" }),
        el("h1", { class: "ps-title", text: p.title }),
        el("p", { class: "ps-meta", text: date(p.publishedAt) + (p.readingMinutes ? " · " + p.readingMinutes + " min read" : "") }),
        p.coverImageUrl ? el("img", { class: "ps-cover", src: p.coverImageUrl, alt: p.coverImageAlt || "", width: "1600", height: "686" }) : null,
        body,
      ]),
    );
  }

  style();
  fetch(slug ? api + "?slug=" + encodeURIComponent(slug) : api)
    .then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    })
    .then(slug ? article : list)
    .catch(function () {
      target.innerHTML = "";
      target.appendChild(el("p", { class: "ps-empty", text: slug ? "This article isn't available." : "Articles couldn't be loaded." }));
    });
})();
