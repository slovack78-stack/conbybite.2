# CONBYBITE 2.0 — HELLO FRIEND · BY SLOVACK

Inteligência artificial pessoal desenvolvida por **SLOVACK**. Abre com uma tela animada *HELLO FRIEND — BY SLOVACK*, conversa usando modelos reais do **Groq**, pesquisa na internet quando precisa e mostra as **fontes**, fala com **voz masculina** e tem **modo mãos livres** com reconhecimento de voz. Funciona no navegador do Android (pode ser instalado como app) e no **Termux**.

## Recursos

- Tela de abertura animada (HELLO FRIEND / BY SLOVACK) com bolhas e nuvens discretas flutuando.
- Avatar opcional: **esfera** ou **robozinho**, que reage ao ouvir, pensar e falar.
- IA via API do Groq (`llama-3.3-70b-versatile` por padrão, com modelos reserva automáticos).
- Pesquisa real na internet (DuckDuckGo + Wikipédia, sem chave; Tavily opcional) com citações `[1]`, `[2]` e lista de fontes.
- Modo de pesquisa: **Auto** (a IA decide), **Sempre** ou **Off**.
- Voz masculina (escolhe automaticamente a melhor voz masculina em português do aparelho, ou deixa o tom mais grave).
- Reconhecimento de voz em pt-BR e **mãos livres**: ouve → responde → fala → volta a ouvir. Diga “parar” para sair.
- Identidade: reconhece SLOVACK como seu criador e desenvolvedor.
- Segurança: a chave do Groq fica só no servidor (Netlify), nunca vai para o navegador nem para o Termux. Limite de mensagens por minuto, validação de entrada e cabeçalhos de segurança.
- Baixo consumo: animações só com `transform/opacity`, sem bibliotecas pesadas, respostas sem streaming, histórico curto enviado ao servidor. Respeita “reduzir movimento”.

## Tecnologias

TanStack Start (React 19) + Tailwind CSS 4, rotas de API no próprio app (Netlify Functions), Groq REST API, Web Speech API (voz e reconhecimento), cliente Node para Termux.

## Configuração (obrigatória)

No painel do Netlify: **Project configuration › Environment variables**, adicione:

| Variável | Obrigatória | Descrição |
| --- | --- | --- |
| `GROQ_API_KEY` | sim | Crie em https://console.groq.com/keys |
| `GROQ_MODEL` | não | Modelo principal (padrão `llama-3.3-70b-versatile`) |
| `GROQ_FAST_MODEL` | não | Modelo que decide se precisa pesquisar (padrão `llama-3.1-8b-instant`) |
| `TAVILY_API_KEY` | não | Melhora a pesquisa web (https://tavily.com) |
| `CONBYBITE_RATE_LIMIT` | não | Mensagens por minuto por IP (padrão 20) |

Depois faça um novo deploy. Nunca coloque a chave no código.

## Rodar localmente

```bash
pnpm install
netlify dev            # usa as variáveis do projeto Netlify
# ou: GROQ_API_KEY=... pnpm dev   → http://localhost:3000
```

## Android

1. Abra o site no **Chrome** do Android.
2. Menu ⋮ › **Adicionar à tela inicial** (vira um app).
3. Permita o microfone quando pedir. Para uma voz masculina melhor: Configurações do Android › Idioma › Saída de texto para fala › Google › instale vozes em Português (Brasil) e escolha uma voz masculina na engrenagem do CONBYBITE.

## Termux

Requer os apps **Termux** e **Termux:API** (F-Droid).

```bash
curl -fsSL https://conbybite-2.netlify.app/termux/instalar.sh | bash
conbybite --teste        # testa a conexão
conbybite                # chat por texto
conbybite --voz          # respostas faladas (voz grave)
conbybite --maos-livres  # conversa só por voz
conbybite --pesquisa=on  # auto | on | off
```

Para apontar para outro servidor: `CONBYBITE_URL=https://seu-site.netlify.app conbybite`.

## Testes

```bash
# saúde do servidor (mostra se a chave do Groq está configurada, sem revelá-la)
curl https://conbybite-2.netlify.app/api/health

# pergunta com pesquisa obrigatória e fontes
curl -X POST https://conbybite-2.netlify.app/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Quais as últimas notícias sobre IA?"}],"search":"on"}'

# identidade
curl -X POST https://conbybite-2.netlify.app/api/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Quem te criou?"}],"search":"off"}'
```

Checklist manual: tela HELLO FRIEND aparece e some (ou toque para pular) · perguntar por texto · botão do microfone · “Testar voz” nas configurações · ativar mãos livres e dizer “parar” · trocar esfera/robozinho · pergunta atual mostra fontes clicáveis.
