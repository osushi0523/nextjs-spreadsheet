import clsx from "clsx";
import type { FC } from "react";
import { useI18n } from "@/i18n/useI18n";
import { localMessages } from "./i18n";
import styles from "./StatusBar.module.css";

export type StatusBarPresenterProps = {
  addedCount: number;
  editedCount: number;
  deletedCount: number;
  currentRow: number | null;
  totalRows: number;
  visibleRows?: number;
};

export const StatusBarPresenter: FC<StatusBarPresenterProps> = ({
  addedCount,
  editedCount,
  deletedCount,
  currentRow,
  totalRows,
  visibleRows,
}) => {
  const { t } = useI18n(localMessages);

  const current = currentRow?.toLocaleString() ?? "-";
  const total = totalRows.toLocaleString();
  const isFiltered = visibleRows !== undefined && visibleRows !== totalRows;

  const rowCountText = isFiltered
    ? t("filteredRowCount", {
        current,
        visible: visibleRows.toLocaleString(),
        total,
      })
    : t("rowCount", { current, total });

  return (
    <footer className={styles.statusBar}>
      <div className={styles.statusGroup}>
        <div
          className={clsx(
            styles.statusItem,
            addedCount > 0 && styles.statusItemActive,
          )}
        >
          <span
            className={clsx(styles.marker, styles.added)}
            aria-hidden="true"
          />
          <span>
            {t("statusCount", {
              label: t("statusAdded"),
              count: addedCount.toLocaleString(),
            })}
          </span>
        </div>
        <div
          className={clsx(
            styles.statusItem,
            editedCount > 0 && styles.statusItemActive,
          )}
        >
          <span
            className={clsx(styles.marker, styles.edited)}
            aria-hidden="true"
          />
          <span>
            {t("statusCount", {
              label: t("statusEdited"),
              count: editedCount.toLocaleString(),
            })}
          </span>
        </div>
        <div
          className={clsx(
            styles.statusItem,
            deletedCount > 0 && styles.statusItemActive,
          )}
        >
          <span
            className={clsx(styles.marker, styles.deleted)}
            aria-hidden="true"
          />
          <span>
            {t("statusCount", {
              label: t("statusDeleted"),
              count: deletedCount.toLocaleString(),
            })}
          </span>
        </div>
      </div>
      <div className={styles.separator} aria-hidden="true" />
      <div className={styles.rowCount}>{rowCountText}</div>
    </footer>
  );
};
