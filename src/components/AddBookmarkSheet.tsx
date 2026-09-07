import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Link2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { fetchLinkMetadata } from "@/lib/link-metadata.functions";
import {
  CATEGORIES,
  REMINDER_CATEGORIES,
  faviconFor,
  getDomain,
  guessCategory,
  normalizeUrl,
  type Bookmark,
  type Category,
} from "@/lib/bookmarks";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: Bookmark | undefined;
  prefill?: { url: string; title?: string | undefined } | undefined;
  /* pre-selected category when adding from inside a collection folder */
  defaultCategory?: Category | undefined;

  onSave: (b: Bookmark) => void;
};

const empty = {
  url: "",
  title: "",
  description: "",
  image: "",
  favicon: "",
  category: "website" as Category,
  tags: "",
  notes: "",
  company: "",
  role: "",
  deadline: "",
};

export function AddBookmarkSheet({
  open,
  onOpenChange,
  initial,
  prefill,
  defaultCategory,
  onSave,
}: Props) {
  const getMeta = useServerFn(fetchLinkMetadata);
  const [loading, setLoading] = useState(false);
  /* once the user picks a category by hand, autofill stops overriding it */
  const categoryTouched = useRef(!!initial);
  const [form, setForm] = useState(() =>
    initial
      ? {
          url: initial.url,
          title: initial.title,
          description: initial.description ?? "",
          image: initial.image ?? "",
          favicon: initial.favicon ?? "",
          category: initial.category,
          tags: initial.tags.join(", "),
          notes: initial.notes ?? "",
          company: initial.company ?? "",
          role: initial.role ?? "",
          deadline: initial.deadline ?? "",
        }
      : prefill
        ? { ...empty, url: prefill.url, title: prefill.title ?? "" }
        : { ...empty, category: defaultCategory ?? "website" },
  );

  // Shared-link flow: a link came in via the OS share sheet with no
  // metadata attached yet, so fetch title/image the same way onBlur does.
  useEffect(() => {
    if (prefill?.url && !initial) void autofill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  async function autofill() {
    const url = normalizeUrl(form.url);
    if (!url) return;
    setLoading(true);
    try {
      const meta = await getMeta({ data: { url } });
      setForm((f) => ({
        ...f,
        url,
        title: meta.title || f.title,
        description: meta.description || f.description,
        image: meta.image || f.image,
        favicon: meta.favicon || f.favicon,
        category: categoryTouched.current ? f.category : guessCategory(url),
      }));
      if (!meta.ok) toast("Couldn't read that page — add the details yourself.");
    } catch {
      toast("Couldn't read that page — add the details yourself.");
    } finally {
      setLoading(false);
    }
  }

  function submit() {
    const url = normalizeUrl(form.url);
    if (!url) {
      toast("Paste a link first");
      return;
    }
    const domain = getDomain(url);
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      createdAt: initial?.createdAt ?? new Date().toISOString(),
      applied: initial?.applied ?? false,
      url,
      domain,
      title: form.title.trim() || domain,
      description: form.description.trim() || undefined,
      image: form.image || undefined,
      favicon: form.favicon || faviconFor(domain),
      category: form.category,
      tags: form.tags
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean),
      notes: form.notes.trim() || undefined,
      company: form.company.trim() || undefined,
      role: form.role.trim() || undefined,
      deadline:
        REMINDER_CATEGORIES.includes(form.category) && form.deadline ? form.deadline : undefined,
    });
    if (!initial) setForm(empty);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong mx-auto max-h-[92dvh] w-full max-w-[26rem] overflow-y-auto rounded-t-3xl border-border px-4 pb-8"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="font-display text-xl">
            {initial ? "Edit bookmark" : "Save a link"}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="url">Link</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Link2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="url"
                  inputMode="url"
                  autoComplete="off"
                  placeholder="paste any link"
                  value={form.url}
                  onChange={(e) => set("url", e.target.value)}
                  onBlur={() => {
                    if (form.url && !form.title) void autofill();
                  }}
                  className="h-12 pl-9"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                onClick={() => void autofill()}
                disabled={loading}
                className="h-12 px-3"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <div className="relative">
              <Input
                id="title"
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="What is this?"
                className="h-12 pr-10"
              />
              {form.title && (
                <button
                  type="button"
                  aria-label="Clear title"
                  onClick={() => set("title", "")}
                  className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    categoryTouched.current = true;
                    set("category", c.value);
                  }}
                  className={`min-h-11 rounded-xl border px-1 text-xs font-medium transition-colors ${
                    form.category === c.value
                      ? "border-primary/60 bg-primary/15 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {(form.category === "job" || form.category === "internship") && (
            <div className="glass space-y-3 rounded-2xl p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label htmlFor="company">Company</Label>
                  <Input
                    id="company"
                    value={form.company}
                    onChange={(e) => set("company", e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <Input
                    id="role"
                    value={form.role}
                    onChange={(e) => set("role", e.target.value)}
                    className="h-11"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="deadline">Apply before</Label>
                <Input
                  id="deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => set("deadline", e.target.value)}
                  className="block h-11 w-full min-w-0 appearance-none"
                />
              </div>
            </div>
          )}

          {form.category === "event" && (
            <div className="glass space-y-3 rounded-2xl p-3">
              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  placeholder="Venue or online"
                  value={form.company}
                  onChange={(e) => set("company", e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="eventDate">Event date</Label>
                <Input
                  id="eventDate"
                  type="date"
                  value={form.deadline}
                  onChange={(e) => set("deadline", e.target.value)}
                  className="block h-11 w-full min-w-0 appearance-none"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <Input
              id="tags"
              value={form.tags}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="design, react, later"
              className="h-12"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Why are you saving this?"
              rows={3}
            />
          </div>

          <Button
            onClick={submit}
            className="neon-glow h-13 w-full rounded-2xl text-base font-semibold"
          >
            {initial ? "Save changes" : "Save bookmark"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
