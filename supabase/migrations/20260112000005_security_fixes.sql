-- Baseline game history objects that existed before this tracked migration.
-- New projects need these before the security hardening below can run.
CREATE TABLE IF NOT EXISTS public.game_histories (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
    room_id uuid REFERENCES public.rooms(id) ON DELETE SET NULL,
    room_title text NOT NULL,
    room_description text,
    start_time timestamp with time zone,
    end_time timestamp with time zone DEFAULT timezone('utc'::text, now()),
    kp_id uuid NOT NULL REFERENCES auth.users(id),
    kp_nickname text
);

CREATE TABLE IF NOT EXISTS public.game_history_participants (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    game_history_id uuid NOT NULL REFERENCES public.game_histories(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES auth.users(id),
    user_nickname text,
    character_snapshot jsonb NOT NULL,
    outcome text NOT NULL
);

CREATE OR REPLACE FUNCTION public.cleanup_room_characters()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.characters
  WHERE room_id = OLD.id
    AND type <> 'investigator';

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS before_room_delete ON public.rooms;
CREATE TRIGGER before_room_delete
BEFORE DELETE ON public.rooms
FOR EACH ROW
EXECUTE PROCEDURE public.cleanup_room_characters();

CREATE OR REPLACE FUNCTION public.conclude_game(
    p_room_id uuid,
    p_outcomes jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_room public.rooms%ROWTYPE;
    v_kp_nickname text;
    v_new_history_id uuid;
    v_char record;
    v_outcome text;
BEGIN
    SELECT * INTO v_room FROM public.rooms WHERE id = p_room_id;
    IF v_room.id IS NULL THEN
        RAISE EXCEPTION 'Room not found';
    END IF;

    IF v_room.kp_id <> auth.uid() THEN
        RAISE EXCEPTION 'Only KP can conclude the game';
    END IF;

    SELECT nickname INTO v_kp_nickname
    FROM public.profiles
    WHERE id = v_room.kp_id;

    INSERT INTO public.game_histories (
        room_id,
        room_title,
        room_description,
        start_time,
        end_time,
        kp_id,
        kp_nickname
    )
    VALUES (
        v_room.id,
        v_room.title,
        v_room.description,
        v_room.created_at,
        timezone('utc'::text, now()),
        v_room.kp_id,
        coalesce(v_kp_nickname, 'Unknown Keeper')
    )
    RETURNING id INTO v_new_history_id;

    FOR v_char IN
        SELECT character.*, profile.nickname as user_nickname
        FROM public.characters character
        LEFT JOIN public.profiles profile ON profile.id = character.user_id
        WHERE character.room_id = p_room_id
          AND character.type = 'investigator'
          AND character.user_id IS NOT NULL
    LOOP
        v_outcome := p_outcomes->>v_char.user_id::text;

        INSERT INTO public.game_history_participants (
            game_history_id,
            user_id,
            user_nickname,
            character_snapshot,
            outcome
        )
        VALUES (
            v_new_history_id,
            v_char.user_id,
            v_char.user_nickname,
            to_jsonb(v_char),
            coalesce(v_outcome, U&'\5B58\6D3B')
        );
    END LOOP;

    UPDATE public.rooms
    SET status = 'completed'
    WHERE id = p_room_id;

    RETURN v_new_history_id;
END;
$$;

-- Fix RLS for game history tables
-- The linter detected these were public but RLS was not enabled
ALTER TABLE public.game_histories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_history_participants ENABLE ROW LEVEL SECURITY;

-- Ensure read-only access for everyone (since these are history records)
-- We drop first to avoid "policy already exists" errors if re-running
DROP POLICY IF EXISTS "Game histories are viewable by everyone" ON public.game_histories;
CREATE POLICY "Game histories are viewable by everyone" ON public.game_histories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Game participants are viewable by everyone" ON public.game_history_participants;
CREATE POLICY "Game participants are viewable by everyone" ON public.game_history_participants FOR SELECT USING (true);


-- Fix Function Search Paths (Security Best Practice: CVE-2018-1058 protection)
-- Explicitly setting search_path prevents malicious users from hijacking function calls
ALTER FUNCTION public.claim_experience(text) SET search_path = public;
ALTER FUNCTION public.handle_heartbeat() SET search_path = public;
ALTER FUNCTION public.update_room_activity() SET search_path = public;
ALTER FUNCTION public.delete_old_system_messages() SET search_path = public;


-- Fix Permissive Notifications Policy
-- The original policy "WITH CHECK (true)" allowed any authenticated user to insert ANY notification
-- We restrict it so users can only insert notifications where they are the 'actor'
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;

CREATE POLICY "Authenticated users can create notifications" 
ON public.notifications 
FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = actor_id);
