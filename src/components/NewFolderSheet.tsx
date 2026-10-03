import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { COLORS, ICONS } from "@/lib/folders";
import { useFolders } from "@/hooks/use-folders";

export function NewFolderSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { folders, addFolder } = useFolders();
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("folder");
  const [color, setColor] = useState(COLORS[0]!);

  function create() {
    const name = label.trim();
    if (!name) {
      toast("Give your folder a name");
      return;
    }
    if (folders.some((f) => f.label.toLowerCase() === name.toLowerCase()))
    {
      toast("You already have a folder with that name");
      return;
    }
    addFolder({ label: name.slice(0, 30), icon, color });
    toast(`“${name}” folder created`);
    setLabel("");
    setIcon("folder");
    onOpenChange(false);
  }

  const Preview = ICONS[icon]!;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="glass-strong mx-auto max-h-[92dvh] w-full max-w-[26rem] overflow-y-auto rounded-t-3xl border-border px-4 pb-8"
      >
        <SheetHeader className="px-0">
          <SheetTitle className="text-xl font-extrabold">New folder</SheetTitle>
        </SheetHeader>

        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div
              className={`grid size-12 shrink-0 place-items-center rounded-xl border-2 border-border ${color}`}
            >
              <Preview className="size-5 text-primary-foreground" strokeWidth={2.4} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="folder-name">Name</Label>
              <Input
                id="folder-name"
                value={label}
                maxLength={30}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && create()}
                placeholder="e.g. Music, Recipes, Gadgets"
                className="h-11"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Icon</Label>
            <div className="grid grid-cols-6 gap-2">
              {Object.entries(ICONS).map(([key, Icon]) => (
                <button
                  key={key}
                  type="button"
                  aria-label={key}
                  aria-pressed={icon === key}
                  onClick={() => setIcon(key)}
                  className={`grid aspect-square place-items-center rounded-xl border-2 transition-colors ${
                    icon === key
                      ? "border-foreground bg-primary/15"
                      : "border-border text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4.5" />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Colour</Label>
            <div className="flex flex-wrap gap-2.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={c.replace("bg-folder-", "")}
                  aria-pressed={color === c}
                  onClick={() => setColor(c)}
                  className={`size-9 rounded-full border-2 ${c} ${
                    color === c ? "border-foreground ring-2 ring-foreground/30" : "border-border"
                  }`}
                />
              ))}
            </div>
          </div>

          <Button onClick={create} className="h-12 w-full rounded-2xl text-base font-semibold">
            Create folder
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
