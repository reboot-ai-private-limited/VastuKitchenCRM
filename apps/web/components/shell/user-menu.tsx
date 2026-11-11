'use client';

import { LogOut } from 'lucide-react';
import type { RoleName, UserDto } from '@vastu/contracts';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { initials } from '@/lib/format';

export const ROLE_LABEL: Record<RoleName, string> = {
  ADMIN: 'Admin',
  HR: 'HR',
  SALES: 'Sales',
  DESIGNER: 'Designer',
  TECHNICIAN: 'Technician',
  OFFICE: 'Office',
  CUSTOMER: 'Customer',
};

export function UserMenu({ user }: { user: UserDto }) {
  const { logout } = useAuth();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-1.5" aria-label={`Account menu for ${user.name}`}>
          <Avatar className="size-8">
            <AvatarFallback className="bg-primary-soft text-primary-hover text-xs font-semibold">{initials(user.name)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 truncate text-left sm:block">{user.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-0.5">
          <span className="block font-semibold">{user.name}</span>
          <span className="text-muted-foreground block text-xs font-normal">
            {ROLE_LABEL[user.role]}
            {user.designation ? ` · ${user.designation}` : ''}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => void logout()}>
          <LogOut /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
