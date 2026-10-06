-- Migration: Add INSERT and DELETE policies for web_notifications
-- Allows authenticated users / admins to create notifications and users to delete their own.

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'web_notifications' AND policyname = 'Allow insert notifications'
    ) THEN
        CREATE POLICY "Allow insert notifications" ON public.web_notifications 
        FOR INSERT TO authenticated WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'web_notifications' AND policyname = 'Allow delete own'
    ) THEN
        CREATE POLICY "Allow delete own" ON public.web_notifications 
        FOR DELETE TO authenticated USING (user_id = auth.uid());
    END IF;
END $$;
