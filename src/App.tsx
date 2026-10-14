import { useEffect, useRef } from 'react';
import { ME, directMessages, servers, users } from './data';
import { useAppStore } from './store';
import { colorFor, playVoiceSound, useVoiceOccupancy, useVoiceSession } from './voice';
import { Avatar } from './components/Avatar';
import { Chat } from './components/Chat';
import { FriendsView } from './components/Friends';
import { MemberList } from './components/MemberList';
import { NamePrompt } from './components/NamePrompt';
import { ServerRail } from './components/ServerRail';
import { ChannelIcon, HomeSidebar, ServerSidebar, type VoiceUi } from './components/Sidebar';
import { TitleBar } from './components/TitleBar';
import { VoiceView } from './components/VoiceView';

export function App() {
  const [state, dispatch] = useAppStore();
  const { view, profile } = state;

  // O usuário "você" do diretório local passa a ter o nome e a cor deste visitante,
  // para o chat, a lista de membros e as salas de voz mostrarem a mesma pessoa.
  users[ME] = { ...users[ME], name: profile.name || 'você', color: colorFor(profile.id) };

  const session = useVoiceSession(state.voice, profile, state.muted, state.deafened);
  const voiceKey = state.voice ? `${state.voice.serverId}:${state.voice.channelId}` : null;
  const occupancy = useVoiceOccupancy(voiceKey);
  const voiceUi: VoiceUi = { session, occupancy };

  const prevVoiceKey = useRef(voiceKey);
  useEffect(() => {
    if (prevVoiceKey.current === voiceKey) return;
    // Com o áudio desativado você também não ouve os sons de entrar/sair.
    if (!state.deafened) playVoiceSound(voiceKey ? 'join' : 'leave');
    prevVoiceKey.current = voiceKey;
  }, [voiceKey, state.deafened]);

  let title = 'Amigos';
  let sidebar: React.ReactNode;
  let content: React.ReactNode;

  if (view.kind === 'server') {
    const server = servers.find((s) => s.id === view.serverId)!;
    const channel = server.categories.flatMap((c) => c.channels).find((c) => c.id === state.channelByServer[server.id])!;
    title = server.name;
    sidebar = <ServerSidebar server={server} state={state} voiceUi={voiceUi} dispatch={dispatch} />;
    content = channel.kind === 'voice' ? (
      <VoiceView
        serverId={server.id}
        channel={channel}
        state={state}
        session={session}
        occupancy={occupancy}
        dispatch={dispatch}
      />
    ) : (
      <>
        <Chat
          conversationId={channel.id}
          title={channel.name}
          icon={<ChannelIcon channel={channel} size={24} />}
          topic={channel.topic}
          placeholder={`Conversar em #${channel.name}`}
          welcome={
            <>
              <div className="welcome-icon">
                <ChannelIcon channel={channel} size={42} />
              </div>
              <h2>Bem-vindo(a) a #{channel.name}!</h2>
              <p>Este é o começo do canal #{channel.name}.</p>
            </>
          }
          messages={state.messages[channel.id] ?? []}
          showMembers={state.showMembers}
          membersToggle
          dispatch={dispatch}
        />
        {state.showMembers && <MemberList server={server} myStatus={state.myStatus} />}
      </>
    );
  } else {
    sidebar = <HomeSidebar dmId={view.dmId} state={state} voiceUi={voiceUi} dispatch={dispatch} />;
    const dm = directMessages.find((d) => d.id === view.dmId);
    if (dm) {
      const user = users[dm.userId];
      title = user.name;
      content = (
        <Chat
          conversationId={dm.id}
          title={user.name}
          icon={<Avatar user={user} size={24} status={user.status} ring="var(--bg-primary)" />}
          placeholder={`Conversar com @${user.name}`}
          welcome={
            <>
              <Avatar user={user} size={80} />
              <h2>{user.name}</h2>
              <p>
                Este é o começo do seu histórico de mensagens diretas com <strong>{user.name}</strong>.
              </p>
            </>
          }
          messages={state.messages[dm.id] ?? []}
          showMembers={false}
          membersToggle={false}
          dispatch={dispatch}
        />
      );
    } else {
      content = <FriendsView dispatch={dispatch} />;
    }
  }

  return (
    <div className="app">
      <TitleBar title={title} />
      <div className="app-body">
        <ServerRail view={view} dispatch={dispatch} />
        <div className="app-panel">
          {sidebar}
          <div className="app-content">{content}</div>
        </div>
      </div>
      {(!profile.name || state.editingName) && <NamePrompt current={profile.name} dispatch={dispatch} />}
    </div>
  );
}
