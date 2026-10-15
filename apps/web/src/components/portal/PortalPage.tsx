"use client";

import { useMemo, useState, type FormEvent } from "react";
import { formatAge, formatPrice, pluralise } from "../../lib/format";
import {
  addMedicine,
  getSession,
  listCatalogue,
  listStock,
  PortalError,
  removeMedicine,
  signIn,
  signOut,
  updateStock,
  type PortalSession,
  type PortalStockItem,
} from "../../lib/portal";
import { useAsync } from "../../lib/use-async";
import { useDebounced } from "../../lib/use-debounced";
import { SearchIcon, StoreIcon } from "../ui/icons";
import { Alert, Button, Card, EmptyState, Input, Select, Skeleton } from "../ui/primitives";

const message = (err: unknown) => (err instanceof PortalError ? err.message : "Something went wrong.");

/** Whole number from `text`, or null. */
const wholeNumber = (text: string): number | null => (text.trim() !== "" && Number.isInteger(Number(text)) && Number(text) >= 0 ? Number(text) : null);
/** Money with at most two decimals, or null. */
const money = (text: string): number | null => {
  const n = Number(text);
  return text.trim() !== "" && n > 0 && Math.abs(n * 100 - Math.round(n * 100)) < 1e-6 ? n : null;
};

export function PortalPage() {
  const session = useAsync((signal) => getSession({ signal }), []);
  const signedOut = session.status === "error" && session.error instanceof PortalError && session.error.kind === "unauthenticated";

  if (session.status === "idle" || (session.status === "loading" && !session.data)) {
    return <Skeleton className="mx-auto h-64 max-w-md" />;
  }
  if (signedOut) return <SignIn onSignedIn={session.reload} />;
  if (session.status === "error" && !session.data) {
    return (
      <Alert tone="bad" title="We couldn't open the portal" action={<Button size="sm" onClick={session.reload}>Try again</Button>}>
        {message(session.error)}
      </Alert>
    );
  }
  return <StockManager session={session.data!} onSignedOut={session.reload} />;
}

function SignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
      onSignedIn();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto max-w-md p-6">
      <h1 className="text-2xl font-bold tracking-tight">Pharmacy sign in</h1>
      <p className="mt-1 text-sm text-muted">For pharmacy staff. Changes you make here reach shoppers within a few seconds.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor="portal-email" className="mb-1 block text-sm font-medium">Email</label>
          <Input id="portal-email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label htmlFor="portal-password" className="mb-1 block text-sm font-medium">Password</label>
          <Input id="portal-password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <Alert tone="bad">{error}</Alert>}
        <Button type="submit" variant="primary" size="lg" loading={busy} className="w-full">Sign in</Button>
      </form>
    </Card>
  );
}

