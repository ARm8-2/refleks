import { Button, Modal } from "@/shared/components";
import { clearCache } from "@/shared/lib";
import { useState } from "react";
import { useTranslation } from "react-i18next";

type ClearCacheModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function ClearCacheModal({ isOpen, onClose }: ClearCacheModalProps) {
  const { t } = useTranslation(["settings", "common"]);
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
      title={t("modals.clearCacheTitle")}
      width={400}
      height="auto"
    >
      <div className="p-4 flex flex-col gap-4">
        <p className="text-surface-muted-foreground text-sm">
          {t("modals.clearCacheDescription")}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            {t("common:actions.cancel")}
          </Button>
          <Button
            variant="destructive"
            onClick={handleClear}
            disabled={loading}
          >
            {loading ? t("modals.clearing") : t("modals.clearCacheTitle")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
