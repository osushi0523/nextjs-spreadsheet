import {
  DownloadIcon,
  FileTextIcon,
  HamburgerMenuIcon,
} from "@radix-ui/react-icons";
import { Button, Flex, Select, TextField } from "@radix-ui/themes";
import { type FC, useCallback } from "react";
import { useCurrentLocale } from "@/i18n/context";
import { useI18n } from "@/i18n/useI18n";
import { isLocale } from "@/i18n/utils";
import { useProductSheetSave } from "../containers/useProductSheetSave";
import { localMessages } from "./i18n";
import styles from "./Toolbar.module.css";

import { useAtomValue } from "jotai";
import { activeSheetIdAtom } from "../stores";

type ToolbarProps = {
  sheetName?: string;
  onExport: () => void | Promise<void>;
  onPreviewPdf: () => void | Promise<void>;
  onOpenMenu?: () => void;
  isExportingExcel?: boolean;
  isExportingPdf?: boolean;
};

export const Toolbar: FC<ToolbarProps> = ({
  sheetName,
  onExport,
  onPreviewPdf,
  onOpenMenu,
  isExportingExcel,
  isExportingPdf,
}) => {
  const { t } = useI18n(localMessages);
  const activeSheetId = useAtomValue(activeSheetIdAtom);
  const { handleSaveClick, isSaving } = useProductSheetSave();
  const { locale, setLocale, isPending } = useCurrentLocale();

  const handleChangeLocale = useCallback(
    (value: string) => {
      if (!isLocale(value)) {
        return;
      }

      setLocale(value);
    },
    [setLocale],
  );

  const displayName = sheetName || t("defaultSheetName");

  return (
    <Flex align="center" gap="2" px="4" py="2" className={styles.toolbar}>
      {onOpenMenu && (
        <Button
          type="button"
          onClick={onOpenMenu}
          variant="soft"
          color="gray"
          aria-label={t("sheetMenu")}
        >
          <HamburgerMenuIcon />
          {t("sheetMenu")}
        </Button>
      )}
      <Button
        type="button"
        onClick={onExport}
        disabled={isExportingExcel}
        loading={isExportingExcel}
        color="green"
        variant="solid"
      >
        <DownloadIcon />
        {isExportingExcel
          ? t("exportingExcel", { sheetName: displayName })
          : t("exportToExcel", { sheetName: displayName })}
      </Button>
      <Button
        type="button"
        onClick={onPreviewPdf}
        disabled={isExportingPdf}
        loading={isExportingPdf}
        color="red"
        variant="solid"
      >
        <FileTextIcon />
        {isExportingPdf
          ? t("generatingPdf", { sheetName: displayName })
          : t("printPreview", { sheetName: displayName })}
      </Button>
      {activeSheetId === "product-master" && (
        <Button
          type="button"
          onClick={handleSaveClick}
          disabled={isSaving}
          loading={isSaving}
          color="blue"
          variant="solid"
        >
          保存
        </Button>
      )}
      <TextField.Root placeholder={t("search")}></TextField.Root>
      <Select.Root
        value={locale}
        disabled={isPending}
        onValueChange={handleChangeLocale}
      >
        <Select.Trigger style={{ marginLeft: "auto", cursor: "pointer" }} />
        <Select.Content>
          <Select.Item value="ja">日本語</Select.Item>
          <Select.Item value="en">English</Select.Item>
        </Select.Content>
      </Select.Root>
    </Flex>
  );
};
