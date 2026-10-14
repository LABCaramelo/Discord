# Discord (clone)

Recriação da interface do Discord em React + Vite + TypeScript, com dados de exemplo e tudo rodando no navegador.

O que já funciona:

- Servidores, categorias e canais de texto, mensagens diretas e tela de Amigos
- Envio e exclusão de mensagens (salvas no `localStorage`)
- Lista de membros agrupada por cargo, status do usuário
- Canais de voz: entrar/sair, microfone real com indicador de fala, silenciar/desativar áudio
- Webcam e compartilhamento de tela, exibidos na sala de voz

Tudo é local: não há servidor, então mensagens, voz, câmera e tela não chegam a outras pessoas.

Detalhes da janela desktop (barra de título própria, tamanho mínimo 940×500, fundo `#2f3136`)
vieram da análise do `core.asar` do app instalado, feita com o [REA](https://github.com/morluto/rea).

## Rodar localmente

```bash
npm install
npm run dev
```

Abre em http://localhost:5190.

## Deploy na Vercel

Importe o repositório na Vercel; o preset **Vite** é detectado automaticamente
(build `npm run build`, saída `dist`). Câmera, microfone e compartilhamento de tela
exigem HTTPS, que a Vercel já fornece.
