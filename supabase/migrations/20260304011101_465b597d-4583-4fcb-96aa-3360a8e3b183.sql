
-- Allow Owner (moderator role) to update user_points from the admin UI
CREATE POLICY "Owner can update user_points"
ON public.user_points
FOR UPDATE
TO authenticated
USING (
  public.has_role(
    public.get_profile_by_discord_id(public.get_jwt_discord_id()),
    'moderator'
  )
)
WITH CHECK (
  public.has_role(
    public.get_profile_by_discord_id(public.get_jwt_discord_id()),
    'moderator'
  )
);
