import { View, Text, StyleSheet, FlatList, TouchableOpacity, Modal, TextInput, Alert, ScrollView } from 'react-native';
import { useState, useEffect } from 'react';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function ProductionScreen() {
  const [productionOrders, setProductionOrders] = useState([]);
  const [readyItems, setReadyItems] = useState([]);
  const [rawItems, setRawItems] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReadyItem, setSelectedReadyItem] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const db = getDatabase();
    try {
      // Load ready items
      const ready = await db.getAllAsync(
        'SELECT * FROM ready_items ORDER BY name'
      );
      setReadyItems(ready);

      // Load raw items for component check
      const raw = await db.getAllAsync(
        'SELECT * FROM raw_items ORDER BY name'
      );
      setRawItems(raw);

      // Load production orders
      const orders = await db.getAllAsync(`
        SELECT po.*, ri.name as item_name,
               (SELECT COUNT(*) FROM production_order_transactions WHERE production_order_id = po.id) as component_count
        FROM production_orders po
        LEFT JOIN ready_items ri ON po.ready_item_id = ri.id
        ORDER BY po.order_date DESC
      `);
      setProductionOrders(orders);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
    }
  };

  const checkRawMaterialAvailability = async (readyItemId, quantity) => {
    const db = getDatabase();
    const components = await db.getAllAsync(
      `SELECT ric.*, ri.name as raw_name, ri.stock_quantity
       FROM ready_item_components ric
       JOIN raw_items ri ON ric.raw_item_id = ri.id
       WHERE ric.ready_item_id = ?`,
      [readyItemId]
    );

    const shortages = [];
    for (const comp of components) {
      const required = comp.quantity_required * quantity;
      if (comp.stock_quantity < required) {
        shortages.push({
          name: comp.raw_name,
          available: comp.stock_quantity,
          required: required,
          shortage: required - comp.stock_quantity
        });
      }
    }

    return { available: shortages.length === 0, shortages };
  };

  const handleCreateProduction = async () => {
    if (!selectedReadyItem || !quantity || parseInt(quantity) <= 0) {
      Alert.alert('Error', 'Please select an item and enter quantity');
      return;
    }

    const qty = parseInt(quantity);
    
    // Check raw material availability
    const { available, shortages } = await checkRawMaterialAvailability(selectedReadyItem, qty);
    
    if (!available) {
      let message = 'Insufficient raw materials:\n\n';
      shortages.forEach(s => {
        message += `• ${s.name}: Need ${s.required}, Have ${s.available} (Shortage: ${s.shortage})\n`;
      });
      Alert.alert('Insufficient Materials', message);
      return;
    }

    setLoading(true);
    const db = getDatabase();

    try {
      await db.execAsync('BEGIN TRANSACTION');

      // Create production order
      const result = await db.runAsync(
        `INSERT INTO production_orders (ready_item_id, quantity, status, order_date, notes)
         VALUES (?, ?, 'pending', CURRENT_TIMESTAMP, ?)`,
        [selectedReadyItem, qty, notes.trim() || '']
      );

      const orderId = result.lastInsertRowId;

      // Get components and deduct raw materials
      const components = await db.getAllAsync(
        `SELECT * FROM ready_item_components WHERE ready_item_id = ?`,
        [selectedReadyItem]
      );

      let totalCost = 0;
      for (const comp of components) {
        const required = comp.quantity_required * qty;
        
        // Get raw item price
        const rawItem = await db.getFirstAsync(
          'SELECT purchase_price FROM raw_items WHERE id = ?',
          [comp.raw_item_id]
        );
        
        totalCost += (rawItem.purchase_price || 0) * required;

        // Deduct from raw stock
        await db.runAsync(
          'UPDATE raw_items SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [required, comp.raw_item_id]
        );

        // Record transaction
        await db.runAsync(
          `INSERT INTO production_order_transactions (production_order_id, raw_item_id, quantity_used)
           VALUES (?, ?, ?)`,
          [orderId, comp.raw_item_id, required]
        );
      }

      // Update production cost
      await db.runAsync(
        'UPDATE ready_items SET production_cost = ? WHERE id = ?',
        [totalCost / qty, selectedReadyItem]
      );

      // Mark order as completed
      await db.runAsync(
        `UPDATE production_orders 
         SET status = 'completed', completed_date = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [orderId]
      );

      // Add to ready items stock
      await db.runAsync(
        'UPDATE ready_items SET stock_quantity = stock_quantity + ? WHERE id = ?',
        [qty, selectedReadyItem]
      );

      await db.execAsync('COMMIT');
      
      setModalVisible(false);
      resetForm();
      await loadData();
      Alert.alert('Success', `Production order completed!\nProduced ${qty} units`);
    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error('Error creating production:', error);
      Alert.alert('Error', 'Failed to create production order');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setSelectedReadyItem(null);
    setQuantity('');
    setNotes('');
  };

  const getStatusColor = (status) => {
    const colors_map = {
      pending: colors.warning,
      in_progress: colors.info,
      completed: colors.success,
      cancelled: colors.danger
    };
    return colors_map[status] || colors.textLight;
  };

  const renderItem = ({ item }) => (
    <View style={styles.orderCard}>
      <View style={styles.cardHeader}>
        <View style={styles.orderInfo}>
          <Text style={styles.itemName}>{item.item_name}</Text>
          <Text style={styles.orderId}>#PO-{item.id}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status?.toUpperCase()}</Text>
        </View>
      </View>
      
      <View style={styles.cardDetails}>
        <Text style={styles.detailText}>Quantity: {item.quantity}</Text>
        <Text style={styles.detailText}>Components: {item.component_count}</Text>
        {item.completed_date && (
          <Text style={styles.detailText}>
            Completed: {new Date(item.completed_date).toLocaleDateString()}
          </Text>
        )}
        <Text style={styles.detailText}>
          Ordered: {new Date(item.order_date).toLocaleDateString()}
        </Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Production Orders</Text>
        <TouchableOpacity 
          style={styles.addButton}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <Text style={styles.addButtonText}>+ New Production</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={productionOrders}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏭</Text>
            <Text style={styles.emptyText}>No production orders</Text>
            <Text style={styles.emptySubtext}>Start a new production</Text>
          </View>
        }
      />

      {/* Production Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>New Production</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Select Ready Item *</Text>
                {readyItems.map(item => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemOption,
                      selectedReadyItem === item.id && styles.selectedItemOption
                    ]}
                    onPress={() => setSelectedReadyItem(item.id)}
                  >
                    <View>
                      <Text style={styles.itemOptionName}>{item.name}</Text>
                      <Text style={styles.itemOptionDetail}>
                        Stock: {item.stock_quantity} | Price: PKR {item.selling_price}
                      </Text>
                    </View>
                    {selectedReadyItem === item.id && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Quantity to Produce *</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={quantity}
                  onChangeText={setQuantity}
                  placeholder="Enter quantity"
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
                  onPress={handleCreateProduction}
                  disabled={loading}
                >
                  <Text style={styles.modalButtonText}>
                    {loading ? 'Processing...' : 'Start Production'}
                  </Text>
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
  orderCard: {
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
  orderInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  orderId: {
    fontSize: 12,
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
  itemOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  selectedItemOption: {
    borderColor: colors.lightAqua,
    backgroundColor: colors.aquaWhite,
  },
  itemOptionName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.darkGrey,
  },
  itemOptionDetail: {
    fontSize: 12,
    color: colors.textLight,
  },
  checkmark: {
    fontSize: 18,
    color: colors.success,
    fontWeight: 'bold',
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