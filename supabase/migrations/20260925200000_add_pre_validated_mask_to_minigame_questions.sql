-- Migration: Add pre_validated_mask column to minigame_questions
-- Allows storing pre-evaluated, verified masks for Game 1 (and future games) to bypass runtime calculation

ALTER TABLE minigame_questions 
ADD COLUMN IF NOT EXISTS pre_validated_mask text null;

COMMENT ON COLUMN minigame_questions.pre_validated_mask IS 'Pre-calculated and admin-verified mask string to bypass runtime ambiguity calculation';
