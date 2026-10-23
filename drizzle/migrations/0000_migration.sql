create type public.app_role as enum ('admin','rider','customer');
create type public.order_status as enum ('pending','preparing','ready','picked_up','delivered','cancelled');
create type public.application_status as enum ('pending','approved','rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "own roles or admin" on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

create policy "profile read" on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'rider'));
create policy "profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "profile update" on public.profiles for update to authenticated using (id = auth.uid());

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  category text not null default 'Mains',
  price numeric(10,2) not null check (price >= 0),
  image_url text,
  available boolean not null default true,
  created_at timestamptz not null default now()
);
grant select on public.menu_items to anon;
grant select, insert, update, delete on public.menu_items to authenticated;
grant all on public.menu_items to service_role;
alter table public.menu_items enable row level security;
create policy "menu public read" on public.menu_items for select to anon, authenticated using (true);
create policy "menu admin insert" on public.menu_items for insert to authenticated with check (public.has_role(auth.uid(),'admin'));
create policy "menu admin update" on public.menu_items for update to authenticated using (public.has_role(auth.uid(),'admin'));
create policy "menu admin delete" on public.menu_items for delete to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null,
  rider_id uuid,
  status order_status not null default 'pending',
  payment_method text not null default 'cod',
  total numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  address text not null,
  phone text not null,
  customer_name text not null default '',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.orders to authenticated;
grant all on public.orders to service_role;
alter table public.orders enable row level security;
create policy "orders read" on public.orders for select to authenticated using (
  customer_id = auth.uid() or public.has_role(auth.uid(),'admin')
  or (public.has_role(auth.uid(),'rider') and (rider_id = auth.uid() or (rider_id is null and status = 'ready')))
);
create policy "orders admin update" on public.orders for update to authenticated using (public.has_role(auth.uid(),'admin'));

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  menu_item_id uuid,
  name text not null,
  price numeric(10,2) not null,
  quantity int not null check (quantity > 0)
);
grant select on public.order_items to authenticated;
grant all on public.order_items to service_role;
alter table public.order_items enable row level security;
create policy "order items read" on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o where o.id = order_id)
);

create table public.rider_applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  full_name text not null,
  phone text not null,
  address text not null,
  vehicle_type text not null,
  plate_number text,
  license_number text not null,
  experience text,
  status application_status not null default 'pending',
  created_at timestamptz not null default now()
);
grant select, insert on public.rider_applications to authenticated;
grant all on public.rider_applications to service_role;
alter table public.rider_applications enable row level security;
create policy "apps read" on public.rider_applications for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "apps insert" on public.rider_applications for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- signup trigger: profile + role (first user becomes admin)
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''), new.raw_user_meta_data->>'phone');
  insert into public.user_roles (user_id, role) values (new.id, 'customer');
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
  end if;
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- place order with server-side pricing
create or replace function public.place_order(_items jsonb, _address text, _phone text, _name text, _notes text, _payment text)
returns uuid language plpgsql security definer set search_path = public as $$
declare _order uuid; _total numeric := 0; _it jsonb; _m record; _fee numeric := 49;
begin
  if auth.uid() is null then raise exception 'Not signed in'; end if;
  if jsonb_array_length(_items) = 0 then raise exception 'Cart is empty'; end if;
  if _payment not in ('cod') then raise exception 'Unsupported payment method'; end if;
  insert into public.orders (customer_id, address, phone, customer_name, notes, payment_method, delivery_fee)
  values (auth.uid(), _address, _phone, coalesce(_name,''), _notes, _payment, _fee) returning id into _order;
  for _it in select * from jsonb_array_elements(_items) loop
    select * into _m from public.menu_items where id = (_it->>'id')::uuid and available;
    if not found then raise exception 'Item unavailable'; end if;
    insert into public.order_items (order_id, menu_item_id, name, price, quantity)
    values (_order, _m.id, _m.name, _m.price, greatest(1,(_it->>'quantity')::int));
    _total := _total + _m.price * greatest(1,(_it->>'quantity')::int);
  end loop;
  update public.orders set total = _total + _fee where id = _order;
  return _order;
end; $$;

create or replace function public.cancel_my_order(_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.orders set status='cancelled', updated_at=now()
  where id=_order and customer_id=auth.uid() and status='pending';
  if not found then raise exception 'Order can no longer be cancelled'; end if;
end; $$;

create or replace function public.rider_accept_order(_order uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'rider') then raise exception 'Not a rider'; end if;
  update public.orders set rider_id = auth.uid(), updated_at=now()
  where id=_order and rider_id is null and status='ready';
  if not found then raise exception 'Order already taken'; end if;
end; $$;

create or replace function public.rider_update_status(_order uuid, _status order_status)
returns void language plpgsql security definer set search_path = public as $$
begin
  if _status not in ('picked_up','delivered') then raise exception 'Invalid status'; end if;
  update public.orders set status=_status, updated_at=now()
  where id=_order and rider_id=auth.uid() and status in ('ready','picked_up');
  if not found then raise exception 'Cannot update order'; end if;
end; $$;

create or replace function public.review_rider_application(_app uuid, _approve boolean)
returns void language plpgsql security definer set search_path = public as $$
declare _uid uuid;
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  update public.rider_applications set status = case when _approve then 'approved'::application_status else 'rejected'::application_status end
  where id=_app returning user_id into _uid;
  if _approve then
    insert into public.user_roles (user_id, role) values (_uid,'rider') on conflict do nothing;
  end if;
end; $$;

create or replace function public.admin_set_role(_user uuid, _role app_role, _grant boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(),'admin') then raise exception 'Forbidden'; end if;
  if _grant then insert into public.user_roles (user_id, role) values (_user,_role) on conflict do nothing;
  else delete from public.user_roles where user_id=_user and role=_role; end if;
end; $$;

alter publication supabase_realtime add table public.orders;

insert into public.menu_items (name, description, category, price, image_url) values
('Chicken Adobo Rice Bowl','Slow-braised soy-vinegar chicken, garlic rice, soft egg','Rice Meals',189,'/images/adobo.jpg'),
('Crispy Pork Sisig','Sizzling chopped pork, chili, calamansi, onions','Rice Meals',219,'/images/sisig.jpg'),
('Smash Burger','Double beef patty, cheese, pickles, house sauce','Burgers',249,'/images/burger.jpg'),
('Pancit Canton','Stir-fried egg noodles, vegetables, shrimp','Noodles',169,'/images/pancit.jpg'),
('Halo-Halo','Shaved ice, ube, leche flan, sweet beans','Desserts',129,'/images/halohalo.jpg'),
('Iced Calamansi Tea','Freshly brewed, lightly sweetened','Drinks',69,null);