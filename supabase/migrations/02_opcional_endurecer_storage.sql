-- ---------------------------------------------------------------------------
-- OPCIONAL (recomendado). Não rode antes de confirmar que os uploads estão
-- funcionando em produção.
--
-- O app agora envia arquivos por URL assinada emitida no servidor (service
-- role), então a política que permitia INSERT anônimo no bucket virou uma
-- porta aberta sem uso: hoje qualquer pessoa com a chave publicável pode
-- gravar arquivos em `grf-documentos`. Este script fecha essa porta.
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "grf_docs_upload" ON storage.objects;
