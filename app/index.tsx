import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { getDatabase } from '../database/index';
import { colors, spacing, borderRadius, typography } from '../styles/colors';

export default function Dashboard() {
  const router = useRouter();
  const [balance, setBalance] = useState(0);
  const [plantName, setPlantName] = useState('Aqua Water Plant');
  const [stats, setStats] = useState({
    todaySales: 0,
    pendingOrders: 0,
    lowStock: 0,
  });
  const [recentTransactions, setRecentTransactions] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    const db = getDatabase();
    
    try {
      // Get plant settings
      const settings = await db.getFirstAsync('SELECT * FROM plant_settings LIMIT 1');
      if (settings) {
        setBalance(settings.balance);
        setPlantName(settings.plant_name);
      }

      // Get today's sales
      const today = new Date().toISOString().split('T')[0];
      const todaySales = await db.getAllAsync(
        'SELECT SUM(total_amount) as total FROM sales WHERE date(sale_date) = ? AND reversed = 0',
        [today]
      );
      setStats(prev => ({ ...prev, todaySales: todaySales[0]?.total || 0 }));

      // Get pending orders
      const pendingOrders = await db.getAllAsync(
        'SELECT COUNT(*) as count FROM orders WHERE status = ?',
        ['pending']
      );
      setStats(prev => ({ ...prev, pendingOrders: pendingOrders[0]?.count || 0 }));

      // Get low stock items
      const lowStockRaw = await db.getAllAsync(
        'SELECT COUNT(*) as count FROM raw_items WHERE stock_quantity < min_stock'
      );
      const lowStockReady = await db.getAllAsync(
        'SELECT COUNT(*) as count FROM ready_items WHERE stock_quantity < min_stock'
      );
      setStats(prev => ({ 
        ...prev, 
        lowStock: (lowStockRaw[0]?.count || 0) + (lowStockReady[0]?.count || 0)
      }));

      // Get recent transactions
      const transactions = await db.getAllAsync(
        'SELECT * FROM transactions ORDER BY created_at DESC LIMIT 5'
      );
      setRecentTransactions(transactions);

    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  const getTransactionIcon = (type) => {
    const icons = {
      cashin: '💰',
      cashout: '💳',
      sale: '🛒',
      purchase: '📦',
      expense: '💸',
      salary: '👤',
      withdrawal: '🏦',
      order_payment: '📋'
    };
    return icons[type] || '📝';
  };

  const getTransactionColor = (type) => {
    const colors_map = {
      cashin: colors.success,
      cashout: colors.danger,
      sale: colors.info,
      purchase: colors.warning,
      expense: colors.danger,
      salary: colors.info,
      withdrawal: colors.danger,
      order_payment: colors.info
    };
    return colors_map[type] || colors.darkGrey;
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>🌊 AquaLedger</Text>
        <Text style={styles.subtitle}>{plantName}</Text>
        <Text style={styles.date}>{new Date().toLocaleDateString()}</Text>
      </View>

      {/* Balance Card */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>Total Balance</Text>
        <Text style={styles.balanceAmount}>PKR {balance.toLocaleString()}</Text>
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/sales/new')}
        >
          <Text style={styles.actionIcon}>💰</Text>
          <Text style={styles.actionLabel}>Quick Sale</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/orders/new')}
        >
          <Text style={styles.actionIcon}>📋</Text>
          <Text style={styles.actionLabel}>New Order</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.actionButton}
          onPress={() => router.push('/account')}
        >
          <Text style={styles.actionIcon}>💳</Text>
          <Text style={styles.actionLabel}>Cash In/Out</Text>
        </TouchableOpacity>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>PKR {stats.todaySales.toLocaleString()}</Text>
          <Text style={styles.statLabel}>Today's Sales</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.pendingOrders}</Text>
          <Text style={styles.statLabel}>Pending Orders</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: stats.lowStock > 0 ? colors.danger : colors.success }]}>
            {stats.lowStock}
          </Text>
          <Text style={styles.statLabel}>Low Stock Items</Text>
        </View>
      </View>

      {/* Recent Transactions */}
      <View style={styles.recentSection}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        {recentTransactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No recent transactions</Text>
          </View>
        ) : (
          recentTransactions.map((transaction) => (
            <View key={transaction.id} style={styles.transactionItem}>
              <View style={styles.transactionLeft}>
                <Text style={styles.transactionIcon}>
                  {getTransactionIcon(transaction.type)}
                </Text>
                <View>
                  <Text style={styles.transactionType}>
                    {transaction.type.toUpperCase()}
                  </Text>
                  <Text style={styles.transactionPerson}>
                    {transaction.person_name || 'System'}
                  </Text>
                </View>
              </View>
              <View style={styles.transactionRight}>
                <Text style={[
                  styles.transactionAmount,
                  { color: getTransactionColor(transaction.type) }
                ]}>
                  {transaction.type === 'cashin' || transaction.type === 'sale' ? '+' : '-'}
                  PKR {transaction.amount.toLocaleString()}
                </Text>
                <Text style={styles.transactionDate}>
                  {new Date(transaction.created_at).toLocaleDateString()}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.aquaWhite,
  },
  header: {
    padding: spacing.md,
    paddingTop: spacing.xl,
    backgroundColor: colors.aquaWhite,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.darkGrey,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  date: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  balanceCard: {
    backgroundColor: colors.white,
    margin: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textLight,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.darkGrey,
    marginTop: spacing.xs,
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
  },
  actionButton: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    width: 100,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  actionIcon: {
    fontSize: 24,
  },
  actionLabel: {
    fontSize: 12,
    color: colors.darkGrey,
    marginTop: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.darkGrey,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  recentSection: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.darkGrey,
    marginBottom: spacing.md,
  },
  transactionItem: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  transactionType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  transactionPerson: {
    fontSize: 12,
    color: colors.textLight,
  },
  transactionRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  transactionDate: {
    fontSize: 11,
    color: colors.textLight,
    marginTop: 2,
  },
  emptyState: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textLight,
  },
});