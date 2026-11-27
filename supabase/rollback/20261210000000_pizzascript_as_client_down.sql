-- Rollback of 20261210000000_pizzascript_as_client.sql. Only needed together with a code rollback: the code no longer
-- has a built-in PizzaScript profile.
update public.workspaces set site_url = 'https://pizzascript-app.onrender.com' where id = '00000000-0000-4000-8000-000000000001';
delete from public.settings where workspace_id = '00000000-0000-4000-8000-000000000001' and key = 'profile';
