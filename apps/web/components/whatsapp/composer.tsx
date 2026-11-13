'use client';

import { SendHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

/** Enter sends, Shift+Enter adds a line. */
export function Composer({ onSend }: { onSend: (text: string) => void }) {
  const [text, setText] = useState('');
  const submit = () => {
    if (!text.trim()) return;
    onSend(text);
    setText('');
  };
  return (
    <form
      className="bg-muted/60 flex items-end gap-2 border-t p-2"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        rows={1}
        placeholder="Type a message"
        aria-label="Message"
        className="bg-background max-h-32 min-h-10 flex-1 resize-none rounded-lg border px-3 py-2 text-sm outline-none focus-visible:ring-2"
      />
      <Button type="submit" size="icon" aria-label="Send" disabled={!text.trim()}>
        <SendHorizontal />
      </Button>
    </form>
  );
}
