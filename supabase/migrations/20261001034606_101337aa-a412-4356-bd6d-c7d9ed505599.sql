CREATE TABLE public.tracked_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) <= 120),
  category TEXT CHECK (category IS NULL OR char_length(category) <= 60),
  unit TEXT,
  currency TEXT NOT NULL DEFAULT 'KRW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.price_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.tracked_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  month TEXT NOT NULL CHECK (month ~ '^[0-9]{4}-[0-9]{2}$'),
  price NUMERIC(14, 2) NOT NULL CHECK (price >= 0),
  note TEXT CHECK (note IS NULL OR char_length(note) <= 500),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id, month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tracked_items TO authenticated;
GRANT ALL ON public.tracked_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.price_entries TO authenticated;
GRANT ALL ON public.price_entries TO service_role;

ALTER TABLE public.tracked_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.price_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items_select_own" ON public.tracked_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "items_insert_own" ON public.tracked_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "items_update_own" ON public.tracked_items FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "items_delete_own" ON public.tracked_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "entries_select_own" ON public.price_entries FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "entries_insert_own" ON public.price_entries FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries_update_own" ON public.price_entries FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "entries_delete_own" ON public.price_entries FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_tracked_items_updated_at BEFORE UPDATE ON public.tracked_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_price_entries_updated_at BEFORE UPDATE ON public.price_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();