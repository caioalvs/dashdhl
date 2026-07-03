# Migração: campo `fase` (ETA × ETD) no histórico

Pra separar **ETA (chegada)** de **ETD (viagem)** nos Relatórios, a tabela `viagens_historico` ganha uma coluna `fase`.

## 1) Rode este SQL uma vez (Supabase → SQL Editor → New query → Run)

```sql
-- adiciona a coluna de fase; registros antigos ficam como 'ETD' (que é o que já era gravado)
alter table viagens_historico add column if not exists fase text default 'ETD';

-- garante que quem já está lá seja marcado como ETD
update viagens_historico set fase = 'ETD' where fase is null;
```

Deve aparecer "Success". Pronto.

## 2) O que muda no fluxo

- O Apps Script atualizado (`historico-supabase-apps-script.gs.txt`) lê **tudo da aba Base** (fonte central) e envia **dois tipos de registro**:
  - **ETD** (viagem) — FINALIZADAS/CANCELADAS, `fase = 'ETD'`. Como já era.
  - **ETA** (chegada na origem) — quando a **Origem ATA (Q)** está preenchida (chegou), comparada com a **Origem ETA (P)** (deveria chegar): no prazo se chegou antes, senão atrasado. `fase = 'ETA'`.
- No painel, a aba **Relatórios** ganhou o filtro **Fase: ETD · Viagem / ETA · Chegada**, que funciona junto com o filtro **Operação: Line Haul / XPT**.
- **Não duplica:** o upsert usa a `chave`. ETD usa `protocolo|trecho` (como antes). ETA usa `protocolo|trecho|ETA` — namespaces diferentes, nunca colidem. Rodar de novo só **sobrepõe/atualiza** os mesmos registros e adiciona os novos.

## 3) Frequência

O agendamento passou de 2×/dia para **a cada 30 minutos**, pra manter o Relatório fresco. Basta rodar `agendarHistoricoSupabase` uma vez (o script já cria o gatilho de 30 min).
