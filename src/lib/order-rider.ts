type RiderIdentity = { full_name: string | null };

export async function loadAssignedRider(
  order: { id: string; rider_id: string | null },
  fetchRider: (orderId: string) => PromiseLike<{
    data: RiderIdentity[] | null;
    error: { message: string } | null;
  }>,
) {
  if (!order.rider_id) return null;
  const { data, error } = await fetchRider(order.id);
  if (error) throw new Error(error.message);
  return data?.[0]?.full_name?.trim() || null;
}