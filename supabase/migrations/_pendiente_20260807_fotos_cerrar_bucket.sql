-- =============================================================
-- Fotos: cerrar el bucket
-- =============================================================
-- Ultimo paso. Aparte va de las policies (20260806) porque este si tiene un
-- requisito de orden: hasta que no este desplegado el codigo que firma las
-- URLs, cerrar el bucket deja las fotos sin cargar para quien esta usando la
-- aplicacion.
--
-- Con el bucket privado, una URL publica guardada deja de servir. El codigo no
-- las usa: extrae la ruta de lo que haya guardado y pide una URL firmada, que
-- solo se emite a quien pasa las policies de storage.

update storage.buckets
   set public = false
 where id = 'fotos-traslados';
