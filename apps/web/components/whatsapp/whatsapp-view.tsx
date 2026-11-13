'use client';

import { ArrowLeft, MessageCircle, Search } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { useDemoChats, type DemoChat } from '@/lib/whatsapp-demo';
import { Composer } from './composer';
import { MessageBubble, Ticks, timeOf } from './message-bubble';

const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

function Avatar({ name }: { name: string }) {
  return (
    <span className="bg-primary-soft text-primary flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
      {initials(name)}
    </span>
  );
}

function ChatRow({ chat, active, onSelect }: { chat: DemoChat; active: boolean; onSelect: () => void }) {
  const last = chat.messages.at(-1);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn('hover:bg-muted flex w-full items-center gap-3 border-b px-3 py-3 text-left', active && 'bg-muted')}
    >
      <Avatar name={chat.name} />
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-sm font-medium">{chat.name}</span>
          {last && <span className="text-muted-foreground shrink-0 text-xs">{timeOf(last.at)}</span>}
        </span>
        <span className="text-muted-foreground flex items-center gap-1 text-xs">
          {last?.from === 'us' && <Ticks status={last.status} />}
          <span className="truncate">{last?.text ?? 'No messages yet'}</span>
        </span>
      </span>
      {chat.unread > 0 && (
        <span className="bg-primary text-primary-foreground flex size-5 shrink-0 items-center justify-center rounded-full text-[11px]">
          {chat.unread}
        </span>
      )}
    </button>
  );
}

export function WhatsappView() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const { chats, sendMessage, markRead } = useDemoChats(activeId);
  const active = chats.find((c) => c.id === activeId) ?? null;
  const bottom = useRef<HTMLDivElement>(null);

  const q = search.trim().toLowerCase();
  const list = q ? chats.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)) : chats;

  // Opening a chat, or a reply landing in the open one, clears its badge and sticks to the bottom.
  const count = active?.messages.length ?? 0;
  const unread = active?.unread ?? 0;
  useEffect(() => {
    if (activeId && unread > 0) markRead(activeId);
  }, [activeId, unread, markRead]);
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [activeId, count]);

  return (
    <div className="bg-background grid h-full min-h-0 grid-cols-1 md:grid-cols-[20rem_minmax(0,1fr)]">
      <aside className={cn('flex min-h-0 flex-col border-r', active && 'hidden md:flex')}>
        <div className="space-y-2 border-b p-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-semibold">WhatsApp</h1>
            <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Demo</span>
          </div>
          <label className="bg-muted flex items-center gap-2 rounded-lg px-3 py-2">
            <Search className="text-muted-foreground size-4" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chats"
              aria-label="Search chats"
              className="w-full bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.length === 0 ? (
            <p className="text-muted-foreground p-4 text-sm">No chats match.</p>
          ) : (
            list.map((c) => <ChatRow key={c.id} chat={c} active={c.id === activeId} onSelect={() => setActiveId(c.id)} />)
          )}
        </div>
      </aside>

      <section className={cn('flex min-h-0 flex-col chat-wallpaper', !active && 'hidden md:flex')}>
        {!active ? (
          <div className="text-muted-foreground m-auto flex flex-col items-center gap-2 text-sm">
            <MessageCircle className="size-10" />
            Select a conversation
          </div>
        ) : (
          <>
            <header className="bg-background flex items-center gap-3 border-b px-3 py-2">
              <button type="button" className="md:hidden" aria-label="Back to chats" onClick={() => setActiveId(null)}>
                <ArrowLeft className="size-5" />
              </button>
              <Avatar name={active.name} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{active.name}</p>
                <p className="text-muted-foreground text-xs">{active.phone} · simulated messages</p>
              </div>
            </header>
            <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
              {active.messages.map((m) => (
                <MessageBubble key={m.id} message={m} />
              ))}
              <div ref={bottom} />
            </div>
            <Composer onSend={(text) => sendMessage(active.id, text)} />
          </>
        )}
      </section>
    </div>
  );
}
