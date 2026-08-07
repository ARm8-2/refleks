import { Button, Checkbox, Label, Modal } from "@/shared/components";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type ResetSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onReset: (options: ResetOptions) => Promise<void>;
};

export type ResetOptions = {
  config: boolean;
  favorites: boolean;
  scenarioNotes: boolean;
  sessionNotes: boolean;
};

export function ResetSettingsModal({
  isOpen,
  onClose,
  onReset,
}: ResetSettingsModalProps) {
  const { t } = useTranslation(["settings", "common"]);
  const [options, setOptions] = useState<ResetOptions>({
    config: true,
    favorites: false,
    scenarioNotes: false,
    sessionNotes: false,
  });
  const [loading, setLoading] = useState(false);

  const toggleOption = (key: keyof ResetOptions) => {
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await onReset(options);
      onClose();
    } catch (error) {
      console.error("Failed to reset:", error);
    } finally {
      setLoading(false);
    }
  };

  const anySelected = Object.values(options).some(Boolean);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("modals.resetTitle")}
      width={420}
      height="auto"
    >
      <div className="flex flex-col gap-4">
        <p className="text-surface-muted-foreground text-sm">
          {t("modals.resetDescription")}
        </p>
        <div className="flex flex-col gap-3">
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={options.config}
              onCheckedChange={() => toggleOption("config")}
            />
            <span className="text-sm">{t("modals.config")}</span>
          </Label>
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={options.favorites}
              onCheckedChange={() => toggleOption("favorites")}
            />
            <span className="text-sm">{t("modals.favorites")}</span>
          </Label>
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={options.scenarioNotes}
              onCheckedChange={() => toggleOption("scenarioNotes")}
            />
            <span className="text-sm">{t("modals.scenarioNotes")}</span>
          </Label>
          <Label className="flex items-center gap-2 cursor-pointer">
            <Checkbox
              checked={options.sessionNotes}
              onCheckedChange={() => toggleOption("sessionNotes")}
            />
            <span className="text-sm">{t("modals.sessionNotes")}</span>
          </Label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleReset}
            disabled={loading || !anySelected}
          >
            {loading ? t("modals.resetting") : t("modals.resetSelected")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
