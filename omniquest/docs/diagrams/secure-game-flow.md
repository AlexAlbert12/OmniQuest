# Diagrama del flujo de juego seguro

```mermaid
sequenceDiagram
    autonumber
    actor A as Alumno
    participant UI as Expo / useGame
    participant API as Supabase RPC
    participant DB as PostgreSQL + RLS

    A->>UI: Abre una misión
    UI->>API: get_safe_game_questions(contexto)
    API->>DB: Valida matrícula, tema y dificultad
    DB-->>UI: Preguntas sin solucionario ni explicación

    UI->>API: start_game_attempt(contexto)
    API->>DB: Crea intento del usuario autenticado
    DB-->>UI: attempt_id

    loop Por cada pregunta
        A->>UI: Envía respuesta
        UI->>API: submit_answer_resumable(submission_id, attempt_id, respuesta)
        API->>DB: Valida propiedad y versión, corrige y persiste
        DB-->>UI: Resultado mínimo e attempt_history_id
        UI->>API: get_attempt_feedback(attempt_history_id)
        API->>DB: Autoriza propietario/profesor/admin
        DB-->>UI: Feedback posterior permitido
    end

    UI->>API: finish_game_attempt(attempt_id, estado)
    API->>DB: Cierra intento y sincroniza progreso, XP y badges
    DB-->>UI: Resumen final y recompensas
```

## Invariantes

- El cliente no recibe `is_correct` ni el mapa de respuestas antes de enviar una respuesta.
- Cada envío usa un identificador idempotente para soportar reintentos y reconexión.
- La corrección, XP y recompensas se calculan en servidor.
- El feedback completo solo se libera después de existir un intento autorizado.
- `get_game_questions` no se usa desde el cliente autenticado; permanece restringida a operaciones internas de compatibilidad.
