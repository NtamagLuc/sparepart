/**
 * Formate un nombre en devise FCFA
 * @param amount - Le montant à formater
 * @returns La chaîne formatée (ex: "1 500 000 FCFA")
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '-';
  }
  
  return new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount) + ' FCFA';
}
