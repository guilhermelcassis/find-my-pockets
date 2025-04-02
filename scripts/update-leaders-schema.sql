-- Update the leaders table to add email and curso fields
ALTER TABLE public.leaders
ADD COLUMN IF NOT EXISTS email TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS curso TEXT DEFAULT '';

-- Enforce Row Level Security (RLS) policies
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;

-- Create or update policies for authenticated access to leaders
DROP POLICY IF EXISTS "Allow authenticated users to read leaders" ON public.leaders;
CREATE POLICY "Allow authenticated users to read leaders" 
  ON public.leaders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to create leaders" ON public.leaders;
CREATE POLICY "Allow authenticated users to create leaders" 
  ON public.leaders FOR INSERT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to update leaders" ON public.leaders;
CREATE POLICY "Allow authenticated users to update leaders" 
  ON public.leaders FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated users to delete leaders" ON public.leaders;
CREATE POLICY "Allow authenticated users to delete leaders" 
  ON public.leaders FOR DELETE TO authenticated USING (true); 