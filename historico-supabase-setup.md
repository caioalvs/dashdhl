# Histórico no Supabase — Passo 1: criar projeto e tabela

O Supabase é um Postgres grátis com API pronta. O painel lê dele; o Apps Script escreve nele. Aqui é só o **primeiro passo**: criar o projeto e a tabela. Depois eu te passo o script que alimenta e ligo o painel.

## 1) Criar o projeto (grátis)

1. Acesse **https://supabase.com** → **Start your project** → entre com o Google/GitHub.
2. **New project**:
   - Nome: `dhl-tracking` (ou o que quiser).
   - **Database Password**: crie uma senha forte e **guarde** (você quase não vai usar, mas guarde).
   - Region: **South America (São Paulo)** se aparecer (mais rápido).
3. Espera uns 2 minutos enquanto ele provisiona.

## 2) Criar a tabela (cole o SQL)

No menu lateral do Supabase → **SQL Editor** → **New query** → cole tudo abaixo → **Run**:

```sql
-- (se já tinha criado a versão antiga, isso apaga e recria — a tabela estava vazia)
drop table if exists viagens_historico;

-- Tabela do histórico de viagens.
-- Chave = protocolo + trecho: uma viagem multi-trecho tem VÁRIAS linhas
-- (uma por trecho), todas com o mesmo protocolo. A chave separa cada trecho.
create table viagens_historico (
  chave             text primary key,   -- (protocolo, ou 'R'+route_id se sem protocolo) | trecho
  rostering_id      text,               -- protocolo (pode vir vazio/"0")
  route_id          text,               -- Route ID (chave reserva quando não há protocolo)
  trecho            text,               -- ex.: BRBA02-BRBA01
  data              date,               -- Data Serviço
  servico           text,               -- nomenclatura
  origem            text,
  destino           text,
  saida_programada  text,               -- Origem ETD (deveria sair)
  saida_real        text,               -- Origem ATD (saiu de verdade)
  chegada           text,               -- Destino ATA (chegou)
  estado            text,               -- Finalizado / Cancelado
  resultado         text,               -- No prazo / Atrasado
  pacotes           integer,
  motivo_cancelamento text,             -- motivo (Base col AP) — ex.: Infrutífera
  causa_raiz        text,
  inserido_em       timestamptz default now()
);

-- Índice por data (deixa os relatórios por período rápidos)
create index if not exists idx_viagens_data on viagens_historico (data);

-- Segurança: liga RLS e permite SOMENTE LEITURA pública (o painel lê).
-- A escrita é feita pelo Apps Script com a chave secreta (service_role),
-- que ignora o RLS — então ninguém escreve com a chave pública.
alter table viagens_historico enable row level security;

create policy "leitura publica"
  on viagens_historico
  for select
  to anon
  using (true);
```

Deve aparecer "Success. No rows returned". Pronto, tabela criada.

## 3) Me mandar 2 coisas (são públicas e seguras)

No Supabase → **Project Settings** (engrenagem) → **API**:

- **Project URL** — algo como `https://xxxxxxxx.supabase.co`
- **anon public** (a chave "anon / public") — uma chave longa. **Pode mandar essa** — ela é feita pra ficar no site e só permite leitura (por causa do RLS que criamos).

⚠️ **NÃO me mande** a chave **`service_role`** (a "secret"). Essa é a que escreve — ela fica só no Apps Script, no seu lado. Nunca no painel nem no chat.

---

Quando você me mandar a **Project URL** + a **anon public key**, eu:
- Passo o **Apps Script** que alimenta o Supabase todos os dias (você cola sua service_role key nele — só no script).
- Ligo a aba **Relatórios** no painel lendo o Supabase.

Enquanto isso, os ajustes de hoje (Documentos no ETD, Saída no Portal, Ocorrências no ETA/mapa) já estão prontos pra **Commit → Push**.
