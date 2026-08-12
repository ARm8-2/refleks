import { Button, Modal } from "@/shared/components";
import { clearCache, useI18n } from "@/shared/lib";
import { useState } from "react";

type ClearCacheModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ClearCacheModal({ isOpen, onClose }: ClearCacheModalProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const handleClear = async () => {
    setLoading(true);
    try {
      await clearCache();
      onClose();
    } catch (error) {
      console.error("Failed to clear cache:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t("settings.clearCache.title")}
      width="25rem"
      height="auto"
    >
      <div className="p-4 flex flex-col gap-4">
        <p className="text-surface-muted-foreground text-sm">
          {t("settings.clearCache.description")}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common.actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleClear}
            disabled={loading}
          >
            {loading
              ? t("settings.clearCache.clearing")
              : t("settings.clearCache.title")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
