import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function EmployeesScreen() {
  const [employees, setEmployees] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [filter, setFilter] = useState('active'); // active, inactive, all
  
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [position, setPosition] = useState('');
  const [salary, setSalary] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentType, setPaymentType] = useState('salary');
  const [paymentNotes, setPaymentNotes] = useState('');

  useEffect(() => {
    loadEmployees();
  }, [filter]);

  const loadEmployees = async () => {
    const db = getDatabase();
    try {
      let query = 'SELECT * FROM employees';
      const params = [];
      
      if (filter === 'active') {
        query += ' WHERE is_active = 1';
      } else if (filter === 'inactive') {
        query += ' WHERE is_active = 0';
      }
      
      query += ' ORDER BY name';
      
      const results = await db.getAllAsync(query, params);
      setEmployees(results);
    } catch (error) {
      console.error('Error loading employees:', error);
      Alert.alert('Error', 'Failed to load employees');
    }
  };

  const handleAddEmployee = async () => {
    if (!name.trim() || !phone.trim() || !position.trim() || !salary) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const db = getDatabase();
    try {
      await db.runAsync(
        `INSERT INTO employees (name, phone, address, position, salary, notes, is_active, hire_date)
         VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)`,
        [name.trim(), phone.trim(), address.trim(), position.trim(), parseFloat(salary), notes.trim() || '']
      );
      
      setModalVisible(false);
      resetForm();
      await loadEmployees();
      Alert.alert('Success', 'Employee added successfully');
    } catch (error) {
      console.error('Error adding employee:', error);
      Alert.alert('Error', 'Failed to add employee');
    }
  };

  const handleEditEmployee = async () => {
    if (!selectedEmployee) return;
    
    const db = getDatabase();
    try {
      await db.runAsync(
        `UPDATE employees 
         SET name = ?, phone = ?, address = ?, position = ?, salary = ?, notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name.trim(), phone.trim(), address.trim(), position.trim(), parseFloat(salary), notes.trim() || '', selectedEmployee.id]
      );
      
      setEditModalVisible(false);
      resetForm();
      await loadEmployees();
      Alert.alert('Success', 'Employee updated successfully');
    } catch (error) {
      console.error('Error updating employee:', error);
      Alert.alert('Error', 'Failed to update employee');
    }
  };

  const handleToggleActive = async (employee) => {
    const db = getDatabase();
    const newStatus = employee.is_active ? 0 : 1;
    const action = employee.is_active ? 'Deactivate' : 'Activate';
    
    Alert.alert(
      `${action} Employee`,
      `Are you sure you want to ${action.toLowerCase()} ${employee.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              await db.runAsync(
                `UPDATE employees SET is_active = ?, termination_date = ? WHERE id = ?`,
                [newStatus, newStatus === 0 ? new Date().toISOString() : null, employee.id]
              );
              await loadEmployees();
              Alert.alert('Success', `Employee ${action.toLowerCase()}d successfully`);
            } catch (error) {
              console.error('Error toggling employee:', error);
              Alert.alert('Error', 'Failed to update employee');
            }
          }
        }
      ]
    );
  };

  const handleAddPayment = async () => {
    if (!selectedEmployee || !paymentAmount || parseFloat(paymentAmount) <= 0) {
      Alert.alert('Error', 'Please enter a valid payment amount');
      return;
    }

    const db = getDatabase();
    try {
      await db.execAsync('BEGIN TRANSACTION');

      await db.runAsync(
        `INSERT INTO employee_payments (employee_id, amount, payment_date, payment_type, notes)
         VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`,
        [selectedEmployee.id, parseFloat(paymentAmount), paymentType, paymentNotes.trim() || '']
      );

      // Update balance
      await db.runAsync(
        'UPDATE plant_settings SET balance = balance - ?',
        [parseFloat(paymentAmount)]
      );

      // Add transaction
      await db.runAsync(
        `INSERT INTO transactions (type, amount, person_name, description, reference_id, reference_type)
         VALUES ('salary', ?, ?, ?, ?, 'employee')`,
        [parseFloat(paymentAmount), selectedEmployee.name, `${paymentType} payment`, selectedEmployee.id]
      );

      await db.execAsync('COMMIT');
      
      setPaymentModalVisible(false);
      setPaymentAmount('');
      setPaymentNotes('');
      await loadEmployees();
      Alert.alert('Success', 'Payment recorded successfully');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error('Error adding payment:', error);
      Alert.alert('Error', 'Failed to record payment');
    }
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setAddress('');
    setPosition('');
    setSalary('');
    setNotes('');
    setSelectedEmployee(null);
  };

  const openEditModal = (employee) => {
    setSelectedEmployee(employee);
    setName(employee.name);
    setPhone(employee.phone || '');
    setAddress(employee.address || '');
    setPosition(employee.position || '');
    setSalary(employee.salary?.toString() || '');
    setNotes(employee.notes || '');
    setEditModalVisible(true);
  };

  const openPaymentModal = (employee) => {
    setSelectedEmployee(employee);
    setPaymentModalVisible(true);
  };

  const renderItem = ({ item }) => (
    <View style={styles.employeeCard}>
      <View style={styles.cardHeader}>
        <View style={styles.employeeInfo}>
          <Text style={styles.employeeName}>{item.name}</Text>
          <Text style={styles.employeePosition}>{item.position}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: item.is_active ? colors.success : colors.danger }]}>
          <Text style={styles.statusText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>
      
      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>📱 {item.phone || 'No phone'}</Text>
        <Text style={styles.detailText}>💰 PKR {item.salary?.toLocaleString() || 0}</Text>
        <Text style={styles.detailText}>📅 Hired: {new Date(item.hire_date).toLocaleDateString()}</Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.paymentButton]}
          onPress={() => openPaymentModal(item)}
        >
          <Text style={styles.actionButtonText}>Payment</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.toggleButton]}
          onPress={() => handleToggleActive(item)}
        >
          <Text style={styles.actionButtonText}>
            {item.is_active ? 'Deactivate' : 'Activate'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Employees</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        {['active', 'inactive', 'all'].map((f) => (
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
        data={employees}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
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
              <Text style={styles.modalTitle}>Add Employee</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter employee name"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone *</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textLight}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Enter address"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Position *</Text>
                <TextInput
                  style={styles.input}
                  value={position}
                  onChangeText={setPosition}
                  placeholder="Enter position"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Salary (PKR) *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={salary}
                  onChangeText={setSalary}
                  placeholder="Enter salary"
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
                  onPress={handleAddEmployee}
                >
                  <Text style={styles.modalButtonText}>Add Employee</Text>
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
              <Text style={styles.modalTitle}>Edit Employee</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter employee name"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone *</Text>
                <TextInput
                  style={styles.input}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter phone number"
                  placeholderTextColor={colors.textLight}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Address</Text>
                <TextInput
                  style={styles.input}
                  value={address}
                  onChangeText={setAddress}
                  placeholder="Enter address"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Position *</Text>
                <TextInput
                  style={styles.input}
                  value={position}
                  onChangeText={setPosition}
                  placeholder="Enter position"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Salary (PKR) *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={salary}
                  onChangeText={setSalary}
                  placeholder="Enter salary"
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
                  onPress={handleEditEmployee}
                >
                  <Text style={styles.modalButtonText}>Update Employee</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Payment Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={paymentModalVisible}
        onRequestClose={() => setPaymentModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Payment for {selectedEmployee?.name}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount (PKR)</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={paymentAmount}
                onChangeText={setPaymentAmount}
                placeholder="Enter amount"
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Payment Type</Text>
              <View style={styles.paymentTypeOptions}>
                {['salary', 'commission', 'advance', 'bonus'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.paymentTypeOption,
                      paymentType === type && styles.selectedPaymentType
                    ]}
                    onPress={() => setPaymentType(type)}
                  >
                    <Text style={[
                      styles.paymentTypeText,
                      paymentType === type && styles.selectedPaymentTypeText
                    ]}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
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
                  setPaymentModalVisible(false);
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
  employeeCard: {
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
  employeeInfo: {
    flex: 1,
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  employeePosition: {
    fontSize: 14,
    color: colors.textLight,
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
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
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
  paymentButton: {
    backgroundColor: colors.success + '20',
  },
  toggleButton: {
    backgroundColor: colors.warning + '20',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
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
  paymentTypeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  paymentTypeOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  selectedPaymentType: {
    backgroundColor: colors.lightAqua,
    borderColor: colors.lightAqua,
  },
  paymentTypeText: {
    fontSize: 12,
    color: colors.textLight,
  },
  selectedPaymentTypeText: {
    color: colors.white,
    fontWeight: '600',
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