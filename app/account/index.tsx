import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Alert, FlatList } from 'react-native';
import { useState, useEffect } from 'react';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius, typography } from '../../styles/colors';
import { useGlobalContext } from '../globalContext';

export default function AccountScreen() {
  const { balance, setBalance, plantName, setPlantName } = useGlobalContext();
  const [transactions, setTransactions] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalType, setModalType] = useState('cashin'); // cashin or cashout
  const [amount, setAmount] = useState('');
  const [personName, setPersonName] = useState('');
  const [description, setDescription] = useState('');
  const [editNameModal, setEditNameModal] = useState(false);
  const [newPlantName, setNewPlantName] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadAccountData();
    loadTransactions();
  }, []);

  const loadAccountData = async () => {
    const db = getDatabase();
    try {
      const settings = await db.getFirstAsync('SELECT * FROM plant_settings LIMIT 1');
      if (settings) {
        // console.log(settings);
        setPlantName(settings.plant_name);
        setBalance(settings.balance);
      }
    } catch (error) {
      console.error('Error loading account data:', error);
    }
  };

  const loadTransactions = async (reset = true) => {
    if (loading) return;
    setLoading(true);

    const db = getDatabase();
    try {
      const offset = reset ? 0 : page * 10;
      const query = `
        SELECT * FROM transactions 
        ORDER BY created_at DESC 
        LIMIT 10 OFFSET ?
      `;
      const results = await db.getAllAsync(query, [offset]);
      
      if (reset) {
        setTransactions(results);
        setPage(1);
        setHasMore(results.length === 10);
      } else {
        if (results.length > 0) {
          setTransactions(prev => [...prev, ...results]);
          setPage(prev => prev + 1);
          setHasMore(results.length === 10);
        } else {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadTransactions(false);
    }
  };

  const handleCashTransaction = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!personName.trim()) {
      Alert.alert('Error', 'Please enter a person name');
      return;
    }

    const db = getDatabase();
    const amountValue = parseFloat(amount);
    
    try {
      // Start transaction
      await db.execAsync('BEGIN TRANSACTION');

      // Update balance
      const balanceUpdate = modalType === 'cashin' ? amountValue : -amountValue;
      await db.runAsync(
        'UPDATE plant_settings SET balance = balance + ?, last_updated = CURRENT_TIMESTAMP',
        [balanceUpdate]
      );

      // Insert transaction
      await db.runAsync(
        `INSERT INTO transactions (type, amount, person_name, description, transaction_date) 
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [modalType, amountValue, personName.trim(), description.trim() || '']
      );

      await db.execAsync('COMMIT');
      
      // Reset form and refresh
      setModalVisible(false);
      setAmount('');
      setPersonName('');
      setDescription('');
      await loadAccountData();
      await loadTransactions(true);

      Alert.alert('Success', `${modalType === 'cashin' ? 'Cash In' : 'Cash Out'} completed successfully`);
    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error('Error processing transaction:', error);
      Alert.alert('Error', 'Failed to process transaction');
    }
  };

  const handleReverseTransaction = async (transactionId) => {
    Alert.alert(
      'Reverse Transaction',
      'Are you sure you want to reverse this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reverse',
          style: 'destructive',
          onPress: async () => {
            const db = getDatabase();
            try {
              await db.execAsync('BEGIN TRANSACTION');

              // Get transaction details
              const transaction = await db.getFirstAsync(
                'SELECT * FROM transactions WHERE id = ?',
                [transactionId]
              );

              if (!transaction || transaction.reversed) {
                Alert.alert('Error', 'Transaction cannot be reversed');
                await db.execAsync('ROLLBACK');
                return;
              }

              // Reverse balance
              const reverseAmount = transaction.type === 'cashin' ? -transaction.amount : transaction.amount;
              await db.runAsync(
                'UPDATE plant_settings SET balance = balance + ?',
                [reverseAmount]
              );

              // Mark as reversed
              await db.runAsync(
                'UPDATE transactions SET reversed = 1, reversal_id = ? WHERE id = ?',
                [Date.now(), transactionId]
              );

              await db.execAsync('COMMIT');
              await loadAccountData();
              await loadTransactions(true);
              Alert.alert('Success', 'Transaction reversed successfully');
            } catch (error) {
              await db.execAsync('ROLLBACK');
              console.error('Error reversing transaction:', error);
              Alert.alert('Error', 'Failed to reverse transaction');
            }
          }
        }
      ]
    );
  };

  const handleUpdatePlantName = async () => {
    if (!newPlantName.trim()) {
      Alert.alert('Error', 'Please enter a plant name');
      return;
    }

    const db = getDatabase();
    try {
      await db.runAsync(
        'UPDATE plant_settings SET plant_name = ?',
        [newPlantName.trim()]
      );
      setPlantName(newPlantName.trim());
      setEditNameModal(false);
      Alert.alert('Success', 'Plant name updated successfully');
    } catch (error) {
      console.error('Error updating plant name:', error);
      Alert.alert('Error', 'Failed to update plant name');
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

  const renderTransaction = ({ item }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionLeft}>
        <Text style={styles.transactionIcon}>{getTransactionIcon(item.type)}</Text>
        <View>
          <Text style={styles.transactionType}>{item.type.toUpperCase()}</Text>
          <Text style={styles.transactionPerson}>{item.person_name || 'System'}</Text>
          {item.reversed === 1 && (
            <Text style={styles.reversedTag}>REVERSED</Text>
          )}
        </View>
      </View>
      <View style={styles.transactionRight}>
        <Text style={[
          styles.transactionAmount,
          { color: getTransactionColor(item.type) }
        ]}>
          {item.type === 'cashin' || item.type === 'sale' ? '+' : '-'}
          PKR {item.amount.toLocaleString()}
        </Text>
        <Text style={styles.transactionDate}>
          {new Date(item.created_at).toLocaleString()}
        </Text>
        {item.reversed === 0 && (
          <TouchableOpacity
            onPress={() => handleReverseTransaction(item.id)}
            style={styles.reverseButton}
          >
            <Text style={styles.reverseButtonText}>Reverse</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <ScrollView>
        {/* Plant Name Section */}
        <View style={styles.plantSection}>
          <Text style={styles.sectionLabel}>Plant Name</Text>
          <View style={styles.plantNameRow}>
            <Text style={styles.plantName}>{plantName}</Text>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => {
                setNewPlantName(plantName);
                setEditNameModal(true);
              }}
            >
              <Text style={styles.editButtonText}>✏️ Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Balance Section */}
        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceAmount}>PKR {balance}</Text>
          <View style={styles.balanceActions}>
            <TouchableOpacity 
              style={[styles.balanceButton, styles.cashInButton]}
              onPress={() => {
                setModalType('cashin');
                setModalVisible(true);
              }}
            >
              <Text style={styles.balanceButtonText}>💰 Cash In</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.balanceButton, styles.cashOutButton]}
              onPress={() => {
                setModalType('cashout');
                setModalVisible(true);
              }}
            >
              <Text style={styles.balanceButtonText}>💳 Cash Out</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Transactions Section */}
        <View style={styles.transactionsSection}>
          <Text style={styles.sectionTitle}>Transaction History</Text>
          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No transactions yet</Text>
            </View>
          ) : (
            <FlatList
              data={transactions}
              renderItem={renderTransaction}
              keyExtractor={item => item.id.toString()}
              scrollEnabled={false}
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
                  <Text style={styles.endText}>End of transactions</Text>
                )
              }
            />
          )}
        </View>
      </ScrollView>

      {/* Cash In/Out Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {modalType === 'cashin' ? '💰 Cash In' : '💳 Cash Out'}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount (PKR)</Text>
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
              <Text style={styles.inputLabel}>Person Name</Text>
              <TextInput
                style={styles.input}
                value={personName}
                onChangeText={setPersonName}
                placeholder="Enter person name"
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={description}
                onChangeText={setDescription}
                placeholder="Add description"
                placeholderTextColor={colors.textLight}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleCashTransaction}
              >
                <Text style={styles.modalButtonText}>Submit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Plant Name Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editNameModal}
        onRequestClose={() => setEditNameModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Edit Plant Name</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Plant Name</Text>
              <TextInput
                style={styles.input}
                value={newPlantName}
                onChangeText={setNewPlantName}
                placeholder="Enter plant name"
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setEditNameModal(false)}
              >
                <Text style={styles.modalButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.submitButton]}
                onPress={handleUpdatePlantName}
              >
                <Text style={styles.modalButtonText}>Update</Text>
              </TouchableOpacity>
            </View>
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
  plantSection: {
    backgroundColor: colors.white,
    padding: spacing.md,
    margin: spacing.md,
    borderRadius: borderRadius.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 12,
    color: colors.textLight,
    marginBottom: spacing.xs,
  },
  plantNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  plantName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.darkGrey,
  },
  editButton: {
    padding: spacing.xs,
  },
  editButtonText: {
    fontSize: 14,
    color: colors.lightAqua,
  },
  balanceSection: {
    backgroundColor: colors.white,
    padding: spacing.lg,
    margin: spacing.md,
    borderRadius: borderRadius.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: 14,
    color: colors.textLight,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.darkGrey,
    marginVertical: spacing.md,
  },
  balanceActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  balanceButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    minWidth: 120,
    alignItems: 'center',
  },
  cashInButton: {
    backgroundColor: colors.success,
  },
  cashOutButton: {
    backgroundColor: colors.danger,
  },
  balanceButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  transactionsSection: {
    padding: spacing.md,
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
  reversedTag: {
    fontSize: 10,
    color: colors.danger,
    fontWeight: 'bold',
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
  reverseButton: {
    marginTop: 4,
    padding: 4,
  },
  reverseButtonText: {
    fontSize: 11,
    color: colors.danger,
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