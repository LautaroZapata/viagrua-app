ALTER TABLE public.perfiles
  ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;

-- Existing users skip onboarding
UPDATE public.perfiles SET onboarding_completed = true;
