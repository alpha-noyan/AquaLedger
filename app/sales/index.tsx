import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius } from '../../styles/colors';
import { useGlobalContext } from '../globalContext';

export default function SalesScreen() {
  const router = useRouter();
  const {sales, setSales} = useGlobalContext();
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSales();
  }, []);

  const loadSales = async (reset = true) => {
    if (loading) return;
    setLoading(true);

    const db = getDatabase();
    try {
      const offset = reset ? 0 : page * 10;
      const query = `
        SELECT s.*, 
               (SELECT COUNT(*) FROM sale_items WHERE sale_id = s.id) as item_count
        FROM sales s
        WHERE s.reversed = 0
        ORDER BY s.sale_date DESC 
        LIMIT 10 OFFSET ?
      `;
      const results = await db.getAllAsync(query, [offset]);
      
      if (reset) {
        setSales(results);
        setPage(1);
        setHasMore(results.length === 10);
      } else {
        if (results.length > 0) {
          setSales(prev => [...prev, ...results]);
          setPage(prev => prev + 1);
          setHasMore(results.length === 10);
        } else {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Error loading sales:', error);
      Alert.alert('Error', 'Failed to load sales');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadSales(false);
    }
  };

  const handleReverseSale = async (saleId) => {
    Alert.alert(
      'Reverse Sale',
      'Are you sure you want to reverse this sale? This will return items to stock and reverse payments.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reverse',
          style: 'destructive',
          onPress: async () => {
            const db = getDatabase();
            try {
              await db.execAsync('BEGIN TRANSACTION');

              // Get sale items
              const items = await db.getAllAsync(
                'SELECT * FROM sale_items WHERE sale_id = ?',
                [saleId]
              );

              // Return items to stock
              for (const item of items) {
                await db.runAsync(
                  'UPDATE ready_items SET stock_quantity = stock_quantity + ? WHERE id = ?',
                  [item.quantity, item.ready_item_id]
                );
              }

              // Reverse sale payments
              const payments = await db.getAllAsync(
                'SELECT * FROM sale_transactions WHERE sale_id = ?',
                [saleId]
              );

              for (const payment of payments) {
                await db.runAsync(
                  'UPDATE plant_settings SET balance = balance - ?',
                  [payment.amount]
                );
              }

              // Mark sale as reversed
              await db.runAsync(
                'UPDATE sales SET reversed = 1 WHERE id = ?',
                [saleId]
              );

              await db.execAsync('COMMIT');
              await loadSales(true);
              Alert.alert('Success', 'Sale reversed successfully');
            } catch (error) {
              await db.execAsync('ROLLBACK');
              console.error('Error reversing sale:', error);
              Alert.alert('Error', 'Failed to reverse sale');
            }
          }
        }
      ]
    );
  };

  const getStatusColor = (status) => {
    const colors_map = {
      paid: colors.success,
      pending: colors.danger,
      partial: colors.warning
    };
    return colors_map[status] || colors.textLight;
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.saleCard}
      onPress={() => router.push(`/sales/${item.id}`)}
    >
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.customerName}>{item.customer_name || 'Walk-in Customer'}</Text>
          <Text style={styles.saleId}>#SALE-{item.id}</Text>
        </View>
        <Text style={[styles.statusBadge, { backgroundColor: getStatusColor(item.payment_status) }]}>
          {item.payment_status?.toUpperCase()}
        </Text>
      </View>
      
      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>Items: {item.item_count}</Text>
        <Text style={styles.detailText}>Total: PKR {item.total_amount?.toLocaleString()}</Text>
        <Text style={styles.detailText}>Paid: PKR {item.paid_amount?.toLocaleString()}</Text>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>
          {new Date(item.sale_date).toLocaleDateString()}
        </Text>
        {item.payment_status !== 'paid' && (
          <TouchableOpacity 
            style={styles.collectButton}
            // onPress={() => router.push(`/sales/${item.id}/collect`)}
          >
            <Text style={styles.collectButtonText}>Collect Payment</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity 
          style={styles.reverseButton}
          onPress={() => handleReverseSale(item.id)}
        >
          <Text style={styles.reverseButtonText}>↺ Reverse</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Sales</Text>
        <TouchableOpacity 
          style={styles.newButton}
          onPress={() => router.push('/sales/new')}
        >
          <Text style={styles.newButtonText}>+ New Sale</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={sales}
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
            <Text style={styles.endText}>End of sales history</Text>
          )
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyText}>No sales yet</Text>
            <Text style={styles.emptySubtext}>Start making sales</Text>
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
  listContent: {
    padding: spacing.md,
  },
  saleCard: {
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
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  saleId: {
    fontSize: 12,
    color: colors.textLight,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
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
  collectButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
  },
  collectButtonText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '600',
  },
  reverseButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  reverseButtonText: {
    fontSize: 11,
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