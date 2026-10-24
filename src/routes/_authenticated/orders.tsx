import { useState, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export const Route = createFileRoute('/_authenticated/orders')({
  component: CustomerOrdersPage,
});

interface Order {
  id: string;
  items: string;
  total_amount: number;
  status: 'pending' | 'picked_up' | 'delivered';
  rider_name?: string;
  rider_phone?: string;
  created_at: string;
}

export function CustomerOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCustomerOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCustomerOrders();

    // Subscribe to real-time status updates from rider
    const channel = supabase
      .channel('public:orders')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload) => {
          setOrders((prevOrders) =>
            prevOrders.map((o) => (o.id === payload.new.id ? { ...o, ...payload.new } : o))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#FFF8F0] p-4 max-w-md mx-auto font-sans">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">My Orders</h1>

      {loading ? (
        <p className="text-sm text-gray-500">Loading your orders...</p>
      ) : orders.length === 0 ? (
        <p className="text-sm text-gray-500">No active orders placed.</p>
      ) : (
        orders.map((order) => (
          <div key={order.id} className="bg-white p-4 rounded-2xl shadow-sm border mb-4">
            <div className="flex justify-between items-center border-b pb-2 mb-2">
              <span className="text-xs text-gray-500">
                Order #{order.id.substring(0, 8)}
              </span>
              <span
                className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                  order.status === 'picked_up'
                    ? 'bg-amber-100 text-amber-800'
                    : order.status === 'delivered'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {order.status === 'picked_up'
                  ? 'On the way'
                  : order.status === 'delivered'
                  ? 'Delivered'
                  : 'Preparing'}
              </span>
            </div>

            <div className="text-sm text-gray-800 mb-2">
              <p className="font-medium">{order.items}</p>
              <p className="font-bold mt-1">Total: ₱{order.total_amount}</p>
            </div>

            {/* Rider Information Section (Visible when order is picked up or delivered) */}
            {order.status !== 'pending' && order.rider_name && (
              <div className="mt-3 p-3 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-xs font-semibold text-red-800 uppercase tracking-wide">
                  🛵 Your Rider
                </p>
                <div className="flex items-center justify-between mt-1">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{order.rider_name}</p>
                    {order.rider_phone && (
                      <p className="text-xs text-gray-600">Contact: {order.rider_phone}</p>
                    )}
                  </div>
                  {order.rider_phone && (
                    <a
                      href={`tel:${order.rider_phone}`}
                      className="bg-[#E53935] text-white px-3 py-1.5 text-xs font-medium rounded-lg flex items-center gap-1 shadow-sm hover:bg-red-700"
                    >
                      📞 Call Rider
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
