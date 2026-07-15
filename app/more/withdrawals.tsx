import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function WithdrawalsScreen() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [withdrawalDate, setWithdrawalDate] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadWithdrawals();
  }, []);

  const loadWithdrawals = async (reset = true) => {
    if (loading) return;
    setLoading(true);

    const db = getDatabase();
    try {
      const offset = reset ? 0 : page * 10;
      const query = `
        SELECT * FROM withdrawals 
        ORDER BY withdrawal_date DESC 
        LIMIT 10 OFFSET ?
      `;
      const results = await db.getAllAsync(query, [offset]);
      
      if (reset) {
        setWithdrawals(results);
        setPage(1);
        setHasMore(results.length === 10);
      } else {
        if (results.length > 0) {
          setWithdrawals(prev => [...prev, ...results]);
          setPage(prev => prev + 1);
          setHasMore(results.length === 10);
        } else {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Error loading withdrawals:', error);
      Alert.alert('Error', 'Failed to load withdrawals');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadWithdrawals(false);
    }
  };

  const handleAddWithdrawal = async () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const db = getDatabase();
    try {
      await db.execAsync('BEGIN TRANSACTION');

      const result = await db.runAsync(
        `INSERT INTO withdrawals (title, amount, reason, withdrawal_date)
         VALUES (?, ?, ?, ?)`,
        [title.trim(), parseFloat(amount), reason.trim() || '', withdrawalDate || new Date().toISOString().split('T')[0]]
      );

      // Update balance
      await db.runAsync(
        'UPDATE plant_settings SET balance = balance - ?',
        [parseFloat(amount)]
      );

      // Add transaction
      await db.runAsync(
        `INSERT INTO transactions (type, amount, person_name, description, reference_id, reference_type)
         VALUES ('withdrawal', ?, ?, ?, ?, 'withdrawal')`,
        [parseFloat(amount), 'Owner', title.trim(), result.lastInsertRowId]
      );

      await db.execAsync('COMMIT');
      
      setModalVisible(false);
      resetForm();
      await loadWithdrawals(true);
      Alert.alert('Success', 'Withdrawal recorded successfully');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error('Error adding withdrawal:', error);
      Alert.alert('Error', 'Failed to record withdrawal');
    }
  };

  const handleReverseWithdrawal = async (withdrawalId) => {
    Alert.alert(
      'Reverse Withdrawal',
      'Are you sure you want to reverse this withdrawal? This will add the amount back to balance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reverse',
          style: 'destructive',
          onPress: async () => {
            const db = getDatabase();
            try {
              await db.execAsync('BEGIN TRANSACTION');

              const withdrawal = await db.getFirstAsync(
                'SELECT * FROM withdrawals WHERE id = ?',
                [withdrawalId]
              );

              if (!withdrawal || withdrawal.reversed) {
                Alert.alert('Error', 'Withdrawal cannot be reversed');
                await db.execAsync('ROLLBACK');
                return;
              }

              // Update balance
              await db.runAsync(
                'UPDATE plant_settings SET balance = balance + ?',
                [withdrawal.amount]
              );

              // Mark as reversed
              await db.runAsync(
                'UPDATE withdrawals SET reversed = 1 WHERE id = ?',
                [withdrawalId]
              );

              await db.execAsync('COMMIT');
              await loadWithdrawals(true);
              Alert.alert('Success', 'Withdrawal reversed successfully');
            } catch (error) {
              await db.execAsync('ROLLBACK');
              console.error('Error reversing withdrawal:', error);
              Alert.alert('Error', 'Failed to reverse withdrawal');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setReason('');
    setWithdrawalDate('');
  };

  const renderItem = ({ item }) => (
    <View style={styles.withdrawalCard}>
      <View style={styles.cardHeader}>
        <View style={styles.withdrawalInfo}>
          <Text style={styles.withdrawalTitle}>{item.title}</Text>
          {item.reason && (
            <Text style={styles.withdrawalReason}>{item.reason}</Text>
          )}
        </View>
        <Text style={[styles.withdrawalAmount, item.reversed && styles.reversedAmount]}>
          {item.reversed ? 'REVERSED' : `PKR ${item.amount?.toLocaleString()}`}
        </Text>
      </View>
      
      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>
          📅 {new Date(item.withdrawal_date).toLocaleDateString()}
        </Text>
        {!item.reversed && (
          <TouchableOpacity 
            style={styles.reverseButton}
            onPress={() => handleReverseWithdrawal(item.id)}
          >
            <Text style={styles.reverseButtonText}>↺ Reverse</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Withdrawals</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Withdraw</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={withdrawals}
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
            <Text style={styles.endText}>End of withdrawals</Text>
          )
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏦</Text>
            <Text style={styles.emptyText}>No withdrawals</Text>
            <Text style={styles.emptySubtext}>Record your first withdrawal</Text>
          </View>
        }
      />

      {/* Add Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>New Withdrawal</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter withdrawal title"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Amount (PKR) *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Enter amount"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Reason</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Enter reason for withdrawal"
                  placeholderTextColor={colors.textLight}
                  multiline
                  numberOfLines={3}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={withdrawalDate}
                  onChangeText={setWithdrawalDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleAddWithdrawal}
                >
                  <Text style={styles.modalButtonText}>Record Withdrawal</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  addButton: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
  },
  withdrawalCard: {
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
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  withdrawalInfo: {
    flex: 1,
  },
  withdrawalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  withdrawalReason: {
    fontSize: 14,
    color: colors.textLight,
    marginTop: 2,
  },
  withdrawalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.danger,
  },
  reversedAmount: {
    fontSize: 12,
    color: colors.success,
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
  reverseButton: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  reverseButtonText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '600',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    width: '90%',
    maxWidth: 400,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.darkGrey,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    fontSize: 14,
    color: colors.darkGrey,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: 16,
    backgroundColor: colors.white,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  modalButton: {
    flex: 1,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  cancelButton: {
    backgroundColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.lightAqua,
  },
  modalButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
});