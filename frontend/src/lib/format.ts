export function formatYen(value: number): string {
  return new Intl.NumberFormat("ja-JP").format(value);
}
