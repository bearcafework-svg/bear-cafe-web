-- Database constraint to enforce maximum 3 healing messages per user
CREATE OR REPLACE FUNCTION public.check_healing_message_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT count(*) FROM public.healing_messages WHERE author_id = NEW.author_id) >= 3 THEN
    RAISE EXCEPTION 'You can only have up to 3 healing messages at a time.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_healing_message_limit ON public.healing_messages;
CREATE TRIGGER enforce_healing_message_limit
BEFORE INSERT ON public.healing_messages
FOR EACH ROW
EXECUTE FUNCTION check_healing_message_limit();
