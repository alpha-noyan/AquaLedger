import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function MoreScreen() {
  const router = useRouter();

  const menuItems = [
    {
      id: 'employees',
      title: 'Employees',
      icon: '👤',
      description: 'Manage staff and salaries',
      route: '/more/employees',
    },
    {
      id: 'vehicles',
      title: 'Vehicles',
      icon: '🚗',
      description: 'Manage vehicles and expenses',
      route: '/more/vehicles',
    },
    {
      id: 'expenses',
      title: 'Expenses',
      icon: '💸',
      description: 'Track other expenses',
      route: '/more/expenses',
    },
    {
      id: 'withdrawals',
      title: 'Withdrawals',
      icon: '🏦',
      description: 'Track owner withdrawals',
      route: '/more/withdrawals',
    },
    {
      id: 'loans',
      title: 'Loans & Remaining',
      icon: '💰',
      description: 'Manage customer loans',
      route: '/more/loans',
    },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Management</Text>
        <Text style={styles.subtitle}>Manage your business operations</Text>
      </View>

      <View style={styles.menuGrid}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={styles.menuCard}
            onPress={() => router.push(item.route)}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.icon}>{item.icon}</Text>
              <Text style={styles.menuTitle}>{item.title}</Text>
            </View>
            <Text style={styles.menuDescription}>{item.description}</Text>
            <View style={styles.arrowContainer}>
              <Text style={styles.arrow}>→</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>AquaLedger v1.0</Text>
        <Text style={styles.footerSubtext}>Water Plant Management</Text>
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
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  icon: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  menuDescription: {
    fontSize: 14,
    color: colors.textLight,
    marginLeft: 36,
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
  footer: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: colors.textLight,
  },
  footerSubtext: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: spacing.xs,
  },
});