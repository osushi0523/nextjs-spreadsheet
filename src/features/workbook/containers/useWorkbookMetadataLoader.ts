import { useAtomValue, useSetAtom } from "jotai";
import { useEffect, useState } from "react";
import {
  MOCK_INITIAL_OPEN_SHEET_IDS,
  MOCK_SHEET_CATEGORIES,
  MOCK_SHEET_TEMPLATES,
} from "../mock";
import {
  initWorkbookMetadataAtom,
  openSheetIdsAtom,
  sheetCategoriesAtom,
  sheetTemplatesAtom,
} from "../stores";

/**
 * アプリケーション初期化時にワークブックのメタデータ（カテゴリ、全シート雛形カタログ、初期オープンシート）を動的にロードするフック
 */
export const useWorkbookMetadataLoader = () => {
  const [isMetadataLoaded, setIsMetadataLoaded] = useState(false);
  const initMetadata = useSetAtom(initWorkbookMetadataAtom);
  const categories = useAtomValue(sheetCategoriesAtom);
  const sheetTemplates = useAtomValue(sheetTemplatesAtom);
  const openSheetIds = useAtomValue(openSheetIdsAtom);

  useEffect(() => {
    initMetadata({
      categories: MOCK_SHEET_CATEGORIES,
      templates: MOCK_SHEET_TEMPLATES,
      initialOpenSheetIds: MOCK_INITIAL_OPEN_SHEET_IDS,
    });
    setIsMetadataLoaded(true);
  }, [initMetadata]);

  return {
    isMetadataLoaded,
    categories,
    sheetTemplates,
    openSheetIds,
  };
};
