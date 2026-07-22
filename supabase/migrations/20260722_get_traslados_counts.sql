-- RPC: get_traslados_counts
-- Returns all traslado state counts in a single query instead of 4 separate count queries
CREATE OR REPLACE FUNCTION get_traslados_counts(p_empresa_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT json_build_object(
    'total', count(*),
    'pendiente', count(*) FILTER (WHERE estado = 'pendiente'),
    'en_curso', count(*) FILTER (WHERE estado = 'en_curso'),
    'completado', count(*) FILTER (WHERE estado = 'completado')
  )
  FROM traslados
  WHERE empresa_id = p_empresa_id;
$$;
