export const pasteConfirmModalMessages = {
  ja: {
    title: "異なる列へのペースト確認",
    description:
      "コピー元の列と異なる列（または異なるシート）へペーストしようとしています。このままペーストを実行しますか？",
    mismatchListLabel: "一致しない列の対応",
    sheetArrow: "シート: {sourceSheet} → {targetSheet}",
    columnArrow: "{source} → {target}",
    cancel: "キャンセル",
    confirm: "ペーストする",
  },
  en: {
    title: "Confirm Paste to Different Column",
    description:
      "You are about to paste values into a different column (or different sheet) than the copied source. Do you want to proceed?",
    mismatchListLabel: "Mismatched columns",
    sheetArrow: "Sheet: {sourceSheet} → {targetSheet}",
    columnArrow: "{source} → {target}",
    cancel: "Cancel",
    confirm: "Paste Anyway",
  },
} as const;
