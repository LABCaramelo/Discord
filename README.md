# Discord (clone)

Recriação da interface do Discord em React + Vite + TypeScript, com voz, câmera e
compartilhamento de tela de verdade via [LiveKit](https://livekit.io).

O que funciona:

- Servidores, categorias e canais de texto, mensagens diretas e tela de Amigos
- Envio e exclusão de mensagens (salvas só no seu navegador)
- Lista de membros agrupada por cargo, status do usuário
- **Canais de voz reais**: quem abrir o site e entrar no mesmo canal conversa de verdade
  - indicador de quem está falando, silenciar/desativar áudio
  - webcam e compartilhamento de tela (com áudio da aba, quando o navegador permite)
  - a barra lateral mostra quem está em cada canal, mesmo antes de você entrar

O chat de texto e os membros continuam fictícios e locais; só a voz/vídeo passa pelo servidor.
Qualquer pessoa com o link pode entrar nos canais de voz.

Detalhes da janela desktop (barra de título própria, tamanho mínimo 940×500, fundo `#2f3136`)
vieram da análise do `core.asar` do app instalado, feita com o [REA](https://github.com/morluto/rea).

## Configurar o LiveKit (grátis)

1. Crie uma conta em [cloud.livekit.io](https://cloud.livekit.io) e um projeto. O plano Build é
   gratuito e para quando a cota acaba, sem cobrança.
2. Em **Settings → Keys**, gere uma chave. Você vai precisar de três valores:
   `LIVEKIT_URL` (começa com `wss://`), `LIVEKIT_API_KEY` e `LIVEKIT_API_SECRET`.

## Rodar localmente

```bash
npm install
cp .env.example .env.local   # e preencha os três valores
npm run dev
```

Abre em http://localhost:5190. O `npm run dev` também serve a função `/api/livekit`.
Para testar com duas pessoas, abra o site em dois navegadores (ou uma janela anônima).

## Deploy na Vercel

1. Importe o repositório na Vercel; o preset **Vite** é detectado automaticamente.
2. Em **Settings → Environment Variables**, cadastre `LIVEKIT_URL`, `LIVEKIT_API_KEY` e
   `LIVEKIT_API_SECRET`, e faça um novo deploy.

A pasta `api/` vira uma função serverless (`/api/livekit`) que gera os tokens de acesso e
consulta quem está em cada sala; o segredo do LiveKit nunca vai para o navegador.
Câmera, microfone e compartilhamento de tela exigem HTTPS, que a Vercel já fornece.
