export const TEACHER_IDENTITIES = [
  { alias: 'Elena Ruiz', email: 'profesor01@demo.omniquest.test', demoLogin: true },
  { alias: 'Marcos Vega', email: 'profesor02@demo.omniquest.test' },
  { alias: 'Laura Campos', email: 'profesor03@demo.omniquest.test' },
  { alias: 'Diego Martín', email: 'profesor04@demo.omniquest.test' },
]

export const STUDENT_IDENTITIES = [
  { alias: 'Lucía Martín', email: 'alumno01@demo.omniquest.test', demoLogin: true },
  { alias: 'Daniel Ruiz', email: 'alumno02@demo.omniquest.test' },
  { alias: 'Marta León', email: 'alumno03@demo.omniquest.test' },
  { alias: 'Pablo Serrano', email: 'alumno04@demo.omniquest.test' },
  { alias: 'Carla Molina', email: 'alumno05@demo.omniquest.test' },
  { alias: 'Javier Ortega', email: 'alumno06@demo.omniquest.test' },
  { alias: 'Sofía Vega', email: 'alumno07@demo.omniquest.test' },
  { alias: 'Adrián Torres', email: 'alumno08@demo.omniquest.test' },
  { alias: 'Elena Navarro', email: 'alumno09@demo.omniquest.test' },
  { alias: 'Álvaro Gil', email: 'alumno10@demo.omniquest.test' },
  { alias: 'Irene Castro', email: 'alumno11@demo.omniquest.test' },
  { alias: 'Sergio Molina', email: 'alumno12@demo.omniquest.test' },
  { alias: 'Paula Díaz', email: 'alumno13@demo.omniquest.test' },
  { alias: 'Hugo Fernández', email: 'alumno14@demo.omniquest.test' },
  { alias: 'Noa Jiménez', email: 'alumno15@demo.omniquest.test' },
  { alias: 'Mario León', email: 'alumno16@demo.omniquest.test' },
  { alias: 'Claudia Herrera', email: 'alumno17@demo.omniquest.test' },
  { alias: 'David Santos', email: 'alumno18@demo.omniquest.test' },
  { alias: 'Sara Campos', email: 'alumno19@demo.omniquest.test' },
  { alias: 'Bruno Vidal', email: 'alumno20@demo.omniquest.test' },
  { alias: 'Alicia Prieto', email: 'alumno21@demo.omniquest.test' },
  { alias: 'Marcos Peña', email: 'alumno22@demo.omniquest.test' },
  { alias: 'Vega Lozano', email: 'alumno23@demo.omniquest.test' },
  { alias: 'Nicolás Cano', email: 'alumno24@demo.omniquest.test' },
  { alias: 'Emma Rojas', email: 'alumno25@demo.omniquest.test' },
]

export const DEMO_QUESTIONS = [
  { subject: 'Matemáticas', type: 'multiple_choice', text: '¿Cuál es el 15 % de 200?', explanation: 'El 15 % de 200 se obtiene multiplicando 200 por 0,15.', hint: 'Convierte el porcentaje en un número decimal.', answers: [['20', false], ['30', true], ['35', false], ['40', false]] },
  { subject: 'Matemáticas', type: 'true_false', text: 'Todo número primo mayor que 2 es impar.', explanation: 'El 2 es el único número primo par.', hint: 'Piensa qué ocurriría si un número par mayor que 2 fuera primo.', answers: [['Verdadero', true], ['Falso', false]] },
  { subject: 'Matemáticas', type: 'fill_blank', text: 'La derivada de x² es ____.', explanation: 'Aplicando la regla de la potencia, d(x²)/dx = 2x.', hint: 'Usa la regla d(xⁿ)/dx = n·xⁿ⁻¹.', answers: [['2x', true]] },
  { subject: 'Matemáticas', type: 'ordering', text: 'Ordena los pasos para resolver 2x + 4 = 10.', explanation: 'Primero se aísla el término con x y después se despeja la incógnita.', hint: 'Deshaz las operaciones en orden inverso.', answers: [['Restar 4 en ambos lados', true], ['Obtener 2x = 6', true], ['Dividir ambos lados entre 2', true], ['Obtener x = 3', true]] },
  { subject: 'Matemáticas', type: 'match_pairs', text: 'Relaciona cada concepto de una función lineal con su representación habitual.', explanation: 'En y = mx + b, m representa la pendiente y b la ordenada en el origen.', hint: 'Recuerda la forma y = mx + b.', answers: [['Pendiente|||m', true], ['Ordenada en el origen|||b', true], ['Variable independiente|||x', true], ['Variable dependiente|||y', true]] },
  { subject: 'Geografía e Historia', type: 'drag_drop', text: 'Asigna cada elemento geográfico a su categoría.', explanation: 'Los elementos se clasifican por su naturaleza geográfica.', hint: 'Distingue entre relieve, hidrografía y división política.', answers: [['Pirineos|||Relieve', true], ['Ebro|||Hidrografía', true], ['Andalucía|||Comunidad autónoma', true]] },
  { subject: 'Programación Avanzada', type: 'multiple_choice', text: '¿Cuál es la complejidad temporal de una búsqueda binaria sobre una colección ordenada?', explanation: 'Cada comparación reduce aproximadamente a la mitad el espacio de búsqueda.', hint: 'Piensa cuántas veces puede dividirse el problema entre dos.', answers: [['O(1)', false], ['O(log n)', true], ['O(n)', false], ['O(n²)', false]] },
  { subject: 'Fisioterapia', type: 'true_false', text: 'El calentamiento progresivo puede preparar al organismo para una actividad física posterior.', explanation: 'Un calentamiento adecuado incrementa gradualmente la activación antes del esfuerzo.', hint: 'Piensa en la transición entre reposo y ejercicio.', answers: [['Verdadero', true], ['Falso', false]] },
  { subject: 'Fisioterapia', type: 'open_answer', text: 'Explica brevemente por qué es importante adaptar un ejercicio terapéutico a la capacidad funcional de la persona.', explanation: 'La adaptación individual permite ajustar dificultad, seguridad y progresión.', hint: 'Relaciona seguridad, dificultad y progresión.', answers: [['Debe ajustarse a la capacidad funcional para mantener la seguridad y permitir una progresión adecuada.', true]] },
]

export const DEMO_SUPPORT_TICKETS = [
  { studentIndex: 0, category: 'preguntas', subject: 'Duda sobre una pregunta de Matemáticas', message: 'Al revisar una partida no termino de entender la explicación de una pregunta. ¿Podríais indicarme dónde consultar el razonamiento completo?', priority: 'medium', status: 'open' },
  { studentIndex: 1, category: 'cursos', subject: 'No encuentro una actividad del curso', message: 'La actividad aparece en el historial, pero no la veo en el tema actual. Querría confirmar si sigue disponible.', priority: 'low', status: 'in_progress', adminResponse: 'Estamos revisando la disponibilidad del tema y la configuración de la clase.' },
  { studentIndex: 2, category: 'plataforma', subject: 'Consulta sobre el progreso mostrado', message: 'Después de completar varias preguntas quería confirmar cómo se calcula el progreso del tema.', priority: 'medium', status: 'resolved', adminResponse: 'El progreso se calcula a partir de la actividad registrada y de las puntuaciones consolidadas. Los datos de tu perfil ya se muestran correctamente.' },
]
