'use client';

import type { CustomerDto } from '@vastu/contracts';
import { Contact, FileUp, Plus, Search } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/common/empty-state';
import { ErrorState } from '@/components/common/error-state';
import { PageBody, PageHeader } from '@/components/common/page-header';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { CUSTOMER_PAGE_SIZE, useCustomers } from '@/lib/api/customers';
import { initials, relativeAge } from '@/lib/format';
import { formatPhone } from '@/lib/leads';
import { cn } from '@/lib/utils';
import { AddCustomerDialog } from './add-customer-dialog';
import { ImportCustomersDialog } from './import-customers-dialog';

/** Customers: people with an account, those with a project first. A row opens their page. */
export function CustomersView() {
  const [text, setText] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(text.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  const q = useCustomers(search, page);
  const data = q.data;

  return (
    <PageBody>
      <PageHeader
        title="Customers"
        description={
          data ? `${data.total} ${data.total === 1 ? 'customer' : 'customers'}` : undefined
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setImporting(true)}>
              <FileUp /> Import
            </Button>
            <Button onClick={() => setAdding(true)}>
              <Plus /> Add customer
            </Button>
          </>
        }
      />

      <div className="relative min-w-52 sm:max-w-xs">
        <Search
          className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          aria-hidden
        />
        <Input
          type="search"
          aria-label="Search customers"
          placeholder="Search by name, phone or city"
          className="pl-8"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>

      {q.isError && !data ? (
        <div className="bg-card shadow-card rounded-xl border">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : q.isPending ? (
        <div className="bg-card shadow-card space-y-2 rounded-xl border p-3" aria-hidden>
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <div className="bg-card shadow-card rounded-xl border">
          <EmptyState
            icon={Contact}
            title={search ? 'No customers match your search' : 'No customers yet'}
            description={
              search
                ? 'Try a different name or number.'
                : 'A customer appears when a lead is won. You can also add or import people who are already customers.'
            }
          />
        </div>
      ) : data ? (
        <div className={cn(q.isPlaceholderData && 'opacity-60 transition-opacity')}>
          <div className="bg-card shadow-card overflow-hidden rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Projects</TableHead>
                  <TableHead className="hidden md:table-cell">City</TableHead>
                  <TableHead className="hidden lg:table-cell">Owner</TableHead>
                  <TableHead className="hidden sm:table-cell">Last active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((c) => (
                  <CustomerRow key={c.id} c={c} />
                ))}
              </TableBody>
            </Table>
          </div>
          {data.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3">
              <p className="text-muted-foreground tabular text-xs">
                {(data.page - 1) * CUSTOMER_PAGE_SIZE + 1}–
                {Math.min(data.page * CUSTOMER_PAGE_SIZE, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page <= 1}
                  onClick={() => setPage(data.page - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={data.page >= data.totalPages}
                  onClick={() => setPage(data.page + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <AddCustomerDialog open={adding} onOpenChange={setAdding} />
      <ImportCustomersDialog open={importing} onOpenChange={setImporting} />
    </PageBody>
  );
}

function CustomerRow({ c }: { c: CustomerDto }) {
  const router = useRouter();
  const href = `/customers/${c.id}`;
  // The whole row opens the customer; the name stays a real link (keyboard, middle-click).
  return (
    <TableRow className="cursor-pointer" onClick={() => router.push(href)}>
      <TableCell>
        <Link
          href={href}
          onClick={(e) => e.stopPropagation()}
          className="focus-visible:ring-ring flex items-center gap-3 rounded-sm outline-none focus-visible:ring-2"
        >
          <Avatar className="size-9 shrink-0">
            <AvatarFallback>{initials(c.name)}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{c.name}</span>
            <span className="text-muted-foreground tabular block truncate text-xs">
              {formatPhone(c.phone)}
            </span>
          </span>
        </Link>
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {c.projectsCount === 0 ? (
            <span className="bg-secondary text-muted-foreground rounded-full px-2 py-0.5 font-medium">
              No project yet
            </span>
          ) : (
            <span className="bg-primary-soft text-primary rounded-full px-2 py-0.5 font-medium">
              {c.projectsCount} {c.projectsCount === 1 ? 'project' : 'projects'}
              {c.activeProjects > 0 ? ` · ${c.activeProjects} active` : ''}
            </span>
          )}
          {c.startedAgain && (
            <span className="bg-warning-soft text-warning rounded-full px-2 py-0.5 font-medium">
              New project in progress
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground hidden md:table-cell">{c.city ?? '—'}</TableCell>
      <TableCell className="hidden lg:table-cell">{c.owner?.name ?? '—'}</TableCell>
      <TableCell className="text-muted-foreground hidden text-xs sm:table-cell">
        {relativeAge(c.lastActivityAt)}
      </TableCell>
    </TableRow>
  );
}
