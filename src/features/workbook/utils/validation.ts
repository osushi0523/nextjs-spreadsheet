import { z } from "zod";
import type {
  ColumnValidationRule,
  PulldownBinding,
  SheetData,
  ValidationErrorInfo,
} from "../stores/types";

/**
 * 各単一バリデーションルールを Zod スキーマへマッピング
 */
export const ruleToZodSchema = (
  rule: Exclude<ColumnValidationRule, { type: "reference" }>,
): z.ZodType<string> => {
  switch (rule.type) {
    case "required":
      return z.string().trim().min(1);

    case "number":
      return z
        .string()
        .refine(
          (val) =>
            val === "" ||
            (!Number.isNaN(Number(val)) && !Number.isNaN(parseFloat(val))),
        );

    case "string":
      return z.string();

    case "alphanumeric":
      return z
        .string()
        .refine((val) => val === "" || /^[a-zA-Z0-9]+$/.test(val));

    case "alpha":
      return z.string().refine((val) => val === "" || /^[a-zA-Z]+$/.test(val));

    case "numeric":
      return z.string().refine((val) => val === "" || /^[0-9]+$/.test(val));

    case "maxLength":
      return z.string().refine((val) => val.length <= rule.length);

    case "minLength":
      return z
        .string()
        .refine((val) => val === "" || val.length >= rule.length);
  }
};

export type ValidationContext = {
  pulldownConfig?: PulldownBinding;
  masterSheetData?: SheetData;
  cellEdits?: Record<string, string>;
};

export type ValidationResult = {
  valid: boolean;
  errorInfo?: ValidationErrorInfo;
};

/**
 * バリデーションルール配列を手前から順次評価する関数（パイプライン・早期終了）
 * 途中のルールで違反があった場合、即座に false とエラー情報（i18nキー・パラメータ）を返却
 */
export const validateCellRules = (
  rules: ColumnValidationRule[] | undefined,
  value: string,
  context?: ValidationContext,
): ValidationResult => {
  if (!rules || rules.length === 0) return { valid: true };

  for (const rule of rules) {
    if (rule.type === "reference") {
      // 参照先マスタチェック (空値の場合はスキップ、required 側で空値判定)
      if (!value) continue;
      if (!context?.pulldownConfig || !context?.masterSheetData) continue;

      const { sourceKeyColId } = context.pulldownConfig;
      const master = context.masterSheetData;
      const edits = context.cellEdits ?? {};

      const isValidKey = master.rows.some((rId) => {
        const key = `${rId}-${sourceKeyColId}`;
        const masterVal = key in edits ? edits[key] : master.values[key];
        return masterVal === value;
      });

      if (!isValidKey) {
        return {
          valid: false,
          errorInfo: { key: "reference" },
        };
      }
      continue;
    }

    // Zod スキーマによる個別検証
    const schema = ruleToZodSchema(rule);
    const result = schema.safeParse(value);
    if (!result.success) {
      const params =
        rule.type === "maxLength" || rule.type === "minLength"
          ? { length: rule.length }
          : undefined;

      return {
        valid: false,
        errorInfo: { key: rule.type, params },
      };
    }
  }

  return { valid: true };
};
