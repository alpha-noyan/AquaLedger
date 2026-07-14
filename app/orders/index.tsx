import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [selectedTab, setSelectedTab] = useState('all');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const tabs = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'ready', label: 'Ready' },
    { id: 'delivered', label: 'Delivered' },
    { id: 'cancelled', label: 'Cancelled' },
  ];

  useEffect(() => {
    loadOrders();
  }, [selectedTab]);

  const loadOrders = async (reset = true) => {
    if (loading) return;
    setLoading(true);

    const db = getDatabase();
    try {
      const offset = reset ? 0 : page * 10;
      let query = `
        SELECT o.*, e.name as employee_name,
               (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
        FROM orders o
        LEFT JOIN employees e ON o.delivery_employee_id = e.id
      `;
      
      const params = [];
      if (selectedTab !== 'all') {
        query += ' WHERE o.status = ?';
        params.push(selectedTab);
      }
      
      query += ' ORDER BY o.order_date DESC LIMIT 10 OFFSET ?';
      params.push(offset);
      
      const results = await db.getAllAsync(query, params);
      
      if (reset) {
        setOrders(results);
        setPage(1);
        setHasMore(results.length === 10);
      } else {
        if (results.length > 0) {
          setOrders(prev => [...prev, ...results]);
          setPage(prev => prev + 1);
          setHasMore(results.length === 10);
        } else {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      Alert.alert('Error', 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadOrders(false);
    }
  };

  const handleCancelOrder = async (orderId) => {
    Alert.alert(
      'Cancel Order',
      'Are you sure you want to cancel this order?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: async () => {
            const db = getDatabase();
            try {
              await db.runAsync(
                'UPDATE orders SET status = ? WHERE id = ?',
                ['cancelled', orderId]
              );
              await loadOrders(true);
              Alert.alert('Success', 'Order cancelled successfully');
            } catch (error) {
              console.error('Error cancelling order:', error);
              Alert.alert('Error', 'Failed to cancel order');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    const colors_map = {
      pending: colors.warning,
      ready: colors.info,
      delivered: colors.success,
      cancelled: colors.danger
    };
    return colors_map[status] || colors.textLight;
  };

  const getStatusIcon = (status) => {
    const icons = {
      pending: '⏳',
      ready: '✅',
      delivered: '📦',
      cancelled: '❌'
    };
    return icons[status] || '📋';
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.orderCard}
      onPress={() => router.push(`/orders/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderNumber}>{item.order_number}</Text>
          <Text style={styles.customerName}>{item.customer_name}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>
            {getStatusIcon(item.status)} {item.status?.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>Items: {item.item_count}</Text>
        <Text style={styles.detailText}>Total: PKR {item.total_amount?.toLocaleString()}</Text>
        {item.delivery_employee_id && (
          <Text style={styles.detailText}>Delivery: {item.employee_name}</Text>
        )}
        {item.delivery_commission > 0 && (
          <Text style={styles.detailText}>Commission: PKR {item.delivery_commission?.toLocaleString()}</Text>
        )}
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>
          {new Date(item.order_date).toLocaleDateString()}
        </Text>
        <View style={styles.cardActions}>
          {item.status === 'pending' && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push(`/orders/${item.id}/process`)}
            >
              <Text style={styles.actionButtonText}>Process</Text>
            </TouchableOpacity>
          )}
          {item.status !== 'cancelled' && item.status !== 'delivered' && (
            <TouchableOpacity 
              style={[styles.actionButton, styles.cancelButton]}
              onPress={() => handleCancelOrder(item.id)}
            >
              <Text style={[styles.actionButtonText, styles.cancelText]}>Cancel</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <TouchableOpacity 
          style={styles.newButton}
          onPress={() => router.push('/orders/new')}
        >
          <Text style={styles.newButtonText}>+ New Order</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabContainer}>
        <FlatList
          horizontal
          data={tabs}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.tab,
                selectedTab === item.id && styles.activeTab
              ]}
              onPress={() => setSelectedTab(item.id)}
            >
              <Text style={[
                styles.tabText,
                selectedTab === item.id && styles.activeTabText
              ]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          keyExtractor={item => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabList}
        />
      </View>

      <FlatList
        data={orders}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        ListFooterComponent={
          hasMore ? (
            <TouchableOpacity 
              style={styles.loadMoreButton}
              onPress={handleLoadMore}
              disabled={loading}
            >
              <Text style={styles.loadMoreText}>
                {loading ? 'Loading...' : 'Load More'}
              </Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.endText}>End of orders</Text>
          )
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyText}>No orders</Text>
            <Text style={styles.emptySubtext}>Create a new order</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.aquaWhite,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.darkGrey,
  },
  newButton: {
    backgroundColor: colors.lightAqua,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  newButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  tabContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabList: {
    paddingHorizontal: spacing.md,
  },
  tab: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginRight: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.lightAqua,
  },
  tabText: {
    fontSize: 14,
    color: colors.textLight,
  },
  activeTabText: {
    color: colors.darkGrey,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
  },
  orderCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  orderNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  customerName: {
    fontSize: 14,
    color: colors.textLight,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '600',
  },
  cardDetails: {
    marginBottom: spacing.sm,
  },
  detailText: {
    fontSize: 13,
    color: colors.textLight,
    marginVertical: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  dateText: {
    fontSize: 12,
    color: colors.textLight,
  },
  cardActions: {
    flexDirection: 'row',
  },
  actionButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginLeft: spacing.xs,
    backgroundColor: colors.info,
  },
  cancelButton: {
    backgroundColor: colors.danger + '20',
  },
  actionButtonText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '600',
  },
  cancelText: {
    color: colors.danger,
  },
  loadMoreButton: {
    padding: spacing.md,
    alignItems: 'center',
  },
  loadMoreText: {
    color: colors.lightAqua,
    fontWeight: '600',
  },
  endText: {
    textAlign: 'center',
    color: colors.textLight,
    padding: spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});