import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function LoansScreen() {
  const [loans, setLoans] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedLoan, setSelectedLoan] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [filter, setFilter] = useState('active');

  useEffect(() => {
    loadLoans();
  }, [filter]);

  const loadLoans = async () => {
    const db = getDatabase();
    try {
      let query = `
        SELECT l.*, 
               (l.total_amount - l.paid_amount) as remaining
        FROM loans l
      `;
      
      if (filter === 'active') {
        query += ' WHERE l.status = "active"';
      } else if (filter === 'paid') {
        query += ' WHERE l.status = "paid"';
      } else if (filter === 'overdue') {
        query += ' WHERE l.status = "overdue"';
      }
      
      query += ' ORDER BY l.created_at DESC';
      
      const results = await db.getAllAsync(query);
      setLoans(results);
    } catch (error) {
      console.error('Error loading loans:', error);
      Alert.alert('Error', 'Failed to load loans');
    }
  };

  const handleAddPayment = async () => {
    if (!selectedLoan || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    const db = getDatabase();
    const amount = parseFloat(paymentAmount);
    const remaining = selectedLoan.total_amount - selectedLoan.paid_amount;

    if (amount > remaining) {
      Alert.alert('Error', `Amount cannot exceed remaining balance of PKR ${remaining.toLocaleString()}`);
      return;
    }

    try {
      await db.execAsync('BEGIN TRANSACTION');

      const newPaidAmount = selectedLoan.paid_amount + amount;
      const newStatus = newPaidAmount >= selectedLoan.total_amount ? 'paid' : 'active';

      // Update loan
      await db.runAsync(
        `UPDATE loans 
         SET paid_amount = ?, status = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [newPaidAmount, newStatus, selectedLoan.id]
      );

      // Record payment
      await db.runAsync(
        `INSERT INTO loan_payments (loan_id, amount, payment_date, notes)
         VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
        [selectedLoan.id, amount, paymentNotes.trim() || '']
      );

      // Update balance
      await db.runAsync(
        'UPDATE plant_settings SET balance = balance + ?',
        [amount]
      );

      // Add transaction
      await db.runAsync(
        `INSERT INTO transactions (type, amount, person_name, description, reference_id, reference_type)
         VALUES ('cashin', ?, ?, ?, ?, 'loan')`,
        [amount, selectedLoan.customer_name, `Loan payment for ${selectedLoan.customer_name}`, selectedLoan.id]
      );

      await db.execAsync('COMMIT');
      
      setModalVisible(false);
      setPaymentAmount('');
      setPaymentNotes('');
      await loadLoans();
      Alert.alert('Success', 'Payment recorded successfully');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error('Error adding payment:', error);
      Alert.alert('Error', 'Failed to record payment');
    }
  };

  const getStatusColor = (status) => {
    const colors_map = {
      active: colors.warning,
      paid: colors.success,
      overdue: colors.danger
    };
    return colors_map[status] || colors.textLight;
  };

  const renderItem = ({ item }) => {
    const remaining = item.total_amount - item.paid_amount;
    return (
      <View style={styles.loanCard}>
        <View style={styles.cardHeader}>
          <View style={styles.loanInfo}>
            <Text style={styles.customerName}>{item.customer_name}</Text>
            <Text style={styles.loanType}>{item.reference_type?.toUpperCase()}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status?.toUpperCase()}</Text>
          </View>
        </View>
        
        <View style={styles.cardDetails}>
          <Text style={styles.detailText}>Total: PKR {item.total_amount?.toLocaleString()}</Text>
          <Text style={styles.detailText}>Paid: PKR {item.paid_amount?.toLocaleString()}</Text>
          <Text style={[styles.detailText, styles.remainingText]}>
            Remaining: PKR {remaining.toLocaleString()}
          </Text>
          {item.due_date && (
            <Text style={styles.detailText}>Due: {new Date(item.due_date).toLocaleDateString()}</Text>
          )}
        </View>

        {item.status !== 'paid' && (
          <View style={styles.cardActions}>
            <TouchableOpacity 
              style={styles.paymentButton}
              onPress={() => {
                setSelectedLoan(item);
                setModalVisible(true);
              }}
            >
              <Text style={styles.paymentButtonText}>Receive Payment</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Loans & Remaining</Text>
      </View>

      <View style={styles.filterContainer}>
        {['active', 'paid', 'overdue', 'all'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.activeFilter]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.activeFilterText]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={loans}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💰</Text>
            <Text style={styles.emptyText}>No loans found</Text>
            <Text style={styles.emptySubtext}>All payments are up to date</Text>
          </View>
        }
      />

      {/* Payment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          setPaymentAmount('');
          setPaymentNotes('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Receive Payment
            </Text>
            
            {selectedLoan && (
              <>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentInfoText}>
                    Customer: {selectedLoan.customer_name}
                  </Text>
                  <Text style={styles.paymentInfoText}>
                    Remaining: PKR {(selectedLoan.total_amount - selectedLoan.paid_amount).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Amount (PKR) *</Text>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={paymentAmount}
                    onChangeText={setPaymentAmount}
                    placeholder="Enter amount received"
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Notes</Text>
                  <TextInput
                    style={styles.input}
                    value={paymentNotes}
                    onChangeText={setPaymentNotes}
                    placeholder="Add notes"
                    placeholderTextColor={colors.textLight}
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setModalVisible(false);
                      setPaymentAmount('');
                      setPaymentNotes('');
                    }}
                  >
                    <Text style={styles.modalButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.modalButton, styles.submitButton]}
                    onPress={handleAddPayment}
                  >
                    <Text style={styles.modalButtonText}>Record Payment</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
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
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    padding: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginHorizontal: spacing.xs,
  },
  activeFilter: {
    backgroundColor: colors.lightAqua,
  },
  filterText: {
    fontSize: 14,
    color: colors.textLight,
  },
  activeFilterText: {
    color: colors.white,
    fontWeight: '600',
  },
  listContent: {
    padding: spacing.md,
  },
  loanCard: {
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
  loanInfo: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  loanType: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
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
  remainingText: {
    color: colors.danger,
    fontWeight: '600',
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  paymentButton: {
    backgroundColor: colors.success,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  paymentButtonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
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
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.darkGrey,
    marginBottom: spacing.md,
    textAlign: 'center',
  },
  paymentInfo: {
    backgroundColor: colors.aquaWhite,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  paymentInfoText: {
    fontSize: 14,
    color: colors.darkGrey,
    marginVertical: 2,
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