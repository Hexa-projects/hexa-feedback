create policy "anon_read_onboarding"
on public.onboarding_responses
for select
to anon
using (true);

create policy "anon_read_processes"
on public.repetitive_processes
for select
to anon
using (true);