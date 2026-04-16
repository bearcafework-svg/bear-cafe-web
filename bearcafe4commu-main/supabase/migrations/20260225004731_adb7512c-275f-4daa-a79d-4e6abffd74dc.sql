-- ═══════════════════════════════════════════════════════
-- UPDATE ALL ADMIN-ONLY RLS POLICIES TO SUPPORT OWNER + CUSTOM PERMISSIONS
-- ═══════════════════════════════════════════════════════

-- 1. role_transfer_logs (page: 'role-transfer')
DROP POLICY IF EXISTS "Admins and owners can view transfer logs" ON public.role_transfer_logs;
CREATE POLICY "Page access: view transfer logs" ON public.role_transfer_logs FOR SELECT
  USING (jwt_has_page_access('role-transfer'));

DROP POLICY IF EXISTS "Admins and owners can insert transfer logs" ON public.role_transfer_logs;
CREATE POLICY "Page access: insert transfer logs" ON public.role_transfer_logs FOR INSERT
  WITH CHECK (jwt_has_page_access('role-transfer'));

DROP POLICY IF EXISTS "Admins and owners can update transfer logs" ON public.role_transfer_logs;
CREATE POLICY "Page access: update transfer logs" ON public.role_transfer_logs FOR UPDATE
  USING (jwt_has_page_access('role-transfer'));

-- 2. action_logs (page: 'users')
DROP POLICY IF EXISTS "Admins can view action logs" ON public.action_logs;
CREATE POLICY "Page access: view action logs" ON public.action_logs FOR SELECT
  USING (jwt_has_page_access('users'));

-- 3. tag_warn_cancel_requests (page: 'tag-warn')
DROP POLICY IF EXISTS "Admins can create cancel requests" ON public.tag_warn_cancel_requests;
CREATE POLICY "Page access: create cancel requests" ON public.tag_warn_cancel_requests FOR INSERT
  WITH CHECK (jwt_has_page_access('tag-warn'));

DROP POLICY IF EXISTS "Admins can view cancel requests" ON public.tag_warn_cancel_requests;
CREATE POLICY "Page access: view cancel requests" ON public.tag_warn_cancel_requests FOR SELECT
  USING (jwt_has_page_access('tag-warn'));

DROP POLICY IF EXISTS "Owners can update cancel requests" ON public.tag_warn_cancel_requests;
CREATE POLICY "Page access: update cancel requests" ON public.tag_warn_cancel_requests FOR UPDATE
  USING (jwt_has_page_access('tag-warn'));

-- 4. banned_discord_roles (page: 'banned-roles')
DROP POLICY IF EXISTS "Admins can delete banned roles" ON public.banned_discord_roles;
CREATE POLICY "Page access: delete banned roles" ON public.banned_discord_roles FOR DELETE
  USING (jwt_has_page_access('banned-roles'));

DROP POLICY IF EXISTS "Admins can insert banned roles" ON public.banned_discord_roles;
CREATE POLICY "Page access: insert banned roles" ON public.banned_discord_roles FOR INSERT
  WITH CHECK (jwt_has_page_access('banned-roles'));

DROP POLICY IF EXISTS "Admins can update banned roles" ON public.banned_discord_roles;
CREATE POLICY "Page access: update banned roles" ON public.banned_discord_roles FOR UPDATE
  USING (jwt_has_page_access('banned-roles'));

-- 5. categories (page: 'categories')
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Page access: manage categories" ON public.categories FOR ALL
  USING (jwt_has_page_access('categories'));

DROP POLICY IF EXISTS "Anyone can view active categories" ON public.categories;
CREATE POLICY "View active categories" ON public.categories FOR SELECT
  USING (is_active = true OR jwt_has_page_access('categories'));

-- 6. discord_roles (page: 'roles')
DROP POLICY IF EXISTS "Admins can manage discord roles" ON public.discord_roles;
CREATE POLICY "Page access: manage discord roles" ON public.discord_roles FOR ALL
  USING (jwt_has_page_access('roles'));

