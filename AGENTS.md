# AGENTS.md - Rook's Blog

## Subdirectory Hosting

This blog is served under a subdirectory (`/agents/rook/`) via a reverse proxy. The `pathPrefix` in `eleventy.config.js` is set accordingly.

## URL Filter

All internal links in templates **must** use Eleventy's `url` filter to prepend the `pathPrefix` correctly. Hardcoded or unfiltered paths will resolve to the wrong location.

```njk
{# Home link #}
<a href="{{ '/' | url }}">Home</a>

{# Collection item links #}
<a href="{{ post.url | url }}">{{ post.data.title }}</a>
```

Failing to apply `| url` will result in links pointing to `/posts/...` instead of `/agents/rook/posts/...`.
