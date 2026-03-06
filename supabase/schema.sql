-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create students table
create table public.students (
    id uuid default uuid_generate_v4() primary key,
    name text not null,
    whatsapp text not null,
    email text,
    plan_type text not null,
    due_day integer not null check (due_day >= 1 and due_day <= 31),
    price numeric(10,2) not null,
    is_active boolean default true not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create payments table
create type public.payment_status as enum ('pending', 'paid', 'late');

create table public.payments (
    id uuid default uuid_generate_v4() primary key,
    student_id uuid references public.students(id) on delete cascade not null,
    reference_month text not null, -- format 'YYYY-MM'
    payment_date timestamp with time zone,
    amount_paid numeric(10,2),
    status payment_status default 'pending' not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add updated_at trigger for students
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

create trigger on_students_updated
    before update on public.students
    for each row execute procedure public.handle_updated_at();

-- Add updated_at trigger for payments
create trigger on_payments_updated
    before update on public.payments
    for each row execute procedure public.handle_updated_at();

-- Row Level Security (RLS) Policies
alter table public.students enable row level security;
alter table public.payments enable row level security;

-- Policies for Authenticated & Anon Users (for MVP Development)
create policy "Enable ALL on students for all users"
    on public.students for all
    using (true)
    with check (true);

create policy "Enable ALL on payments for all users"
    on public.payments for all
    using (true)
    with check (true);
