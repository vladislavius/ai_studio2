export const fmtMoney = (n: number): string => {
  if (n === null || n === undefined || isNaN(n)) return '0 ₽';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + ' млн ₽';
  if (abs >= 1_000) return (n / 1_000).toFixed(0) + ' тыс ₽';
  return n.toFixed(0) + ' ₽';
};

export const fmtFull = (n: number): string =>
  new Intl.NumberFormat('ru-RU').format(Math.round(n || 0)) + ' ₽';

export const ruDate = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });
};

export const ruDateFull = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: 'long', year: 'numeric' });
};
