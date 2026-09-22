"use client";

import { useState, useId } from "react";
import { useTranslations } from "next-intl";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { Button } from "@/components/ui/button";
import { Repeat, Trash2 } from "@/components/icons";

export type RecurrenceEditScope = "this" | "this_and_future" | "all";

interface RecurrenceScopeDialogProps {
  isOpen: boolean;
  actionType: "edit" | "delete";
  onSelect: (scope: RecurrenceEditScope) => void;
  onClose: () => void;
}

export function RecurrenceScopeDialog({
  isOpen,
  actionType,
  onSelect,
  onClose,
}: RecurrenceScopeDialogProps) {
  const t = useTranslations("calendar.recurrence_scope");
  const id = useId();
  const [selected, setSelected] = useState<RecurrenceEditScope>("this");

  const dialogRef = useFocusTrap({
    isActive: isOpen,
    onEscape: onClose,
    restoreFocus: true,
  });

  if (!isOpen) return null;

  const isDelete = actionType === "delete";

  const options: { value: RecurrenceEditScope; label: string }[] = [
    { value: "this", label: t("this_event") },
    { value: "this_and_future", label: t("this_and_future") },
    { value: "all", label: t("all_events") },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-[60] p-4 animate-in fade-in duration-150">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-desc`}
        className="bg-background border border-border rounded-lg shadow-xl w-full max-w-sm animate-in zoom-in-95 duration-200"
      >
        <div className="p-6">
          <div className="flex items-start gap-3 mb-4">
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
              isDelete ? "bg-destructive/10" : "bg-primary/10"
            }`}>
              {isDelete ? (
                <Trash2 className="w-5 h-5 text-destructive" />
              ) : (
                <Repeat className="w-5 h-5 text-primary" />
              )}
            </div>
            <div>
              <h2 id={`${id}-title`} className="text-lg font-semibold">
                {isDelete ? t("delete_title") : t("edit_title")}
              </h2>
              <p id={`${id}-desc`} className="text-sm text-muted-foreground mt-1">
                {t("description")}
              </p>
            </div>
          </div>

          <div className="space-y-2" role="radiogroup" aria-labelledby={`${id}-title`}>
            {options.map((option) => (
              <label
                key={option.value}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-md cursor-pointer transition-colors ${
                  selected === option.value
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-muted border border-transparent"
                }`}
              >
                <input
                  type="radio"
                  name={`${id}-scope`}
                  value={option.value}
                  checked={selected === option.value}
                  onChange={() => setSelected(option.value)}
                  className="accent-primary"
                />
                <span className="text-sm">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <Button variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant={isDelete ? "destructive" : "default"}
            onClick={() => onSelect(selected)}
          >
            {isDelete ? t("delete") : t("save")}
          </Button>
        </div>
      </div>
    </div>
  );
}
