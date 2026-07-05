# Migração: pré check-in no histórico

Pra a tabela histórica ("Atrasos sem ocorrência" na aba Alertas) também usar o **pré check-in** como prova de chegada no prazo, a tabela `viagens_historico` ganha 3 colunas.

## 1) Rode este SQL uma vez (Supabase → SQL Editor → New query → Run)

```sql
alter table viagens_historico add column if not exists pre_check_origem  text;
alter table viagens_historico add column if not exists pre_check_destino text;
alter table viagens_historico add column if not exists destino_eta       text;
```

Deve aparecer "Success".

## 2) Atualize o Apps Script

Cole a versão nova de `historico-supabase-apps-script.gs.txt` (já passa a gravar `pre_check_origem` = Base col V, `pre_check_destino` = Base col AF e `destino_eta` = Base col Y). Rode **`enviarHistoricoSupabase`** de novo — o upsert preenche as colunas novas nos registros existentes.

## 3) O que muda

- **Regra:** uma viagem finalizada que consta **atrasada** mas cujo **pré check-in destino** foi **antes do `destino_eta`** (chegou no prazo pelo GPS) **não** aparece mais como "precisa de ocorrência". O GPS vale como prova.
- Isso deixa a tabela de risco (histórica) alinhada com a tabela ao vivo da aba Alertas — as duas usam o mesmo critério de pré check-in, com a **Base como referência**.
