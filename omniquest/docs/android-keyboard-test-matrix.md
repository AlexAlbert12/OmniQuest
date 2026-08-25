# Validación del teclado en Android

OmniQuest mantiene `softwareKeyboardLayoutMode: resize`. No se debe cambiar a `pan` sin repetir esta matriz en un dispositivo Android real con la barra de navegación inferior visible.

## Flujo automatizado

Ejecutar en Android:

```text
maestro test .maestro/android-keyboard-resize.yaml
```

El flujo abre el teclado en Login y Registro, completa el último campo y comprueba que el CTA sigue siendo visible y alcanzable antes de ocultar el teclado.

## Matriz autenticada manual

En cada pantalla: enfocar el último input, mantener el teclado abierto, desplazarse al CTA y comprobar que la navegación inferior no flota sobre el teclado.

| Pantalla | Campo que debe enfocarse | Acción que debe seguir alcanzable |
| --- | --- | --- |
| Login | Contraseña | Entrar |
| Registro | Confirmar contraseña | Crear cuenta |
| Crear pregunta | Último campo del paso activo | Siguiente / Crear pregunta |
| Editar perfil | Nombre visible | Guardar cambios |
| Soporte | Descripción o respuesta | Enviar solicitud / respuesta |
| Búsqueda global | Buscar alumno, curso o clase | Resultado completo y botón cerrar |

La prueba se considera fallida si el input activo queda oculto, el CTA no puede alcanzarse con scroll, el contenido salta fuera del viewport o la navbar queda superpuesta al teclado.
