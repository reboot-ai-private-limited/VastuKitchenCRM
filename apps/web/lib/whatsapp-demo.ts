'use client';

/**
 * DEMO ONLY. There is no WhatsApp Cloud API connection yet, so this whole module fakes one in the
 * browser: seed chats, and a send that walks sending -> sent -> delivered -> read on timers.
 * Nothing is persisted. When the real integration lands, replace `useDemoChats` with API hooks
 * and delete this file (see docs/whatsapp demo plan).
 */
import { useCallback, useEffect, useReducer, useRef } from 'react';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export interface DemoMessage {
  id: string;
  from: 'us' | 'them';
  text: string;
  at: number; // epoch ms
  status: MessageStatus;
}

export interface DemoChat {
  id: string;
  name: string;
  phone: string;
  unread: number;
  messages: DemoMessage[];
}

/** Delay from the moment of sending to each status. */
export const STATUS_DELAYS: Record<Exclude<MessageStatus, 'sending'>, number> = {
  sent: 400,
  delivered: 2000,
  read: 4500,
};
/** The customer "replies" this long after reading. Set to null to disable. */
export const AUTO_REPLY_AFTER_READ_MS: number | null = 2000;
export const AUTO_REPLY_TEXT = 'Okay, thank you!';

const minsAgo = (m: number) => Date.now() - m * 60_000;

export function seedChats(): DemoChat[] {
  const them = (id: string, text: string, m: number): DemoMessage => ({ id, from: 'them', text, at: minsAgo(m), status: 'read' });
  const us = (id: string, text: string, m: number): DemoMessage => ({ id, from: 'us', text, at: minsAgo(m), status: 'read' });
  return [
    {
      id: 'c1', name: 'Anita Sen', phone: '+91 98300 11111', unread: 1,
      messages: [
        us('c1a', 'Hello Anita, the kitchen design is ready for your review.', 190),
        them('c1b', 'Great! Can we visit the showroom on Saturday?', 12),
      ],
    },
    {
      id: 'c2', name: 'Rahul Mehta', phone: '+91 98300 22222', unread: 0,
      messages: [
        them('c2a', 'What is the status of my wardrobe order?', 1500),
        us('c2b', 'Production is complete; installation is planned for Monday.', 1490),
      ],
    },
    {
      id: 'c3', name: 'Sunita Das', phone: '+91 98300 33333', unread: 2,
      messages: [
        them('c3a', 'Hi, I need a quote for a modular kitchen.', 45),
        them('c3b', 'It is a 10x8 ft L-shaped layout.', 44),
      ],
    },
    { id: 'c4', name: 'Vikram Rao', phone: '+91 98300 44444', unread: 0, messages: [us('c4a', 'Thank you for choosing Vastu Kitchen!', 4000)] },
    { id: 'c5', name: 'Priya Nair', phone: '+91 98300 55555', unread: 0, messages: [] },
  ];
}

type Action =
  | { type: 'send'; chatId: string; message: DemoMessage }
  | { type: 'status'; chatId: string; messageId: string; status: MessageStatus }
  | { type: 'receive'; chatId: string; message: DemoMessage; unread: boolean }
  | { type: 'read'; chatId: string };

export function chatsReducer(state: DemoChat[], action: Action): DemoChat[] {
  return state.map((chat) => {
    if (chat.id !== action.chatId) return chat;
    switch (action.type) {
      case 'send':
        return { ...chat, messages: [...chat.messages, action.message] };
      case 'status':
        return { ...chat, messages: chat.messages.map((m) => (m.id === action.messageId ? { ...m, status: action.status } : m)) };
      case 'receive':
        return { ...chat, unread: chat.unread + (action.unread ? 1 : 0), messages: [...chat.messages, action.message] };
      case 'read':
        return { ...chat, unread: 0 };
    }
  });
}

export function useDemoChats(activeId: string | null) {
  const [chats, dispatch] = useReducer(chatsReducer, undefined, seedChats);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const counter = useRef(0);
  const activeRef = useRef(activeId);
  useEffect(() => {
    activeRef.current = activeId;
  }, [activeId]);

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach(clearTimeout);
  }, []);

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };

  const sendMessage = useCallback((chatId: string, text: string) => {
    const body = text.trim();
    if (!body) return;
    const id = `m${Date.now()}-${counter.current++}`;
    dispatch({ type: 'send', chatId, message: { id, from: 'us', text: body, at: Date.now(), status: 'sending' } });
    const set = (status: MessageStatus) => () => dispatch({ type: 'status', chatId, messageId: id, status });
    later(STATUS_DELAYS.sent, set('sent'));
    later(STATUS_DELAYS.delivered, set('delivered'));
    later(STATUS_DELAYS.read, set('read'));
    if (AUTO_REPLY_AFTER_READ_MS !== null) {
      later(STATUS_DELAYS.read + AUTO_REPLY_AFTER_READ_MS, () =>
        dispatch({
          type: 'receive',
          chatId,
          unread: activeRef.current !== chatId,
          message: { id: `${id}-r`, from: 'them', text: AUTO_REPLY_TEXT, at: Date.now(), status: 'read' },
        }),
      );
    }
  }, []);

  const markRead = useCallback((chatId: string) => dispatch({ type: 'read', chatId }), []);

  return { chats, sendMessage, markRead };
}
