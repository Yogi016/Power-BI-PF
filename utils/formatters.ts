export function formatBudgetJuta(value?: number): string {
  if (!value) return '-';

  const juta = value / 1_000_000;
  const formatted = new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: juta % 1 === 0 ? 0 : 2,
  }).format(juta);

  return `Rp ${formatted} Juta`;
}
