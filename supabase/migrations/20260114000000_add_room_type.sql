ALTER TABLE public.rooms ADD COLUMN type text NOT NULL DEFAULT 'text';
COMMENT ON COLUMN public.rooms.type IS 'Room type: text or voice';
