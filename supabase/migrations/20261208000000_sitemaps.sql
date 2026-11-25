-- Public bucket for generated sitemap XML files, one per workspace.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sitemaps',
  'sitemaps',
  true,
  5242880,
  array['application/xml', 'text/xml']
)
on conflict (id) do nothing;