function StockManager({ session, onSignedOut }: { session: PortalSession; onSignedOut: () => void }) {
  const [text, setText] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const q = useDebounced(text.trim().toLowerCase(), 200);

  const stock = useAsync((signal) => listStock({ signal }), []);
  const catalogue = useAsync((signal) => listCatalogue({ signal }), [], adding);

  const items = useMemo(
    () => (stock.data ?? []).filter((i) => !q || `${i.brandName} ${i.genericName} ${i.dosage}`.toLowerCase().includes(q)),
    [stock.data, q],
  );

  // A rejected request because the session ended (or the account was removed) sends the person back to sign in.
  const failed = (err: unknown) => (err instanceof PortalError && err.kind === "unauthenticated" ? onSignedOut() : setProblem(message(err)));
  const saved = (text: string) => {
    setNotice(text);
    setProblem(null);
    setEditing(null);
    setRemoving(null);
    setAdding(false);
    stock.reload();
  };

  async function leave() {
    await signOut().catch(() => undefined);
    onSignedOut();
  }

  async function remove(item: PortalStockItem) {
    try {
      await removeMedicine(item.medicineCode);
      saved(`${item.brandName} ${item.dosage} is no longer listed.`);
    } catch (err) {
      failed(err);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium text-muted"><StoreIcon size={16} /> Pharmacy portal</p>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{session.pharmacy.name}</h1>
          <p className="text-sm text-muted">Signed in as {session.email}</p>
        </div>
        <Button variant="secondary" onClick={leave}>Sign out</Button>
      </Card>

      <section aria-label="Stock" className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-0 flex-1 basis-64">
            <SearchIcon size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <label htmlFor="portal-search" className="sr-only">Search your stock</label>
            <Input id="portal-search" type="search" placeholder="Search your stock" value={text} onChange={(e) => setText(e.target.value)} className="pl-10" />
          </div>
          <Button variant="primary" onClick={() => setAdding(!adding)} aria-expanded={adding}>Add a medicine</Button>
        </div>

        {adding && <AddMedicine options={catalogue.data ?? null} loadFailed={catalogue.status === "error"} onAdded={saved} onFailed={failed} onCancel={() => setAdding(false)} />}
        {notice && <Alert tone="ok">{notice} Shoppers will see it within a few seconds.</Alert>}
        {problem && <Alert tone="bad" title="That didn't go through">{problem}</Alert>}
        {stock.status === "error" && (
          <Alert tone="bad" title="We couldn't load your stock" action={<Button size="sm" onClick={stock.reload}>Try again</Button>}>
            {message(stock.error)}
          </Alert>
        )}

        {!stock.data && stock.status !== "error" && (
          <div className="space-y-2" aria-label="Loading stock">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-16" />)}
          </div>
        )}
        {stock.data && items.length === 0 && (
          <EmptyState icon={<SearchIcon />} title={q ? "Nothing matches" : "You have no medicines listed"}>
            {q ? "Try a different name." : "Use “Add a medicine” to list one."}
          </EmptyState>
        )}
        {items.length > 0 && (
          <>
            <p className="text-sm text-muted" aria-live="polite">Showing {pluralise(items.length, "medicine")}</p>
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              {items.map((i) => (
                <li key={i.medicineCode} className="p-4 sm:px-5">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="min-w-0 flex-1 basis-56">
                      <p className="font-semibold leading-snug">{i.brandName} {i.dosage}</p>
                      <p className="text-sm text-muted">{i.genericName} · {i.form}</p>
                    </div>
                    <p className="w-20 text-right font-bold tabular-nums">{formatPrice(i.price)}</p>
                    <p className="w-28 text-right text-sm"><span className="font-semibold tabular-nums">{i.quantity}</span> in stock<br /><span className="text-muted">{formatAge(i.updatedAt)}</span></p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" aria-expanded={editing === i.medicineCode} aria-label={`Edit ${i.brandName} ${i.dosage}`} onClick={() => { setEditing(editing === i.medicineCode ? null : i.medicineCode); setRemoving(null); }}>Edit</Button>
                      <Button size="sm" variant="danger" aria-label={`Remove ${i.brandName} ${i.dosage}`} onClick={() => { setRemoving(removing === i.medicineCode ? null : i.medicineCode); setEditing(null); }}>Remove</Button>
                    </div>
                  </div>
                  {editing === i.medicineCode && <StockEditor item={i} onSaved={saved} onFailed={failed} onCancel={() => setEditing(null)} />}
                  {removing === i.medicineCode && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-canvas p-3.5">
                      <p className="flex-1 text-sm">Stop listing {i.brandName} {i.dosage}? Shoppers will no longer see it at your pharmacy.</p>
                      <Button variant="danger" onClick={() => remove(i)}>Yes, remove</Button>
                      <Button variant="ghost" onClick={() => setRemoving(null)}>Keep it</Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function StockEditor({ item, onSaved, onFailed, onCancel }: { item: PortalStockItem; onSaved: (notice: string) => void; onFailed: (err: unknown) => void; onCancel: () => void }) {
  const [quantity, setQuantity] = useState(String(item.quantity));
  const [price, setPrice] = useState(item.price.toFixed(2));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = `edit-${item.medicineCode}`;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = wholeNumber(quantity);
    const p = money(price);
    if (q === null) return setError("Quantity must be a whole number, 0 or more.");
    if (p === null) return setError("Price must be more than 0, with at most two decimals.");
    const patch: { quantity?: number; price?: number } = {};
    if (q !== item.quantity) patch.quantity = q;
    if (p !== item.price) patch.price = p;
    if (patch.quantity === undefined && patch.price === undefined) return onCancel();
    setSaving(true);
    setError(null);
    try {
      await updateStock(item.medicineCode, patch);
      onSaved(`${item.brandName} ${item.dosage} updated.`);
    } catch (err) {
      setSaving(false);
      if (err instanceof PortalError && err.kind !== "unauthenticated") setError(err.message);
      else onFailed(err);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-canvas p-3.5">
      <div>
        <label htmlFor={`${id}-qty`} className="mb-1 block text-xs font-semibold text-muted">Quantity on the shelf</label>
        <Input id={`${id}-qty`} type="number" inputMode="numeric" min={0} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-36" />
      </div>
      <div>
        <label htmlFor={`${id}-price`} className="mb-1 block text-xs font-semibold text-muted">Price (₹)</label>
        <Input id={`${id}-price`} type="number" inputMode="decimal" min={0.01} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" />
      </div>
      <Button type="submit" variant="primary" loading={saving}>Save</Button>
      <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
      {error && <p role="alert" className="basis-full text-sm font-medium text-bad">{error}</p>}
    </form>
  );
}

function AddMedicine({
  options,
  loadFailed,
  onAdded,
  onFailed,
  onCancel,
}: {
  options: { medicineCode: string; brandName: string; dosage: string; form: string }[] | null;
  loadFailed: boolean;
  onAdded: (notice: string) => void;
  onFailed: (err: unknown) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = wholeNumber(quantity);
    const p = money(price);
    if (!code) return setError("Choose a medicine.");
    if (q === null) return setError("Quantity must be a whole number, 0 or more.");
    if (p === null) return setError("Price must be more than 0, with at most two decimals.");
    setSaving(true);
    setError(null);
    try {
      await addMedicine({ medicineCode: code, quantity: q, price: p });
      const m = options?.find((o) => o.medicineCode === code);
      onAdded(`${m ? `${m.brandName} ${m.dosage}` : code} is now listed.`);
    } catch (err) {
      setSaving(false);
      if (err instanceof PortalError && err.kind !== "unauthenticated") setError(err.message);
      else onFailed(err);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4 shadow-card">
      <div className="min-w-0 flex-1 basis-56">
        <label htmlFor="add-medicine" className="mb-1 block text-xs font-semibold text-muted">Medicine</label>
        <Select id="add-medicine" value={code} onChange={(e) => setCode(e.target.value)} className="w-full">
          <option value="">{options ? (options.length ? "Choose a medicine" : "You already list every medicine") : loadFailed ? "Couldn't load the list" : "Loading…"}</option>
          {options?.map((o) => <option key={o.medicineCode} value={o.medicineCode}>{o.brandName} {o.dosage} · {o.form}</option>)}
        </Select>
      </div>
      <div>
        <label htmlFor="add-qty" className="mb-1 block text-xs font-semibold text-muted">Quantity</label>
        <Input id="add-qty" type="number" inputMode="numeric" min={0} step={1} value={quantity} onChange={(e) => setQuantity(e.target.value)} className="w-28" />
      </div>
      <div>
        <label htmlFor="add-price" className="mb-1 block text-xs font-semibold text-muted">Price (₹)</label>
        <Input id="add-price" type="number" inputMode="decimal" min={0.01} step={0.01} value={price} onChange={(e) => setPrice(e.target.value)} className="w-32" />
      </div>
      <Button type="submit" variant="primary" loading={saving}>Add</Button>
      <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>Cancel</Button>
      {error && <p role="alert" className="basis-full text-sm font-medium text-bad">{error}</p>}
    </form>
  );
}
