# Divergências de sigla na aba Origem-destino

Pente-fino nas **7281 linhas** da aba (não só as em uso). Critério: a sigla na coluna **B** (origem) ou **D** (destino) é uma sigla **válida da Links**, mas **não bate** com a sigla da nomenclatura (coluna F) — ou seja, trocaram uma sigla por outra (typo), não é hub que falta cadastrar.

- **Nenhuma destas está em uso agora** (as 176 rotas rodando estão limpas — você já corrigiu as 3 que apareceram).
- São 35 no total. Estão separadas por confiança.
- Formato: `coluna ATUAL → CORRETO`.

## Typos claros (rota de 2 trechos — pode corrigir direto)

| Linha | Nomenclatura | Corrigir |
|---|---|---|
| 5946 | BRXSP10-SRJ1.SOW.VEN | D: SRJ10 → **SRJ1** |
| 6033 | BRXSP9-SPA1.SOW.VEN.GRA.0336 | B: BRXSP10 → **BRXSP9** |
| 6078 | SSP22-BRRC01.SOW.CON.MWH.0580 | B: SSP23 → **SSP22** |
| 6114 | BRAAM1-SAM1.SOW.AIR.VEN.0405 | B: BRAMA1 → **BRAAM1** |
| 6166 | SSP12-BRRC02.SOW.0645.CON.MWH | B: SSP22 → **SSP12** |
| 6169 | SSP22-BRRC01.SOW.0584.CON.MWH | D: BRRC02 → **BRRC01** |
| 6230 | BRAAM1-SAM1.SOW.0181.AIR.VEN | B: BRAMA1 → **BRAAM1** |
| 6429 | SSP22-BRRC02.SOW.0614.CON.MWH | D: BRSC02 → **BRRC02** |
| 6572 | SAM1-BRAAM1.CPL.0291.AIR.REV.INA | D: BRAMA1 → **BRAAM1** |
| 6658 | SAM1-BRAAM1.CPL.0287.AIR.REV.INA | D: SAM1 → **BRAAM1** |
| 6727 | BRRC01-SSP22.CPL.0650.CON.MWH.REV.MAN | D: SPA1 → **SSP22** |
| 6787 | SBA4-BRBA01.CPL.0319.REV.TPA | D: BRXBA1 → **BRBA01** |
| 6863 | BRRC02-SSP12.CPL.0663.CON.MWH.REV.MAN | D: SSP22 → **SSP12** |
| 6864 | BRRC02-SSP12.CPL.0654.CON.MWH.REV.MAN | D: SSP22 → **SSP12** |
| 7082 | BRAAM1-SAM1.SOW.0338.AIR.VEN | B: BRAMA1 → **BRAAM1** |
| 7084 | SBA2-BRXBA1.CPL.0258.REV.DEV | D: SBA1 → **BRXBA1** |
| 7091 | SAL1-BRXBA1.CPL.0531.REV.DEV | D: SBA1 → **BRXBA1** |
| 7137 | BRRC02-SSP22.CPL.0780.CON.MWH.REV.MAN | D: BRRC02 → **SSP22** |
| 7138 | BRPE01-SRN1.SOW.0064.VEN | D: BRPE01 → **SRN1** |
| 7139 | BRXSP9-SPA1.SOW.0088.VEN.GRA | D: BRXSP9 → **SPA1** |
| 7140 | BRXSP9-SPA1.SOW.0097.VEN.GRA | D: BRXSP9 → **SPA1** |
| 7141 | BRRC02-SSP22.CPL.0636.CON.MWH.REV.MAN | D: BRRC02 → **SSP22** |

## Multi-trecho (3+ siglas — CONFERIR antes de mexer)

Aqui a rota passa por mais de um ponto. Eu inferi **destino = última sigla** da nomenclatura, mas em rota de vários trechos isso pode não ser o que vocês querem registrar. **Confirme qual é o destino real antes de corrigir.**

| Linha | Nomenclatura | O que eu inferi |
|---|---|---|
| 4688 | LH-BRSP10-BRSP04-SSP26 | B: BRSP04 → BRSP10 (?) |
| 4744 | LH-BRSP09-BRSP10-SSP20 | D: BRSP09 → SSP20 (?) |
| 4896 | LH-BRBA01-SCE1-BRCE01 | D: SCE1 → BRCE01 (?) |
| 5024 | LH-BRSP11-BRXSP10-SRJ6 | B: BRXSP10 → BRSP11 (?) |
| 6162 | SPI1-BRXBA1-BRBA01.CPL.REV.DEV.MAN.0561 | D: BRBA02 → BRBA01 (?) |
| 6187 | SMN1-BRXBA1-BRBA01.CPL.REV.DEV.MAN.0228 | D: BRBA02 → BRBA01 (?) |
| 6740 | BRBA02-BRBA01-SMN1.SOW.0172.VEN | D: BRBA01 → SMN1 (?) |
| 6819 | BRBA02-BRBA01-SBA2.SOW.0336.VEN | B: SPA1 → BRBA02 (?) |
| 6840 | BRBA02-BRBA01-SMN1.SOW.0138.VEN | D: BRBA01 → SMN1 (?) |
| 6910 | BRBA02-BRBA01-SMN1.SOW.0571.VEN | D: BRBA01 → SMN1 (?) |
| 6981 | SMN1-BRXBA1-BRBA01.CPL.0572.REV.DEV.MAN | D: BRXBA1 → BRBA01 (?) |
| 7024 | SPI1-BRXBA1-BRBA01.CPL.0296.REV.DEV.MAN | D: SBA1 → BRBA01 (?) |
| 7102 | BRBA02-BRBA01-SMN1.SOW.0352.VEN | D: BRBA01 → SMN1 (?) |

## Observações

- Padrões recorrentes que valem revisar no cadastro: **BRAMA1** aparece várias vezes onde deveria ser **BRAAM1** (letras invertidas), e algumas rotas com **BRRC02/SSP22/SSP12** trocadas entre si.
- O teste não cobre nomenclaturas com hubs que **não estão na aba Links** (ele pula com segurança em vez de chutar). Se cadastrar esses hubs na Links, dá pra rodar o pente-fino de novo e cobrir mais.
- Como nenhuma está em uso, isso não afeta o painel hoje — é manutenção preventiva.
