export type ChatKind = 'customer_admin' | 'rider_admin' | 'order_rider';

export function validateChatMessage(body: string) {
  const value = body.trim();
  if (!value) throw new Error('Enter a message.');
  if (value.length > 2000) throw new Error('Messages can contain up to 2,000 characters.');
  return value;
}

export function canParticipateInChat(kind: ChatKind, userId: string, ownerId: string, customerId: string | null, riderId: string | null, isAdmin: boolean) {
  return isAdmin || (kind === 'order_rider' ? userId === customerId || userId === riderId : userId === ownerId);
}