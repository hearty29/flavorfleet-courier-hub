import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export const Route = createFileRoute('/_authenticated/rider')({
  component: RiderDashboard,
});

interface Order {
  id: string;
  customer_name: string;
  total_amount: number;
  address: string;
  phone: string;
  items: string;
  status: string;
  rider_name?: string;
  rider_phone?: string;
}

export function RiderDashboard() {
  const { user } = useAuth();
  const [activeDeliveries, setActiveDeliveries] = useState<Order[]>([]);
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Get rider details from logged-in user session/metadata
  const riderName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Assigned Rider';
  const riderPhone = user?.user_metadata?.phone || user?.phone || '09123456789';

  const fetchOrders = async () => {
    setLoading(true);

    // Fetch active deliveries for this rider
    const { data: activeData } = await supabase
      .from('orders')
      .select('*')
      .eq('rider_id', user?.id)
      .eq('status', 'picked_up');

    // Fetch orders ready for pickup
    const { data: availableData } = await supabase
      .from('orders')
      .select('*')
      .eq('status', 'pending');

    if (activeData) setActiveDeliveries(activeData);
    if (availableData) setAvailableOrders(availableData);
    setLoading(false);
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
    }
  }, [user]);

  // Handle Pick Up / Accept action
  const handlePickUp = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({
        status: 'picked_up',
        rider_id: user?.id,
        rider_name: riderName,
        rider_phone: riderPhone,
      })
      .eq('id', orderId);

    if (!error) {
      fetchOrders();
    } else {
      alert('Failed to update order status: ' + error.message);
    }
  };

  // Handle Mark Delivered action
  const handleMarkDelivered = async (orderId: string) => {
    const { error } = await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', orderId);

    if (!error) {
      fetchOrders();
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8F0] p-4 max-w-md mx-auto font-sans">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Rider dashboard</h1>

      {/* Profile summary card */}
      <div className="bg-white p-3 rounded-2xl shadow-sm border mb-4">
        <p className="text-xs text-gray-500">Logged in as Rider:</p>
        <p className="font-semibold text-gray-800">{riderName}</p>
        <p className="text-xs text-gray-600">📞 {riderPhone}</p>
      </div>

      {/* Active Deliveries */}
      <h2 className="text-lg font-bold text-gray-900 mb-2">My active deliveries</h2>
      {loading ? (
        <p className="text-sm text-gray-500">Loading orders...</p>
      ) : activeDeliveries.length === 0 ? (
        <p className="text-sm text-gray-500 mb-4">No active deliveries.</p>
      ) : (
        activeDeliveries.map((order) => (
          <div key={order.id} className="bg-white p-4 rounded-2xl shadow-sm border mb-4 relative">
            <div className="flex justify-between items-start">
              <div>
                <span className="font-bold text-gray-900">{order.customer_name}</span>
                <span className="text-gray-900 font-bold ml-1">· ₱{order.total_amount}</span>
              </div>
              <span className="bg-[#E53935] text-white text-xs font-semibold px-3 py-1 rounded-full">
                Picked Up
              </span>
            </div>

            <div className="mt-2 text-sm text-gray-600 space-y-1">
              <p className="flex items-center gap-1">📍 {order.address}</p>
              <p className="flex items-center gap-1 text-red-600 font-medium">📞 {order.phone}</p>
              <p className="text-xs text-gray-500 mt-2">{order.items}</p>
              <p className="text-xs font-bold text-gray-700">Collect cash: ₱{order.total_amount}</p>
            </div>

            <button
              onClick={() => handleMarkDelivered(order.id)}
              className="mt-4 w-full bg-[#E53935] text-white py-2 rounded-xl font-medium hover:bg-red-700 transition-colors"
            >
              Mark delivered
            </button>
          </div>
        ))
      )}

      {/* Available Orders for Pickup */}
      <h2 className="text-lg font-bold text-gray-900 mb-2 mt-6">Available orders</h2>
      {availableOrders.length === 0 ? (
        <p className="text-sm text-gray-500">No orders waiting for pickup.</p>
      ) : (
        availableOrders.map((order) => (
          <div key={order.id} className="bg-white p-4 rounded-2xl shadow-sm border mb-3">
            <div className="flex justify-between items-center mb-2">
              <span className="font-bold text-gray-900">{order.customer_name}</span>
              <span className="font-bold text-gray-900">₱{order.total_amount}</span>
            </div>
            <p className="text-xs text-gray-500 mb-3">📍 {order.address}</p>
            <button
              onClick={() => handlePickUp(order.id)}
              className="w-full bg-black text-white py-2 rounded-xl text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Accept & Pick Up Order
            </button>
          </div>
        ))
      )}
    </div>
  );
}
