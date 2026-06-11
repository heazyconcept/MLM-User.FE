/** Delivery fee for addresses within Lagos */
export const DELIVERY_FEE_LAGOS = 1500;

/** Delivery fee for addresses outside Lagos */
export const DELIVERY_FEE_OUTSIDE_LAGOS = 3000;

/** Determine the delivery fee based on the selected state */
export function getDeliveryFee(state: string): number {
  return state.toLowerCase() === 'lagos'
    ? DELIVERY_FEE_LAGOS
    : DELIVERY_FEE_OUTSIDE_LAGOS;
}
