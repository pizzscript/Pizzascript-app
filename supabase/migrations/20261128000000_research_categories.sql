-- Categories for the broader research: business automation and software/tools, aimed at business owners.
insert into public.clusters (id, name, audience, target_t1, position) values
  ('business-automation', 'Business Automation', 'client', 70, 7),
  ('software-tools', 'Software & Tools', 'client', 70, 8)
on conflict (id) do nothing;
