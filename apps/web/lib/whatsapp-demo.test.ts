import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { AUTO_REPLY_TEXT, chatsReducer, seedChats, useDemoChats } from './whatsapp-demo';

describe('chatsReducer', () => {
  it('clears unread on read', () => {
    const next = chatsReducer(seedChats(), { type: 'read', chatId: 'c1' });
    expect(next.find((c) => c.id === 'c1')?.unread).toBe(0);
  });
});

describe('useDemoChats send', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('walks sending -> sent -> delivered -> read, then auto-replies', () => {
    const { result } = renderHook(() => useDemoChats('c2'));
    const last = () => result.current.chats.find((c) => c.id === 'c2')!.messages.at(-1)!;

    act(() => result.current.sendMessage('c2', '  hello  '));
    expect(last()).toMatchObject({ text: 'hello', status: 'sending' });
    act(() => void vi.advanceTimersByTime(400));
    expect(last().status).toBe('sent');
    act(() => void vi.advanceTimersByTime(1600));
    expect(last().status).toBe('delivered');
    act(() => void vi.advanceTimersByTime(2500));
    expect(last().status).toBe('read');
    act(() => void vi.advanceTimersByTime(2000));
    expect(last()).toMatchObject({ from: 'them', text: AUTO_REPLY_TEXT });
  });

  it('ignores blank text', () => {
    const { result } = renderHook(() => useDemoChats(null));
    const before = result.current.chats.find((c) => c.id === 'c5')!.messages.length;
    act(() => result.current.sendMessage('c5', '   '));
    expect(result.current.chats.find((c) => c.id === 'c5')!.messages.length).toBe(before);
  });
});
