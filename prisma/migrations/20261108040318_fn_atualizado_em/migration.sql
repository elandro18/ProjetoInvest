-- Função utilitária para manter atualizado_em consistente em tabelas que
-- possuem a coluna. Criada na fundação técnica; passa a ser usada pelas
-- features que adicionarem a coluna (ex.: usuario, ativo, movimentacao).
CREATE OR REPLACE FUNCTION set_atualizado_em()
RETURNS trigger AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
