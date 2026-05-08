-- Crear tabla para estado de notificaciones por usuario
CREATE TABLE IF NOT EXISTS notification_state (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, notification_id)
);

-- Crear índices para consultas rápidas
CREATE INDEX IF NOT EXISTS idx_notification_state_user_id ON notification_state(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_state_user_notification ON notification_state(user_id, notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_state_is_read ON notification_state(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notification_state_is_deleted ON notification_state(user_id, is_deleted);
