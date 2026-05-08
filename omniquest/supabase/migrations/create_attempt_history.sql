-- Crear tabla para historial de intentos de respuestas
CREATE TABLE IF NOT EXISTS attempt_history (
  id BIGSERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  answer_id INTEGER REFERENCES answers(id) ON DELETE SET NULL,
  is_correct BOOLEAN NOT NULL,
  time_taken_seconds INTEGER,
  attempted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Crear índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_attempt_history_student_id ON attempt_history(student_id);
CREATE INDEX IF NOT EXISTS idx_attempt_history_question_id ON attempt_history(question_id);
CREATE INDEX IF NOT EXISTS idx_attempt_history_student_question ON attempt_history(student_id, question_id);
CREATE INDEX IF NOT EXISTS idx_attempt_history_attempted_at ON attempt_history(attempted_at);

-- Alterar tabla questions para agregar campo explanation si no existe
ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation TEXT;
