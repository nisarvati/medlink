"use client";

import { useEffect, useState, type FormEvent } from "react";
import { SearchIcon, XIcon } from "../ui/icons";
import { Button, cx } from "../ui/primitives";

export const SUGGESTIONS = ["Crocin 500mg", "Paracetamol", "Augmentin", "Cetzine", "Volini"];

/** The search box. Keeps what you typed until you submit; the URL (not this box) is the source of truth for results. */
export function SearchForm({ initial, onSearch, large, autoFocus }: { initial: string; onSearch: (q: string) => void; large?: boolean; autoFocus?: boolean }) {
  const [value, setValue] = useState(initial);
  const [problem, setProblem] = useState<string | null>(null);
  useEffect(() => setValue(initial), [initial]); // back/forward navigation

  function submit(e: FormEvent) {
    e.preventDefault();
    const q = value.trim();
    if (!q) {
      setProblem("Enter a medicine name, e.g. Crocin 500mg or Paracetamol.");
      return;
    }
    setProblem(null);
    onSearch(q);
  }

  return (
    <form onSubmit={submit} role="search" noValidate>
      <div className={cx("flex items-center gap-2 rounded-2xl border bg-surface shadow-card transition-colors focus-within:border-brand", problem ? "border-bad" : "border-line", large ? "p-2" : "p-1.5")}>
        <SearchIcon size={large ? 22 : 20} className="ml-2.5 shrink-0 text-muted" />
        <label htmlFor="medicine-search" className="sr-only">
          Medicine name
        </label>
        <input
          id="medicine-search"
          type="search"
          inputMode="search"
          autoComplete="off"
          autoFocus={autoFocus}
          maxLength={100}
          placeholder="Search a medicine, e.g. Crocin 500mg"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (problem) setProblem(null);
          }}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? "search-problem" : undefined}
          className={cx("min-w-0 flex-1 bg-transparent px-1 outline-none placeholder:text-muted/80 [&::-webkit-search-cancel-button]:hidden", large ? "h-12 text-lg" : "h-10 text-base")}
        />
        {value && (
          <button type="button" aria-label="Clear search" onClick={() => setValue("")} className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-ink">
            <XIcon size={16} />
          </button>
        )}
        <Button type="submit" variant="primary" size={large ? "lg" : "md"}>
          Search
        </Button>
      </div>
      {problem && (
        <p id="search-problem" role="alert" className="mt-2 px-1 text-sm text-bad">
          {problem}
        </p>
      )}
    </form>
  );
}
