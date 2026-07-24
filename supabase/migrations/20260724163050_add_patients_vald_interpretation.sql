-- ============================================
-- Fase 0 — Tarea 5: recuperar la feature de "interpretación VALD"
-- ============================================
-- Añade la columna `vald_interpretation` a `patients`. El código ya la
-- referenciaba (DocumentSection la escribe, la ficha del paciente la lee, y
-- /api/reports/generate la añade al contexto de la IA), pero la columna no
-- existía en la DB → el update fallaba y se tragaba el error (pérdida silenciosa
-- de datos). Con esta columna, el flujo pasa a persistir y llegar al informe.
--
-- Aplicada en prod vía MCP `apply_migration` (versión 20260724163050).
-- Aditiva y nullable → segura, no rompe el código desplegado.
-- ============================================

ALTER TABLE patients ADD COLUMN IF NOT EXISTS vald_interpretation TEXT;
