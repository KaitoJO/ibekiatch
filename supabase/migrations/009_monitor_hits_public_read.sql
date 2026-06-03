-- AI収集データは全ユーザー（未ログイン含む）が閲覧可能にする
drop policy if exists monitor_hits_select on public.monitor_hits;
create policy monitor_hits_select on public.monitor_hits
  for select using (true);

drop policy if exists monitor_sources_select on public.monitor_sources;
create policy monitor_sources_select on public.monitor_sources
  for select using (true);
