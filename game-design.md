# Juegos de Telemonitorización para Rehabilitación de Ictus

## Objetivo

Maximizar la calidad de métricas clínicas extraíbles del hand tracking para monitorizar remotamente la evolución de un paciente con ictus desde su casa.

---

## Juegos

### 1. Apertura Progresiva (Graded Grip)

Una barra o globo se infla según cuánto abra la mano. El paciente debe mantener una apertura objetivo durante X segundos.

**Métricas clínicas:**
- Apertura máxima (rango de movimiento activo)
- Tiempo sostenido en target (control tónico)
- Variabilidad de la apertura mientras mantiene (estabilidad)
- Velocidad de apertura y cierre (reclutamiento muscular)
- Curva de fatiga (degradación con repeticiones)

**Mide clínicamente:** espasticidad flexora, fuerza extensora, resistencia

**Detección técnica:** distancia media de puntas de dedos (4,8,12,16,20) a la muñeca (0)

---

### 2. Reacción con Dedos (Finger Tapping)

Aparecen estímulos visuales y el paciente debe tocar/extender un dedo concreto lo más rápido posible.

**Métricas clínicas:**
- Tiempo de reacción por dedo (ms)
- Tasa de errores (dedo equivocado)
- Ratio de individualización (¿se mueven otros dedos al mover uno?)
- Cadencia máxima de tapping repetitivo
- Asimetría entre dedos

**Mide clínicamente:** velocidad de procesamiento, individualización digital, hemiparesia distal

**Detección técnica:** extensión individual = distancia punta de dedo a MCP > umbral; otros dedos deben permanecer flexionados

---

### 3. Seguir el Camino (Tracing)

El paciente sigue una línea o forma en pantalla con el dedo índice extendido.

**Métricas clínicas:**
- Desviación media del trayecto ideal (precisión motora)
- Velocidad media y variabilidad (control motor)
- Jitter/temblor (frecuencia de micro-correcciones laterales)
- Diferencia entre mano afectada vs sana
- Fatiga: precisión al inicio vs al final del trazo

**Mide clínicamente:** coordinación ojo-mano, temblor, espasticidad

**Detección técnica:** posición del landmark 8 (punta del índice) proyectada en 2D

---

### 4. Pinza Calibrada (Precision Pinch)

Objetos de tamaños decrecientes que requieren más precisión para agarrar y mover.

**Métricas clínicas:**
- Tamaño mínimo que puede agarrar (resolución motora)
- Tiempo para completar agarre (planning motor)
- Suavidad de la trayectoria de transporte (desviaciones)
- Tasa de drops (estabilidad del agarre)
- Tiempo total por nivel

**Mide clínicamente:** pinza fina, oposición del pulgar, control dinámico

**Detección técnica:** distancia entre landmarks 4 y 8 (ya implementado)

---

### 5. Pronación/Supinación (Wrist Rotation)

Girar una llave o volante virtual siguiendo indicaciones de dirección.

**Métricas clínicas:**
- Rango de rotación (grados de pronación/supinación)
- Velocidad angular
- Suavidad (derivada del ángulo en el tiempo)
- Capacidad de mantener posición objetivo
- Asimetría pronación vs supinación

**Mide clínicamente:** movilidad del antebrazo, co-contracción

**Detección técnica:** ángulo formado por el plano de la palma (landmarks 0, 5, 17) respecto al plano frontal

---

## Prioridad de Implementación

| Prioridad | Juego | Justificación |
|---|---|---|
| 1 | Apertura progresiva | Métrica directa de espasticidad (problema #1 post-ictus), funciona con poca movilidad |
| 2 | Finger tapping | Tiempo de reacción + individualización = oro clínico para seguir evolución |
| 3 | Seguir camino | Mide temblor y coordinación de forma muy sensible, detecta cambios sutiles |
| 4 | Pinza calibrada | Ya montado, solo añadir niveles y logging |
| 5 | Pronación/supinación | Requiere detección de rotación de palma (más complejo) |

---

## Estructura de Datos para Telemonitorización

```ts
interface SessionMetrics {
  patientId: string;
  timestamp: string;
  game: string;
  duration_seconds: number;
  hand: "left" | "right";

  // Comunes a todos los juegos
  completionRate: number;       // 0-1
  avgReactionTime_ms: number;
  fatigueIndex: number;         // ratio rendimiento final / inicial

  // Específicas por juego
  metrics: Record<string, number>;
}
```

Esto se puede enviar a un backend y un terapeuta visualiza la evolución semana a semana en un dashboard.

---

## Notas Técnicas

- Todos los juegos usan la misma base: webcam + MediaPipe HandLandmarker + Three.js
- La mano procedural (esferas + cilindros) funciona como feedback visual en todos
- Las métricas se calculan frame a frame y se agregan al final de cada sesión
- Se recomienda sesiones de 5-10 minutos, 2-3 veces al día
