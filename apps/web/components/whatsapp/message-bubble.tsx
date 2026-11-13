import { Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DemoMessage, MessageStatus } from '@/lib/whatsapp-demo';

/** WhatsApp's tick marks: clock (sending), one tick (sent), two grey (delivered), two blue (read). */
export function Ticks({ status }: { status: MessageStatus }) {
  const cls = 'size-3.5';
  if (status === 'read') return <CheckCheck className={cn(cls, 'text-sky-500')} aria-label="Read" />;
  if (status === 'delivered') return <CheckCheck className={cn(cls, 'text-muted-foreground')} aria-label="Delivered" />;
  if (status === 'sent') return <Check className={cn(cls, 'text-muted-foreground')} aria-label="Sent" />;
  return <Clock className={cn(cls, 'text-muted-foreground')} aria-label="Sending" />;
}

export const timeOf = (at: number) => new Date(at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export function MessageBubble({ message }: { message: DemoMessage }) {
  const mine = message.from === 'us';
  return (
    <div className={cn('flex', mine ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[80%] rounded-lg px-2.5 py-1.5 text-sm shadow-sm',
          mine ? 'rounded-tr-none bg-[#d9fdd3] text-neutral-900' : 'rounded-tl-none bg-white text-neutral-900',
        )}
      >
        <span className="break-words whitespace-pre-wrap">{message.text}</span>
        <span className="text-muted-foreground float-right mt-2 ml-3 inline-flex items-center gap-1 text-[11px] leading-none">
          {timeOf(message.at)}
          {mine && <Ticks status={message.status} />}
        </span>
      </div>
    </div>
  );
}
