# Ideas de Juegos de Pinza — MVP para Inversores

## Principio general

El gesto es siempre el mismo (pinch pulgar+índice para agarrar, abrir para soltar), pero el contexto del juego cambia para trabajar distintas habilidades y generar métricas diferentes. Cada "juego" es en realidad un modo dentro de la misma app.

---

## 1. El Laboratorio (Clasificación por precisión)

**Concepto:** Mesa de laboratorio minimalista. Hay tubos de ensayo de colores y el paciente debe coger cada bola de color y meterla en el tubo correspondiente.

**Por qué vende:**
- Visualmente limpio y elegante
- Se entiende en 2 segundos
- Tiene progresión natural: más colores, tubos más estrechos, bolas más pequeñas

**Métricas únicas:**
- Tasa de error cognitivo (bola en tubo equivocado) — mide atención + motor
- Precisión de inserción (margen de error al soltar dentro del tubo)
- Velocidad de decisión: tiempo entre coger y dirigirse al tubo correcto

**Niveles:**
- Fácil: 3 colores, tubos anchos
- Medio: 5 colores, tubos normales, bolas más pequeñas
- Difícil: 7 colores, tubos estrechos, bolas diminutas, algunas con dos colores (decidir cuál domina)

---

## 2. El Relojero (Ensamblaje)

**Concepto:** Piezas de un mecanismo (engranajes, tornillos, piezas geométricas) que hay que colocar en su hueco correspondiente (tipo puzzle shape-sorter).

**Por qué vende:**
- Evoca precisión profesional — "está entrenando como si trabajara"
- Los inversores ven inmediatamente la conexión con actividades de la vida diaria (AVD)
- Progresión obvia: piezas más pequeñas, huecos más ajustados, rotación necesaria

**Métricas únicas:**
- Precisión angular (si la pieza necesita orientarse antes de encajar)
- Intentos por pieza (frustration index)
- Tiempo de planificación vs tiempo de ejecución

**Niveles:**
- Fácil: formas grandes (círculo, cuadrado), sin rotación
- Medio: formas irregulares, necesita orientar
- Difícil: piezas pequeñas, encaje ajustado, múltiples piezas que se parecen

---

## 3. La Cocina (Contextual y motivador)

**Concepto:** Recetas simples. Coger ingredientes (tomates, huevos, especias) y ponerlos en una olla/sartén en orden. El plato se "cocina" al completar la receta.

**Por qué vende:**
- Contexto real y cotidiano — el inversor piensa "esto ayuda a que vuelva a cocinar"
- Gamificación natural (recetas desbloqueables, platos cada vez más complejos)
- Combina motor + cognitivo (recordar secuencia de ingredientes)

**Métricas únicas:**
- Errores de secuencia (memoria de trabajo)
- Velocidad de búsqueda visual (encontrar el ingrediente correcto entre varios)
- Mejora en tareas funcionales simuladas (narrativa para el terapeuta)

**Niveles:**
- Fácil: 3 ingredientes grandes, orden libre
- Medio: 5 ingredientes, orden específico
- Difícil: ingredientes similares visualmente, tiempo limitado, distracciones

---

## 4. Jardín Zen (Relajación + precisión)

**Concepto:** Un jardín minimalista. Coger piedras, flores o semillas y colocarlas en patrones. No hay prisa, no hay fallos. Solo precisión y estética.

**Por qué vende:**
- Diferenciador brutal: "no es solo rehabilitación, es terapéutico emocionalmente"
- Apela a bienestar, no solo a clínica
- Perfecto para sesiones de baja energía o pacientes con ansiedad post-ictus

**Métricas únicas:**
- Suavidad del transporte (jerk mínimo = más relajado)
- Duración voluntaria de sesión (engagement sin presión)
- Patrones de colocación (creatividad, planificación espacial)

**Niveles:**
- No hay niveles, es sandbox
- Pero se pueden sugerir patrones a reproducir para pacientes que lo prefieran

---

## 5. Rescate Espacial (Gamificado al máximo)

**Concepto:** Asteroides/piezas de una nave rota flotan en pantalla. El paciente debe "rescatarlas" (pinch + mover a la zona de la nave). Cada pieza reparada enciende una parte de la nave.

**Por qué vende:**
- Alto engagement — hay narrativa, progresión, recompensa visual
- Ideal para pacientes jóvenes o niños con ACV pediátrico
- Se puede hacer cooperativo (dos manos = dos jugadores, familiar ayudando)

**Métricas únicas:**
- Objetos rescatados por minuto (productividad motora bajo presión)
- Tiempo de adquisición de target (planning motor en espacio abierto)
- Manejo de prioridades (objetos que se van si no los coges a tiempo)

**Niveles:**
- Fácil: piezas lentas, grandes, sin urgencia
- Medio: piezas se alejan lentamente, hay que priorizar
- Difícil: piezas rápidas, pequeñas, múltiples simultáneas

---

## Comparativa para el MVP

| Juego | Impacto visual | Valor clínico | Facilidad de implementar | Nota para inversores |
|---|---|---|---|---|
| Laboratorio | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | "Combina motor + cognitivo" |
| Relojero | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | "Entrenamiento funcional" |
| Cocina | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | "Actividades de la vida diaria" |
| Jardín Zen | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | "Bienestar + rehabilitación" |
| Rescate Espacial | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ | "Engagement y adherencia" |

---

## Recomendación para el MVP

**Montar EL LABORATORIO** como juego principal:
- Es el que mejor equilibra impresión visual + métricas clínicas reales
- Se implementa fácilmente encima de lo que ya tenemos (pinch + mover a zona)
- El pitch es directo: "El paciente clasifica, nosotros medimos precisión motora Y cognitiva simultáneamente"
- Da pie a decir: "Y tenemos 4 modos más en roadmap"

---

## El pitch de 30 segundos

> "Con una webcam y 10 minutos al día, monitorizamos la recuperación motora de un paciente con ictus desde su casa. El paciente juega, nosotros extraemos métricas clínicas validadas que el terapeuta ve en tiempo real. Sin hardware, sin desplazamientos, sin listas de espera."
