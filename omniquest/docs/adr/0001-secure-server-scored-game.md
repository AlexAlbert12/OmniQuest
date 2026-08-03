# ADR-0001: corregir partidas en servidor

- Estado: aceptada
- Contexto: el cliente no debe conocer el solucionario ni decidir XP, aciertos o recompensas.

## Decisión

El alumno recibe preguntas mediante `get_safe_game_questions`, registra respuestas con `submit_answer_resumable`, solicita feedback posterior con `get_attempt_feedback` y finaliza mediante `finish_game_attempt`. RLS y las RPC validan identidad, matrícula, propiedad del intento e idempotencia.

## Consecuencias

- Se reduce la exposición de datos y la manipulación desde cliente.
- La lógica de puntuación queda centralizada y testeable en SQL.
- El cliente debe tratar las respuestas como DTO y gestionar estados de sincronización/reintento.
- `get_game_questions` no se usa como API del alumno y permanece restringida a `service_role` por compatibilidad interna.
