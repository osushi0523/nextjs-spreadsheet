import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { AlertDialog, Box, Button, Flex, Text } from "@radix-ui/themes";
import type { FC } from "react";
import { useI18n } from "@/i18n/useI18n";
import type { PasteColumnMismatch } from "../stores/types";
import { pasteConfirmModalMessages } from "./i18n";

export type PasteConfirmModalPresenterProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mismatches: PasteColumnMismatch[];
  isCrossSheet: boolean;
  sourceSheetName: string;
  targetSheetName: string;
  onConfirm: () => void;
  onCancel: () => void;
  onAfterClose?: () => void;
};

export const PasteConfirmModalPresenter: FC<
  PasteConfirmModalPresenterProps
> = ({
  open,
  onOpenChange,
  mismatches,
  isCrossSheet,
  sourceSheetName,
  targetSheetName,
  onConfirm,
  onCancel,
  onAfterClose,
}) => {
  const { t } = useI18n(pasteConfirmModalMessages);

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Content
        style={{ maxWidth: 460, padding: 20 }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onAfterClose?.();
        }}
      >
        <AlertDialog.Title size="4" mb="2">
          <Flex align="center" gap="2">
            <ExclamationTriangleIcon
              width={18}
              height={18}
              color="var(--amber-9)"
            />
            <span>{t("title")}</span>
          </Flex>
        </AlertDialog.Title>
        <AlertDialog.Description size="2" mb="3" color="gray">
          {t("description")}
        </AlertDialog.Description>

        {mismatches.length > 0 && (
          <Box
            mb="4"
            p="3"
            style={{
              backgroundColor: "var(--gray-2)",
              borderRadius: "var(--radius-2)",
              border: "1px solid var(--gray-a5)",
              maxHeight: 160,
              overflowY: "auto",
            }}
          >
            <Text as="div" size="1" weight="bold" color="gray" mb="2">
              {t("mismatchListLabel")}
            </Text>
            {isCrossSheet && (
              <Text as="div" size="2" weight="medium" mb="1">
                {t("sheetArrow", {
                  sourceSheet: sourceSheetName,
                  targetSheet: targetSheetName,
                })}
              </Text>
            )}
            <Flex direction="column" gap="1">
              {mismatches.map((m) => (
                <Text
                  key={`${m.sourceColId}-${m.targetColId}`}
                  size="2"
                  color="gray"
                >
                  {t("columnArrow", {
                    source: m.sourceColName,
                    target: m.targetColName,
                  })}
                </Text>
              ))}
            </Flex>
          </Box>
        )}

        <Flex gap="3" justify="end">
          <AlertDialog.Cancel>
            <Button variant="soft" color="gray" onClick={onCancel}>
              {t("cancel")}
            </Button>
          </AlertDialog.Cancel>
          <AlertDialog.Action>
            <Button color="amber" onClick={onConfirm}>
              {t("confirm")}
            </Button>
          </AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  );
};
