import type { DirectMessage, Message, Server, User } from './types';

export const ME = 'u-me';

export const users: Record<string, User> = {
  'u-me': { id: 'u-me', name: 'luiz', color: '#5865f2', status: 'online', activity: 'Recriando o Discord' },
  'u-ana': { id: 'u-ana', name: 'Ana', color: '#eb459e', status: 'online', activity: 'Jogando Valorant' },
  'u-bruno': { id: 'u-bruno', name: 'Bruno', color: '#f0b232', status: 'idle' },
  'u-carla': { id: 'u-carla', name: 'Carla', color: '#23a55a', status: 'dnd', activity: 'Focada' },
  'u-diego': { id: 'u-diego', name: 'Diego', color: '#00a8fc', status: 'online', activity: 'Ouvindo Spotify' },
  'u-eva': { id: 'u-eva', name: 'Eva', color: '#f23f43', status: 'offline' },
  'u-felipe': { id: 'u-felipe', name: 'Felipe', color: '#9b59b6', status: 'offline' },
  'u-bot': { id: 'u-bot', name: 'MEE7', color: '#5865f2', status: 'online', bot: true },
};

const t = (minutesAgo: number) => Date.now() - minutesAgo * 60_000;

export const servers: Server[] = [
  {
    id: 's-dev',
    name: 'Dev Brasil',
    acronym: 'DB',
    color: '#5865f2',
    roles: [
      { id: 'r-admin', name: 'Admin', color: '#f23f43', members: ['u-me', 'u-ana'] },
      { id: 'r-mod', name: 'Moderador', color: '#f0b232', members: ['u-carla'] },
      { id: 'r-bots', name: 'Bots', color: '#5865f2', members: ['u-bot'] },
      { id: 'r-membro', name: 'Membro', color: '#b5bac1', members: ['u-bruno', 'u-diego', 'u-eva', 'u-felipe'] },
    ],
    categories: [
      {
        id: 'c-info',
        name: 'Informações',
        channels: [
          { id: 'ch-regras', name: 'regras', kind: 'text', topic: 'Leia antes de postar.' },
          { id: 'ch-anuncios', name: 'anúncios', kind: 'announcement', topic: 'Novidades do servidor.' },
        ],
      },
      {
        id: 'c-texto',
        name: 'Canais de texto',
        channels: [
          { id: 'ch-geral', name: 'geral', kind: 'text', topic: 'Papo livre sobre tudo.' },
          { id: 'ch-frontend', name: 'frontend', kind: 'text', topic: 'React, CSS e afins.' },
          { id: 'ch-backend', name: 'backend', kind: 'text', topic: 'APIs, bancos e infraestrutura.' },
          { id: 'ch-memes', name: 'memes', kind: 'text' },
        ],
      },
      {
        id: 'c-voz',
        name: 'Canais de voz',
        channels: [
          { id: 'ch-lounge', name: 'Lounge', kind: 'voice' },
          { id: 'ch-pair', name: 'Pair programming', kind: 'voice' },
        ],
      },
    ],
  },
  {
    id: 's-games',
    name: 'Jogatina',
    acronym: 'J',
    color: '#23a55a',
    roles: [
      { id: 'r-dono', name: 'Dono', color: '#23a55a', members: ['u-ana'] },
      { id: 'r-player', name: 'Players', color: '#b5bac1', members: ['u-me', 'u-diego', 'u-bruno', 'u-felipe'] },
    ],
    categories: [
      {
        id: 'c-g-texto',
        name: 'Texto',
        channels: [
          { id: 'ch-g-geral', name: 'geral', kind: 'text', topic: 'Bora jogar?' },
          { id: 'ch-g-clips', name: 'clips', kind: 'text', topic: 'Mostre suas melhores jogadas.' },
        ],
      },
      {
        id: 'c-g-voz',
        name: 'Voz',
        channels: [
          { id: 'ch-g-squad', name: 'Squad', kind: 'voice' },
          { id: 'ch-g-afk', name: 'AFK', kind: 'voice' },
        ],
      },
    ],
  },
  {
    id: 's-estudos',
    name: 'Grupo de Estudos',
    acronym: 'GE',
    color: '#eb459e',
    roles: [
      { id: 'r-prof', name: 'Monitor', color: '#eb459e', members: ['u-carla'] },
      { id: 'r-aluno', name: 'Alunos', color: '#b5bac1', members: ['u-me', 'u-eva', 'u-bruno'] },
    ],
    categories: [
      {
        id: 'c-e-texto',
        name: 'Estudos',
        channels: [
          { id: 'ch-e-duvidas', name: 'dúvidas', kind: 'text', topic: 'Pergunte sem medo.' },
          { id: 'ch-e-material', name: 'material', kind: 'text', topic: 'Links e resumos.' },
        ],
      },
      {
        id: 'c-e-voz',
        name: 'Salas',
        channels: [{ id: 'ch-e-sala', name: 'Sala de estudo', kind: 'voice' }],
      },
    ],
  },
];

export const directMessages: DirectMessage[] = [
  { id: 'dm-ana', userId: 'u-ana' },
  { id: 'dm-diego', userId: 'u-diego' },
  { id: 'dm-carla', userId: 'u-carla' },
  { id: 'dm-bruno', userId: 'u-bruno' },
];

export const seedMessages: Record<string, Message[]> = {
  'ch-geral': [
    { id: 'm1', authorId: 'u-ana', content: 'Bom dia, pessoal! ☀️', timestamp: t(180) },
    { id: 'm2', authorId: 'u-ana', content: 'Alguém já testou o React 19?', timestamp: t(179) },
    { id: 'm3', authorId: 'u-diego', content: 'Testei sim, as Actions ficaram bem legais.', timestamp: t(170) },
    { id: 'm4', authorId: 'u-bruno', content: 'Ainda tô no 18 aqui no trampo 😅', timestamp: t(95) },
    { id: 'm5', authorId: 'u-bot', content: 'GG @Bruno, você subiu para o nível 12!', timestamp: t(94) },
    { id: 'm6', authorId: 'u-carla', content: 'Lembrando: sem spam no #geral, usem o #memes.', timestamp: t(30) },
    { id: 'm7', authorId: 'u-me', content: 'Tô recriando a interface do Discord do zero, depois mostro aqui!', timestamp: t(4) },
  ],
  'ch-regras': [
    { id: 'r1', authorId: 'u-ana', content: '1. Respeite todo mundo.\n2. Nada de spam.\n3. Use o canal certo para cada assunto.', timestamp: t(60 * 24 * 30) },
  ],
  'ch-frontend': [
    { id: 'f1', authorId: 'u-diego', content: 'Alguém tem uma dica boa de CSS para layout de 4 colunas?', timestamp: t(300) },
    { id: 'f2', authorId: 'u-me', content: 'Flexbox resolve: colunas fixas e a do meio com flex: 1.', timestamp: t(298) },
  ],
  'ch-g-geral': [
    { id: 'g1', authorId: 'u-ana', content: 'Bora uma ranked hoje às 21h?', timestamp: t(50) },
    { id: 'g2', authorId: 'u-felipe', content: 'Tô dentro!', timestamp: t(48) },
  ],
  'dm-ana': [
    { id: 'd1', authorId: 'u-ana', content: 'Oi! Viu o que eu mandei no servidor?', timestamp: t(20) },
    { id: 'd2', authorId: 'u-me', content: 'Vi sim, já respondo lá.', timestamp: t(18) },
  ],
};
