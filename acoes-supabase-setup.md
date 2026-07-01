# Ações da equipe (marcar ciente / nota / atribuir) — tabela no Supabase

O painel grava as ações no Supabase. Rode este SQL uma vez (Supabase → SQL Editor → New query → Run):

```sql
create table if not exists acoes (
  id         bigserial primary key,
  ref        text not null,          -- protocolo (ou Travel ID) da viagem
  tipo       text not null,          -- ciente | nota | atribuido
  texto      text,                   -- conteúdo da nota, ou o responsável (atribuido)
  autor      text,                   -- quem registrou (nome que a pessoa digita no painel)
  criado_em  timestamptz default now()
);
create index if not exists idx_acoes_ref on acoes (ref);

-- Segurança: leitura E inserção públicas (o painel escreve com a chave anon).
-- Ninguém consegue apagar/editar — só ler e adicionar.
alter table acoes enable row level security;
create policy "acoes leitura"  on acoes for select to anon using (true);
create policy "acoes inserir"  on acoes for insert to anon with check (true);
```

Deve aparecer "Success. No rows returned".

## Como funciona no painel
- Abra o detalhe de qualquer viagem (clique numa linha) → seção **"Ações da equipe"**.
- **Marcar ciente**: registra que você viu/está cuidando.
- **Nota**: um comentário livre ("motorista avisou atraso, acionei a base às 14h").
- **Atribuir**: joga a viagem pra um responsável.
- Na primeira ação, o painel pergunta seu **nome** (fica salvo no navegador) — aparece do lado de cada ação.
- As ações aparecem pra todo mundo que abrir aquela viagem (ficam no Supabase).

## Observação de acesso
A chave `anon` permite **inserir** ações (necessário pro painel gravar). Como o site é público hoje, qualquer um com o painel poderia registrar ações. Quando ligarmos o **controle de acesso** (login), isso fica restrito a quem tem conta. Ninguém consegue apagar/editar ações — só ler e adicionar (histórico à prova de rasura).
