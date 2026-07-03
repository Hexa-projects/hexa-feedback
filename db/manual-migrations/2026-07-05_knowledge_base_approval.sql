-- Knowledge Base approval workflow
-- Adds moderation columns to knowledge_chunks and a designator flag on profiles.

ALTER TABLE public.knowledge_chunks
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejection_reason text;

-- Restrict status to the three known values.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'knowledge_chunks_status_check'
  ) THEN
    ALTER TABLE public.knowledge_chunks
      ADD CONSTRAINT knowledge_chunks_status_check
      CHECK (status IN ('pendente', 'aprovado', 'reprovado'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS knowledge_chunks_status_idx
  ON public.knowledge_chunks (status);

-- Existing rows should stay visible in the main list.
UPDATE public.knowledge_chunks SET status = 'aprovado' WHERE status IS NULL OR status = 'pendente';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS aprovador_base_conhecimento boolean NOT NULL DEFAULT false;