DROP POLICY IF EXISTS "Anyone can view active discord roles" ON public.discord_roles;
CREATE POLICY "View active discord roles" ON public.discord_roles FOR SELECT
  USING (is_active = true OR jwt_has_page_access('roles'));

-- 7. category_roles (page: 'categories')
DROP POLICY IF EXISTS "Admins can manage category roles" ON public.category_roles;
CREATE POLICY "Page access: manage category roles" ON public.category_roles FOR ALL
  USING (jwt_has_page_access('categories'));

-- 8. rules_presets (page: 'categories')
DROP POLICY IF EXISTS "Admins can manage rules presets" ON public.rules_presets;
CREATE POLICY "Page access: manage rules presets" ON public.rules_presets FOR ALL
  USING (jwt_has_page_access('categories'))
  WITH CHECK (jwt_has_page_access('categories'));

-- 9. banned_words (page: 'banned-words')
DROP POLICY IF EXISTS "Admins can manage banned words" ON public.banned_words;
CREATE POLICY "Page access: manage banned words" ON public.banned_words FOR ALL
  USING (jwt_has_page_access('banned-words'));

-- 10. banners (page: 'banners')
DROP POLICY IF EXISTS "Admins can manage banners" ON public.banners;
CREATE POLICY "Page access: manage banners" ON public.banners FOR ALL
  USING (jwt_has_page_access('banners'));

DROP POLICY IF EXISTS "Anyone can view active banners" ON public.banners;
CREATE POLICY "View active banners" ON public.banners FOR SELECT
  USING (is_active = true OR jwt_has_page_access('banners'));

-- 11. reports (page: 'reports')
DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Page access: update reports" ON public.reports FOR UPDATE
  USING (jwt_has_page_access('reports'));

DROP POLICY IF EXISTS "Users can view own reports or admins can view all" ON public.reports;
CREATE POLICY "View own reports or page access" ON public.reports FOR SELECT
  USING (
    reporter_id = get_profile_by_discord_id(get_jwt_discord_id())
    OR jwt_has_page_access('reports')
  );

-- 12. non_transferable_roles (page: 'non-transferable-roles')
DROP POLICY IF EXISTS "Admins can manage non-transferable roles" ON public.non_transferable_roles;
CREATE POLICY "Page access: manage non-transferable roles" ON public.non_transferable_roles FOR ALL
  USING (jwt_has_page_access('non-transferable-roles'));

-- 13. profiles - admin update access (page: 'users')
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Page access: update profiles" ON public.profiles FOR UPDATE
  USING (jwt_has_page_access('users'));

DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Page access: view all profiles" ON public.profiles FOR SELECT
  USING (jwt_has_page_access('users'));

DROP POLICY IF EXISTS "Moderators can view profiles" ON public.profiles;
-- (merged into the above policy since has_page_access covers moderator)

-- 14. sessions - admin view/update (page: 'users')
DROP POLICY IF EXISTS "Users can update own sessions" ON public.sessions;
CREATE POLICY "Update own sessions or page access" ON public.sessions FOR UPDATE
  USING (
    user_id = get_profile_by_discord_id(get_jwt_discord_id())
    OR jwt_has_page_access('users')
  );

DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
CREATE POLICY "View own sessions or page access" ON public.sessions FOR SELECT
  USING (
    user_id = get_profile_by_discord_id(get_jwt_discord_id())
    OR jwt_has_page_access('users')
  );

-- 15. user_custom_permissions - view access
DROP POLICY IF EXISTS "Admins can view all permission assignments" ON public.user_custom_permissions;
CREATE POLICY "Page access: view permission assignments" ON public.user_custom_permissions FOR SELECT
  USING (jwt_has_page_access('permissions'));

-- 16. user_roles - admin manage (keep moderator ALL + add page access for viewing)
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Page access: manage roles" ON public.user_roles FOR ALL
  USING (jwt_has_page_access('users'));

DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Moderators can view all roles" ON public.user_roles;
CREATE POLICY "Page access: view all roles" ON public.user_roles FOR SELECT
  USING (jwt_has_page_access('users'));