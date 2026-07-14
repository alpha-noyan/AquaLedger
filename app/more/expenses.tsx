import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function ExpensesScreen() {
  const [expenses, setExpenses] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [expenseDate, setExpenseDate] = useState('');
  const [notes, setNotes] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadExpenses();
  }, []);

  const loadExpenses = async (reset = true) => {
    if (loading) return;
    setLoading(true);

    const db = getDatabase();
    try {
      const offset = reset ? 0 : page * 10;
      const query = `
        SELECT * FROM other_expenses 
        ORDER BY expense_date DESC 
        LIMIT 10 OFFSET ?
      `;
      const results = await db.getAllAsync(query, [offset]);
      
      if (reset) {
        setExpenses(results);
        setPage(1);
        setHasMore(results.length === 10);
      } else {
        if (results.length > 0) {
          setExpenses(prev => [...prev, ...results]);
          setPage(prev => prev + 1);
          setHasMore(results.length === 10);
        } else {
          setHasMore(false);
        }
      }
    } catch (error) {
      console.error('Error loading expenses:', error);
      Alert.alert('Error', 'Failed to load expenses');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (hasMore && !loading) {
      loadExpenses(false);
    }
  };

  const handleAddExpense = async () => {
    if (!title.trim() || !amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const db = getDatabase();
    try {
      await db.execAsync('BEGIN TRANSACTION');

      const result = await db.runAsync(
        `INSERT INTO other_expenses (title, amount, category, expense_date, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [title.trim(), parseFloat(amount), category.trim() || 'General', expenseDate || new Date().toISOString().split('T')[0], notes.trim() || '']
      );

      // Update balance
      await db.runAsync(
        'UPDATE plant_settings SET balance = balance - ?',
        [parseFloat(amount)]
      );

      // Add transaction
      await db.runAsync(
        `INSERT INTO transactions (type, amount, person_name, description, reference_id, reference_type)
         VALUES ('expense', ?, ?, ?, ?, 'expense')`,
        [parseFloat(amount), 'System', title.trim(), result.lastInsertRowId]
      );

      await db.execAsync('COMMIT');
      
      setModalVisible(false);
      resetForm();
      await loadExpenses(true);
      Alert.alert('Success', 'Expense added successfully');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error('Error adding expense:', error);
      Alert.alert('Error', 'Failed to add expense');
    }
  };

  const handleEditExpense = async () => {
    if (!selectedExpense) return;
    
    const db = getDatabase();
    try {
      await db.runAsync(
        `UPDATE other_expenses 
         SET title = ?, amount = ?, category = ?, expense_date = ?, notes = ?
         WHERE id = ?`,
        [title.trim(), parseFloat(amount), category.trim() || 'General', expenseDate, notes.trim() || '', selectedExpense.id]
      );
      
      setEditModalVisible(false);
      resetForm();
      await loadExpenses(true);
      Alert.alert('Success', 'Expense updated successfully');
    } catch (error) {
      console.error('Error updating expense:', error);
      Alert.alert('Error', 'Failed to update expense');
    }
  };

  const handleDeleteExpense = (expense) => {
    Alert.alert(
      'Delete Expense',
      `Are you sure you want to delete "${expense.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const db = getDatabase();
            try {
              await db.execAsync('BEGIN TRANSACTION');

              // Get the expense to reverse the balance
              const exp = await db.getFirstAsync(
                'SELECT * FROM other_expenses WHERE id = ?',
                [expense.id]
              );

              if (exp) {
                // Reverse balance
                await db.runAsync(
                  'UPDATE plant_settings SET balance = balance + ?',
                  [exp.amount]
                );

                // Delete expense
                await db.runAsync('DELETE FROM other_expenses WHERE id = ?', [expense.id]);
              }

              await db.execAsync('COMMIT');
              await loadExpenses(true);
              Alert.alert('Success', 'Expense deleted and balance updated');
            } catch (error) {
              await db.execAsync('ROLLBACK');
              console.error('Error deleting expense:', error);
              Alert.alert('Error', 'Failed to delete expense');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setTitle('');
    setAmount('');
    setCategory('');
    setExpenseDate('');
    setNotes('');
    setSelectedExpense(null);
  };

  const openEditModal = (expense) => {
    setSelectedExpense(expense);
    setTitle(expense.title);
    setAmount(expense.amount.toString());
    setCategory(expense.category || '');
    setExpenseDate(expense.expense_date);
    setNotes(expense.notes || '');
    setEditModalVisible(true);
  };

  const getCategoryColor = (category) => {
    const colors_map = {
      'Utility': colors.info,
      'Salary': colors.success,
      'Maintenance': colors.warning,
      'Rent': colors.danger,
      'Other': colors.textLight
    };
    return colors_map[category] || colors.textLight;
  };

  const renderItem = ({ item }) => (
    <View style={styles.expenseCard}>
      <View style={styles.cardHeader}>
        <View style={styles.expenseInfo}>
          <Text style={styles.expenseTitle}>{item.title}</Text>
          <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(item.category) + '20' }]}>
            <Text style={[styles.categoryText, { color: getCategoryColor(item.category) }]}>
              {item.category || 'General'}
            </Text>
          </View>
        </View>
        <Text style={styles.expenseAmount}>PKR {item.amount?.toLocaleString()}</Text>
      </View>
      
      <View style={styles.cardFooter}>
        <Text style={styles.dateText}>
          📅 {new Date(item.expense_date).toLocaleDateString()}
        </Text>
        <View style={styles.cardActions}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.editButton]}
            onPress={() => openEditModal(item)}
          >
            <Text style={styles.actionButtonText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => handleDeleteExpense(item)}
          >
            <Text style={styles.actionButtonText}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Expenses</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Add Expense</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
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
            <Text style={styles.endText}>End of expenses</Text>
          )
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>💸</Text>
            <Text style={styles.emptyText}>No expenses recorded</Text>
            <Text style={styles.emptySubtext}>Add your first expense</Text>
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
              <Text style={styles.modalTitle}>Add Expense</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter expense title"
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
                <Text style={styles.inputLabel}>Category</Text>
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="e.g., Utility, Salary, Maintenance"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={expenseDate}
                  onChangeText={setExpenseDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add notes"
                  placeholderTextColor={colors.textLight}
                  multiline
                  numberOfLines={2}
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
                  onPress={handleAddExpense}
                >
                  <Text style={styles.modalButtonText}>Add Expense</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Edit Expense</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Title *</Text>
                <TextInput
                  style={styles.input}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Enter expense title"
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
                <Text style={styles.inputLabel}>Category</Text>
                <TextInput
                  style={styles.input}
                  value={category}
                  onChangeText={setCategory}
                  placeholder="e.g., Utility, Salary, Maintenance"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Date</Text>
                <TextInput
                  style={styles.input}
                  value={expenseDate}
                  onChangeText={setExpenseDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={notes}
                  onChangeText={setNotes}
                  placeholder="Add notes"
                  placeholderTextColor={colors.textLight}
                  multiline
                  numberOfLines={2}
                />
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setEditModalVisible(false);
                    resetForm();
                  }}
                >
                  <Text style={styles.modalButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleEditExpense}
                >
                  <Text style={styles.modalButtonText}>Update Expense</Text>
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
    backgroundColor: colors.lightAqua,
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
  expenseCard: {
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
  expenseInfo: {
    flex: 1,
  },
  expenseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    marginTop: spacing.xs,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  expenseAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.danger,
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
    marginLeft: spacing.sm,
  },
  editButton: {
    backgroundColor: colors.info + '20',
  },
  deleteButton: {
    backgroundColor: colors.danger + '20',
  },
  actionButtonText: {
    fontSize: 12,
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
    height: 60,
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