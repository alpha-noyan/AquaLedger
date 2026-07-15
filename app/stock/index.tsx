import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function StockScreen() {
  const router = useRouter();

  const menuItems = [
    {
      id: 'raw',
      title: 'Raw Items',
      icon: '📦',
      description: 'Manage raw materials inventory',
      route: '/stock/raw-items',
      color: colors.info,
    },
    {
      id: 'ready',
      title: 'Ready Items',
      icon: '🏷️',
      description: 'Manage finished products',
      route: '/stock/ready-items',
      color: colors.success,
    },
    // {
    //   id: 'production',
    //   title: 'Production',
    //   icon: '🏭',
    //   description: 'Manage production orders',
    //   route: '/stock/production',
    //   color: colors.warning,
    // },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Stock Management</Text>
        <Text style={styles.subtitle}>Manage your inventory</Text>
      </View>

      <View style={styles.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuCard}
            onPress={() => router.push(item.route)}
          >
            <View style={[styles.iconContainer, { backgroundColor: item.color + '20' }]}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <Text style={styles.menuTitle}>{item.title}</Text>
            <Text style={styles.menuDescription}>{item.description}</Text>
            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Quick Stats */}
      {/* <View style={styles.statsSection}>
        <Text style={styles.statsTitle}>Quick Stats</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>1,500</Text>
            <Text style={styles.statLabel}>Raw Items</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>580</Text>
            <Text style={styles.statLabel}>Ready Items</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>3</Text>
            <Text style={styles.statLabel}>Production Orders</Text>
          </View>
        </View>
      </View> */}
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
    paddingTop: spacing.lg,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.darkGrey,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
  menuGrid: {
    padding: spacing.md,
  },
  menuCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  icon: {
    fontSize: 24,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.darkGrey,
    marginBottom: spacing.xs,
  },
  menuDescription: {
    fontSize: 14,
    color: colors.textLight,
  },
  arrowContainer: {
    position: 'absolute',
    right: spacing.md,
    top: '50%',
    transform: [{ translateY: -12 }],
  },
  arrow: {
    fontSize: 20,
    color: colors.textLight,
  },
  statsSection: {
    padding: spacing.md,
    paddingTop: 0,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGrey,
    marginBottom: spacing.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    flex: 1,
    backgroundColor: colors.white,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.darkGrey,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});