-- Create categories for Discord Servers
CREATE TABLE IF NOT EXISTS public.discord_server_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create table for Discord Servers
CREATE TABLE IF NOT EXISTS public.discord_servers (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    discord_id TEXT NOT NULL UNIQUE, -- The actual Discord Guild ID
    owner_id TEXT NOT NULL, -- The discord_id of the owner (from profiles)
    name TEXT NOT NULL,
    description TEXT,
    category_id UUID REFERENCES public.discord_server_categories(id),
    member_count INT DEFAULT 0,
    icon_url TEXT,
    banner_url TEXT,
    invite_url TEXT NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    qc_comment TEXT,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.discord_server_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discord_servers ENABLE ROW LEVEL SECURITY;

-- Policies for categories
CREATE POLICY "Allow public read access for server categories"
ON public.discord_server_categories FOR SELECT
TO public
USING (true);

CREATE POLICY "Allow manage categories for owners"
ON public.discord_server_categories FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

-- Policies for discord_servers
CREATE POLICY "Allow public read access for approved servers"
ON public.discord_servers FOR SELECT
TO public
USING (status = 'approved');

CREATE POLICY "Allow owners to see all servers for QC"
ON public.discord_servers FOR SELECT
TO authenticated
USING (public.is_owner() OR (auth.uid() IN (SELECT id FROM public.profiles WHERE discord_id = owner_id)));

CREATE POLICY "Allow users to insert their own servers"
ON public.discord_servers FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE discord_id = owner_id));

CREATE POLICY "Allow users to update their own servers"
ON public.discord_servers FOR UPDATE
TO authenticated
USING (auth.uid() IN (SELECT id FROM public.profiles WHERE discord_id = owner_id))
WITH CHECK (auth.uid() IN (SELECT id FROM public.profiles WHERE discord_id = owner_id));

CREATE POLICY "Allow owners to manage all servers"
ON public.discord_servers FOR ALL
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

-- Default categories
INSERT INTO public.discord_server_categories (name, icon, sort_order)
VALUES 
('Community', '💬', 1),
('Gaming', '🎮', 2),
('Social', '🤝', 3),
('Anime', '🌸', 4),
('Technology', '💻', 5)
ON CONFLICT (id) DO NOTHING;
