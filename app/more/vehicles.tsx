import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function VehiclesScreen() {
  const [vehicles, setVehicles] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [expenseModalVisible, setExpenseModalVisible] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  
  const [name, setName] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('');
  const [status, setStatus] = useState('active');
  const [notes, setNotes] = useState('');
  
  const [expenseType, setExpenseType] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseDate, setExpenseDate] = useState('');

  useEffect(() => {
    loadVehicles();
  }, []);

  const loadVehicles = async () => {
    const db = getDatabase();
    try {
      const results = await db.getAllAsync('SELECT * FROM vehicles ORDER BY name');
      setVehicles(results);
    } catch (error) {
      console.error('Error loading vehicles:', error);
      Alert.alert('Error', 'Failed to load vehicles');
    }
  };

  const handleAddVehicle = async () => {
    if (!name.trim() || !registrationNumber.trim() || !vehicleType.trim()) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const db = getDatabase();
    try {
      await db.runAsync(
        `INSERT INTO vehicles (name, registration_number, vehicle_type, status, notes)
         VALUES (?, ?, ?, ?, ?)`,
        [name.trim(), registrationNumber.trim(), vehicleType.trim(), status, notes.trim() || '']
      );
      
      setModalVisible(false);
      resetForm();
      await loadVehicles();
      Alert.alert('Success', 'Vehicle added successfully');
    } catch (error) {
      console.error('Error adding vehicle:', error);
      Alert.alert('Error', 'Failed to add vehicle');
    }
  };

  const handleEditVehicle = async () => {
    if (!selectedVehicle) return;
    
    const db = getDatabase();
    try {
      await db.runAsync(
        `UPDATE vehicles 
         SET name = ?, registration_number = ?, vehicle_type = ?, status = ?, notes = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name.trim(), registrationNumber.trim(), vehicleType.trim(), status, notes.trim() || '', selectedVehicle.id]
      );
      
      setEditModalVisible(false);
      resetForm();
      await loadVehicles();
      Alert.alert('Success', 'Vehicle updated successfully');
    } catch (error) {
      console.error('Error updating vehicle:', error);
      Alert.alert('Error', 'Failed to update vehicle');
    }
  };

  const handleDeleteVehicle = (vehicle) => {
    Alert.alert(
      'Delete Vehicle',
      `Are you sure you want to delete "${vehicle.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const db = getDatabase();
            try {
              await db.runAsync('DELETE FROM vehicles WHERE id = ?', [vehicle.id]);
              await loadVehicles();
              Alert.alert('Success', 'Vehicle deleted successfully');
            } catch (error) {
              console.error('Error deleting vehicle:', error);
              Alert.alert('Error', 'Failed to delete vehicle');
            }
          }
        }
      ]
    );
  };

  const handleAddExpense = async () => {
    if (!selectedVehicle || !expenseType.trim() || !expenseAmount || parseFloat(expenseAmount) <= 0) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    const db = getDatabase();
    try {
      await db.execAsync('BEGIN TRANSACTION');

      await db.runAsync(
        `INSERT INTO vehicle_expenses (vehicle_id, expense_type, amount, description, expense_date, notes)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          selectedVehicle.id,
          expenseType.trim(),
          parseFloat(expenseAmount),
          expenseDescription.trim() || '',
          expenseDate || new Date().toISOString().split('T')[0],
          notes.trim() || ''
        ]
      );

      // Update balance
      await db.runAsync(
        'UPDATE plant_settings SET balance = balance - ?',
        [parseFloat(expenseAmount)]
      );

      // Add transaction
      await db.runAsync(
        `INSERT INTO transactions (type, amount, person_name, description, reference_id, reference_type)
         VALUES ('expense', ?, ?, ?, ?, 'vehicle')`,
        [parseFloat(expenseAmount), `Vehicle: ${selectedVehicle.name}`, expenseType.trim(), selectedVehicle.id]
      );

      await db.execAsync('COMMIT');
      
      setExpenseModalVisible(false);
      resetExpenseForm();
      await loadVehicles();
      Alert.alert('Success', 'Expense recorded successfully');
    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error('Error adding expense:', error);
      Alert.alert('Error', 'Failed to record expense');
    }
  };

  const resetForm = () => {
    setName('');
    setRegistrationNumber('');
    setVehicleType('');
    setStatus('active');
    setNotes('');
    setSelectedVehicle(null);
  };

  const resetExpenseForm = () => {
    setExpenseType('');
    setExpenseAmount('');
    setExpenseDescription('');
    setExpenseDate('');
    setNotes('');
  };

  const openEditModal = (vehicle) => {
    setSelectedVehicle(vehicle);
    setName(vehicle.name);
    setRegistrationNumber(vehicle.registration_number);
    setVehicleType(vehicle.vehicle_type);
    setStatus(vehicle.status);
    setNotes(vehicle.notes || '');
    setEditModalVisible(true);
  };

  const getStatusColor = (status) => {
    const colors_map = {
      active: colors.success,
      maintenance: colors.warning,
      inactive: colors.danger
    };
    return colors_map[status] || colors.textLight;
  };

  const renderItem = ({ item }) => (
    <View style={styles.vehicleCard}>
      <View style={styles.cardHeader}>
        <View style={styles.vehicleInfo}>
          <Text style={styles.vehicleName}>{item.name}</Text>
          <Text style={styles.vehicleReg}>{item.registration_number}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>🚗 {item.vehicle_type}</Text>
        <Text style={styles.detailText}>📅 Added: {new Date(item.created_at).toLocaleDateString()}</Text>
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.expenseButton]}
          onPress={() => {
            setSelectedVehicle(item);
            setExpenseModalVisible(true);
          }}
        >
          <Text style={styles.actionButtonText}>Add Expense</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteVehicle(item)}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Vehicles</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Add Vehicle</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={vehicles}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />

      {/* Add Vehicle Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add Vehicle</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Vehicle Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter vehicle name"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Registration Number *</Text>
                <TextInput
                  style={styles.input}
                  value={registrationNumber}
                  onChangeText={setRegistrationNumber}
                  placeholder="Enter registration number"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Vehicle Type *</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleType}
                  onChangeText={setVehicleType}
                  placeholder="e.g., Truck, Van, Car"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.statusOptions}>
                  {['active', 'maintenance', 'inactive'].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusOption,
                        status === s && styles.selectedStatus
                      ]}
                      onPress={() => setStatus(s)}
                    >
                      <Text style={[
                        styles.statusOptionText,
                        status === s && styles.selectedStatusText
                      ]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                  onPress={handleAddVehicle}
                >
                  <Text style={styles.modalButtonText}>Add Vehicle</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Vehicle Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Edit Vehicle</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Vehicle Name *</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter vehicle name"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Registration Number *</Text>
                <TextInput
                  style={styles.input}
                  value={registrationNumber}
                  onChangeText={setRegistrationNumber}
                  placeholder="Enter registration number"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Vehicle Type *</Text>
                <TextInput
                  style={styles.input}
                  value={vehicleType}
                  onChangeText={setVehicleType}
                  placeholder="e.g., Truck, Van, Car"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.statusOptions}>
                  {['active', 'maintenance', 'inactive'].map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[
                        styles.statusOption,
                        status === s && styles.selectedStatus
                      ]}
                      onPress={() => setStatus(s)}
                    >
                      <Text style={[
                        styles.statusOptionText,
                        status === s && styles.selectedStatusText
                      ]}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                  onPress={handleEditVehicle}
                >
                  <Text style={styles.modalButtonText}>Update Vehicle</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Add Expense Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={expenseModalVisible}
        onRequestClose={() => setExpenseModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Add Expense for {selectedVehicle?.name}
            </Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Expense Type *</Text>
              <TextInput
                style={styles.input}
                value={expenseType}
                onChangeText={setExpenseType}
                placeholder="e.g., Fuel, Maintenance, Insurance"
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Amount (PKR) *</Text>
              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={expenseAmount}
                onChangeText={setExpenseAmount}
                placeholder="Enter amount"
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Description</Text>
              <TextInput
                style={styles.input}
                value={expenseDescription}
                onChangeText={setExpenseDescription}
                placeholder="Enter description"
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
                style={styles.input}
                value={notes}
                onChangeText={setNotes}
                placeholder="Add notes"
                placeholderTextColor={colors.textLight}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setExpenseModalVisible(false);
                  resetExpenseForm();
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
  vehicleCard: {
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
  vehicleInfo: {
    flex: 1,
  },
  vehicleName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  vehicleReg: {
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
  expenseButton: {
    backgroundColor: colors.warning + '20',
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
  statusOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statusOption: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.xs,
    marginBottom: spacing.xs,
  },
  selectedStatus: {
    backgroundColor: colors.lightAqua,
    borderColor: colors.lightAqua,
  },
  statusOptionText: {
    fontSize: 12,
    color: colors.textLight,
  },
  selectedStatusText: {
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