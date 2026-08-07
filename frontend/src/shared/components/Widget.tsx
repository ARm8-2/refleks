import { Maximize2, type LucideIcon } from "lucide-react";
import {
  useState,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../lib/utils";
import { Modal } from "./Modal";

type WidgetProps = {
  icon?: LucideIcon;
  iconClassName?: string;
  title: string;
  titleControls?: ReactNode;
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  modalTitle?: string;
  modalContent?: ReactNode;
  modalControls?: ReactNode;
  modalWidth?: string | number;
  modalHeight?: string | number;
};

export function Widget({
  icon: Icon,
  iconClassName,
  title,
  titleControls,
  description,
  headerAction,
  children,
  className,
  contentClassName,
  modalTitle,
  modalContent,
  modalControls,
  modalWidth,
  modalHeight,
}: WidgetProps) {
  const { t } = useTranslation("common");
  const [open, setOpen] = useState(false);
  const canExpand = Boolean(modalContent);

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (!canExpand) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    setOpen(true);
  };

  const handleExpandClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <section
        className={cn(
          "flex flex-col rounded-xl bg-surface px-4 py-3",
          canExpand && "cursor-pointer",
          className,
        )}
        onClick={canExpand ? () => setOpen(true) : undefined}
        onKeyDown={canExpand ? handleKeyDown : undefined}
        role={canExpand ? "button" : undefined}
        tabIndex={canExpand ? 0 : undefined}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
                {Icon && <Icon className={cn("h-3.5 w-3.5", iconClassName)} />}
                {title}
              </h3>

              {titleControls && (
                <div
                  className="flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  {titleControls}
                </div>
              )}
            </div>
            {description && (
              <p className="mt-0.5 text-xs text-surface-muted-foreground">
                {description}
              </p>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {headerAction && (
              <div
                className="flex items-center gap-2"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
              >
                {headerAction}
              </div>
            )}

            {canExpand && (
              <button
                type="button"
                className="inline-flex h-6 w-6 items-center justify-center rounded-md text-surface-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
                title={t("actions.expand")}
                aria-label={t("actions.expand")}
                onClick={handleExpandClick}
              >
                <Maximize2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>

        <div className={cn("flex-1 min-h-0", contentClassName)}>{children}</div>
      </section>

      {canExpand && (
        <Modal
          isOpen={open}
          onClose={() => setOpen(false)}
          title={modalTitle ?? title}
          headerControls={modalControls}
          width={modalWidth}
          height={modalHeight}
        >
          <div className="h-full min-h-0 overflow-auto px-6 pb-6">
            {modalContent}
          </div>
        </Modal>
      )}
    </>
  );
}

export function WidgetEmpty({
  icon,
  label,
}: {
  icon: LucideIcon;
  label: string;
}) {
  const { t } = useTranslation("common");

  return (
    <Widget icon={icon} title={label}>
      <p className="text-lg font-semibold text-surface-muted-foreground">--</p>
      <p className="mt-0.5 text-xs text-surface-muted-foreground">
        {t("empty.noSession")}
      </p>
    </Widget>
  );
}
