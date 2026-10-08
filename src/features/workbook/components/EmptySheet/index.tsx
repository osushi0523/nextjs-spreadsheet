import { TableIcon } from "@radix-ui/react-icons";
import { Button, Flex, Text } from "@radix-ui/themes";
import type { FC } from "react";
import { useI18n } from "@/i18n/useI18n";
import { localMessages } from "../i18n";
import styles from "./index.module.css";

export type EmptySheetProps = {
  onOpenMenu?: () => void;
};

export const EmptySheet: FC<EmptySheetProps> = ({ onOpenMenu }) => {
  const { t } = useI18n(localMessages);

  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      className={styles.container}
    >
      <div className={styles.iconWrapper}>
        <TableIcon width="36" height="36" />
      </div>
      <Text size="3" className={styles.message}>
        {t("noOpenSheets")}
      </Text>
      {onOpenMenu && (
        <Button
          variant="soft"
          size="2"
          onClick={onOpenMenu}
          className={styles.openMenuButton}
        >
          {t("openSheetMenu")}
        </Button>
      )}
    </Flex>
  );
};
