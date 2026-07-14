import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function ReadyItemsScreen() {
  const [readyItems, setReadyItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [name, setName] = useState('');
  const [sellingPrice, setSellingPrice] = useState('');
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState('');
  const [productionCost, setProductionCost] = useState('');

  useEffect(() => {
    loadReadyItems();
  }, []);

  const loadReadyItems = async () => {
    const db = getDatabase();
    try {
      const items = await db.getAllAsync('SELECT * FROM ready_items ORDER BY name');
      setReadyItems(items);
    } catch (error) {
      console.error('Error loading ready items:', error);
      Alert.alert('Error', 'Failed to load ready items');
    }
  };

  const handleAddItem = async () => {
    if (!name.trim() || !sellingPrice || !stock || !minStock || !productionCost) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    const db = getDatabase();
    try {
      await db.runAsync(
        `INSERT INTO ready_items (name, selling_price, stock_quantity, min_stock, production_cost) 
         VALUES (?, ?, ?, ?, ?)`,
        [name.trim(), parseFloat(sellingPrice), parseInt(stock), parseInt(minStock), parseFloat(productionCost)]
      );
      
      setModalVisible(false);
      resetForm();
      await loadReadyItems();
      Alert.alert('Success', 'Ready item added successfully');
    } catch (error) {
      console.error('Error adding ready item:', error);
      Alert.alert('Error', 'Failed to add ready item');
    }
  };

  const handleEditItem = async () => {
    if (!selectedItem) return;
    
    const db = getDatabase();
    try {
      await db.runAsync(
        `UPDATE ready_items 
         SET name = ?, selling_price = ?, stock_quantity = ?, min_stock = ?, production_cost = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [name.trim(), parseFloat(sellingPrice), parseInt(stock), parseInt(minStock), parseFloat(productionCost), selectedItem.id]
      );
      
      setEditModalVisible(false);
      resetForm();
      await loadReadyItems();
      Alert.alert('Success', 'Ready item updated successfully');
    } catch (error) {
      console.error('Error updating ready item:', error);
      Alert.alert('Error', 'Failed to update ready item');
    }
  };

  const handleDeleteItem = (item) => {
    Alert.alert(
      'Delete Item',
      `Are you sure you want to delete "${item.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const db = getDatabase();
            try {
              await db.runAsync('DELETE FROM ready_items WHERE id = ?', [item.id]);
              await loadReadyItems();
              Alert.alert('Success', 'Item deleted successfully');
            } catch (error) {
              console.error('Error deleting ready item:', error);
              Alert.alert('Error', 'Failed to delete item');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setName('');
    setSellingPrice('');
    setStock('');
    setMinStock('');
    setProductionCost('');
    setSelectedItem(null);
  };

  const openEditModal = (item) => {
    setSelectedItem(item);
    setName(item.name);
    setSellingPrice(item.selling_price.toString());
    setStock(item.stock_quantity.toString());
    setMinStock(item.min_stock.toString());
    setProductionCost(item.production_cost?.toString() || '0');
    setEditModalVisible(true);
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={[styles.stockBadge, 
          { backgroundColor: item.stock_quantity < item.min_stock ? colors.danger : colors.success }
        ]}>
          Stock: {item.stock_quantity}
        </Text>
      </View>
      <View style={styles.itemDetails}>
        <Text style={styles.itemDetail}>Price: PKR {item.selling_price?.toLocaleString()}</Text>
        <Text style={styles.itemDetail}>Min Stock: {item.min_stock}</Text>
        <Text style={styles.itemDetail}>Cost: PKR {item.production_cost?.toLocaleString()}</Text>
      </View>
      <View style={styles.itemActions}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.editButton]}
          onPress={() => openEditModal(item)}
        >
          <Text style={styles.actionButtonText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDeleteItem(item)}
        >
          <Text style={styles.actionButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ready Items</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Text style={styles.addButtonText}>+ Add Item</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={readyItems}
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
              <Text style={styles.modalTitle}>Add Ready Item</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Item Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter item name"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Selling Price (PKR)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={sellingPrice}
                  onChangeText={setSellingPrice}
                  placeholder="Enter selling price"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Stock Quantity</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={stock}
                  onChangeText={setStock}
                  placeholder="Enter stock quantity"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Minimum Stock</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={minStock}
                  onChangeText={setMinStock}
                  placeholder="Enter minimum stock level"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Production Cost (PKR)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={productionCost}
                  onChangeText={setProductionCost}
                  placeholder="Enter production cost"
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
                  onPress={handleAddItem}
                >
                  <Text style={styles.modalButtonText}>Add Item</Text>
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
              <Text style={styles.modalTitle}>Edit Ready Item</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Item Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Enter item name"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Selling Price (PKR)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={sellingPrice}
                  onChangeText={setSellingPrice}
                  placeholder="Enter selling price"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Stock Quantity</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={stock}
                  onChangeText={setStock}
                  placeholder="Enter stock quantity"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Minimum Stock</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={minStock}
                  onChangeText={setMinStock}
                  placeholder="Enter minimum stock level"
                  placeholderTextColor={colors.textLight}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Production Cost (PKR)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={productionCost}
                  onChangeText={setProductionCost}
                  placeholder="Enter production cost"
                  placeholderTextColor={colors.textLight}
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
                  onPress={handleEditItem}
                >
                  <Text style={styles.modalButtonText}>Update Item</Text>
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
  itemCard: {
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
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  stockBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
    fontSize: 12,
    color: colors.white,
    fontWeight: '600',
  },
  itemDetails: {
    marginBottom: spacing.sm,
  },
  itemDetail: {
    fontSize: 13,
    color: colors.textLight,
    marginVertical: 1,
  },
  itemActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
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
    fontSize: 13,
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