import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, FlatList } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function NewSaleScreen() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState('');
  const [readyItems, setReadyItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [paymentStatus, setPaymentStatus] = useState('paid');
  const [amountReceived, setAmountReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadReadyItems();
  }, []);

  const loadReadyItems = async () => {
    const db = getDatabase();
    try {
      const items = await db.getAllAsync(
        'SELECT * FROM ready_items WHERE stock_quantity > 0 ORDER BY name'
      );
      setReadyItems(items);
    } catch (error) {
      console.error('Error loading ready items:', error);
      Alert.alert('Error', 'Failed to load items');
    }
  };

  const addToCart = () => {
    if (!selectedItem) {
      Alert.alert('Error', 'Please select an item');
      return;
    }
    
    const qty = parseInt(quantity);
    if (qty <= 0) {
      Alert.alert('Error', 'Please enter valid quantity');
      return;
    }

    if (qty > selectedItem.stock_quantity) {
      Alert.alert('Error', `Only ${selectedItem.stock_quantity} items available in stock`);
      return;
    }

    const existingItem = cart.find(item => item.id === selectedItem.id);
    if (existingItem) {
      const newQty = existingItem.quantity + qty;
      if (newQty > selectedItem.stock_quantity) {
        Alert.alert('Error', `Only ${selectedItem.stock_quantity} items available in stock`);
        return;
      }
      setCart(cart.map(item => 
        item.id === selectedItem.id 
          ? { ...item, quantity: newQty, total: newQty * item.price }
          : item
      ));
    } else {
      setCart([...cart, {
        id: selectedItem.id,
        name: selectedItem.name,
        price: selectedItem.selling_price,
        quantity: qty,
        total: qty * selectedItem.selling_price
      }]);
    }

    setSelectedItem(null);
    setQuantity('1');
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(item => item.id !== itemId));
  };

  const updateQuantity = (itemId, newQuantity) => {
    const qty = parseInt(newQuantity);
    if (qty <= 0) {
      removeFromCart(itemId);
      return;
    }

    const item = readyItems.find(i => i.id === itemId);
    if (item && qty > item.stock_quantity) {
      Alert.alert('Error', `Only ${item.stock_quantity} items available in stock`);
      return;
    }

    setCart(cart.map(item => 
      item.id === itemId 
        ? { ...item, quantity: qty, total: qty * item.price }
        : item
    ));
  };

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Please add items to the cart');
      return;
    }

    if (!customerName.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    const total = calculateTotal();
    let paidAmount = 0;

    if (paymentStatus === 'paid') {
      paidAmount = total;
    } else if (paymentStatus === 'partial') {
      if (!amountReceived || parseFloat(amountReceived) <= 0) {
        Alert.alert('Error', 'Please enter amount received');
        return;
      }
      paidAmount = parseFloat(amountReceived);
      if (paidAmount > total) {
        Alert.alert('Error', 'Amount received cannot exceed total');
        return;
      }
    }

    setLoading(true);
    const db = getDatabase();

    try {
      await db.execAsync('BEGIN TRANSACTION');

      // Create sale
      const result = await db.runAsync(
        `INSERT INTO sales (customer_name, total_amount, paid_amount, payment_status, notes, sale_date)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [customerName.trim(), total, paidAmount, paymentStatus, notes.trim() || '']
      );

      const saleId = result.lastInsertRowId;

      // Add sale items and update stock
      for (const item of cart) {
        await db.runAsync(
          `INSERT INTO sale_items (sale_id, ready_item_id, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [saleId, item.id, item.quantity, item.price, item.total]
        );

        // Update stock
        await db.runAsync(
          'UPDATE ready_items SET stock_quantity = stock_quantity - ? WHERE id = ?',
          [item.quantity, item.id]
        );
      }

      // Add payment transaction
      if (paidAmount > 0) {
        await db.runAsync(
          `INSERT INTO sale_transactions (sale_id, amount, payment_date, notes)
           VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
          [saleId, paidAmount, 'Initial payment']
        );

        // Update balance
        await db.runAsync(
          'UPDATE plant_settings SET balance = balance + ?',
          [paidAmount]
        );
      }

      // Create loan if partial payment
      if (paymentStatus === 'partial' && paidAmount < total) {
        await db.runAsync(
          `INSERT INTO loans (customer_name, reference_type, reference_id, total_amount, paid_amount, status, due_date)
           VALUES (?, 'sale', ?, ?, ?, 'active', datetime('now', '+30 days'))`,
          [customerName.trim(), saleId, total, paidAmount]
        );
      }

      await db.execAsync('COMMIT');
      
      Alert.alert(
        'Success',
        `Sale created successfully!\nTotal: PKR ${total.toLocaleString()}\nPaid: PKR ${paidAmount.toLocaleString()}`,
        [
          { 
            text: 'OK', 
            onPress: () => router.replace('/sales') 
          }
        ]
      );

    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error('Error creating sale:', error);
      Alert.alert('Error', 'Failed to create sale');
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity 
      style={[
        styles.itemCard,
        selectedItem?.id === item.id && styles.selectedItem
      ]}
      onPress={() => setSelectedItem(item)}
    >
      <View>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemDetail}>Stock: {item.stock_quantity}</Text>
      </View>
      <Text style={styles.itemPrice}>PKR {item.selling_price}</Text>
    </TouchableOpacity>
  );

  const total = calculateTotal();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent}>
        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <TextInput
            style={styles.input}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Customer Name"
            placeholderTextColor={colors.textLight}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Notes (Optional)"
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Item Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Items</Text>
          <FlatList
            data={readyItems}
            renderItem={renderItem}
            keyExtractor={item => item.id.toString()}
            scrollEnabled={true}
            style={styles.itemList}
          />
          
          <View style={styles.addToCartRow}>
            <TextInput
              style={styles.quantityInput}
              keyboardType="numeric"
              value={quantity}
              onChangeText={setQuantity}
              placeholder="Qty"
              placeholderTextColor={colors.textLight}
            />
            <TouchableOpacity 
              style={styles.addButton}
              onPress={addToCart}
              disabled={!selectedItem}
            >
              <Text style={styles.addButtonText}>Add to Cart</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cart */}
        {cart.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Cart</Text>
            {cart.map((item) => (
              <View key={item.id} style={styles.cartItem}>
                <View style={styles.cartItemLeft}>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  <Text style={styles.cartItemPrice}>PKR {item.price}</Text>
                </View>
                <View style={styles.cartItemRight}>
                  <View style={styles.quantityControls}>
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(item.id, item.quantity - 1)}
                    >
                      <Text style={styles.quantityButtonText}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{item.quantity}</Text>
                    <TouchableOpacity 
                      style={styles.quantityButton}
                      onPress={() => updateQuantity(item.id, item.quantity + 1)}
                    >
                      <Text style={styles.quantityButtonText}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity 
                    onPress={() => removeFromCart(item.id)}
                    style={styles.removeButton}
                  >
                    <Text style={styles.removeButtonText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalAmount}>PKR {total.toLocaleString()}</Text>
            </View>
          </View>
        )}

        {/* Payment */}
        {cart.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Payment</Text>
            <View style={styles.paymentOptions}>
              <TouchableOpacity 
                style={[
                  styles.paymentOption,
                  paymentStatus === 'paid' && styles.selectedPayment
                ]}
                onPress={() => {
                  setPaymentStatus('paid');
                  setAmountReceived('');
                }}
              >
                <Text style={styles.paymentOptionText}>Paid</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.paymentOption,
                  paymentStatus === 'partial' && styles.selectedPayment
                ]}
                onPress={() => setPaymentStatus('partial')}
              >
                <Text style={styles.paymentOptionText}>Partial</Text>
              </TouchableOpacity>
            </View>

            {paymentStatus === 'partial' && (
              <View style={styles.partialPayment}>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={amountReceived}
                  onChangeText={setAmountReceived}
                  placeholder="Amount Received (PKR)"
                  placeholderTextColor={colors.textLight}
                />
                <Text style={styles.remainingText}>
                  Remaining: PKR {(total - (parseFloat(amountReceived) || 0)).toLocaleString()}
                </Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Submit Button */}
      {cart.length > 0 && (
        <View style={styles.footer}>
          <TouchableOpacity 
            style={[styles.submitButton, loading && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.submitButtonText}>
              {loading ? 'Processing...' : 'Complete Sale'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.aquaWhite,
  },
  scrollContent: {
    flex: 1,
    padding: spacing.md,
  },
  section: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGrey,
    marginBottom: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: 16,
    backgroundColor: colors.white,
    marginBottom: spacing.sm,
  },
  textArea: {
    height: 60,
    textAlignVertical: 'top',
  },
  itemList: {
    maxHeight: 200,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  selectedItem: {
    borderColor: colors.lightAqua,
    backgroundColor: colors.aquaWhite,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.darkGrey,
  },
  itemDetail: {
    fontSize: 12,
    color: colors.textLight,
  },
  itemPrice: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  addToCartRow: {
    flexDirection: 'row',
    marginTop: spacing.sm,
  },
  quantityInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: 16,
    marginRight: spacing.sm,
    backgroundColor: colors.white,
  },
  addButton: {
    flex: 2,
    backgroundColor: colors.lightAqua,
    borderRadius: borderRadius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cartItemLeft: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.darkGrey,
  },
  cartItemPrice: {
    fontSize: 12,
    color: colors.textLight,
  },
  cartItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: spacing.sm,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.darkGrey,
  },
  quantityText: {
    marginHorizontal: spacing.sm,
    fontSize: 14,
    fontWeight: '500',
    minWidth: 20,
    textAlign: 'center',
  },
  removeButton: {
    padding: 4,
  },
  removeButtonText: {
    fontSize: 16,
    color: colors.danger,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: colors.border,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.darkGrey,
  },
  totalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.darkGrey,
  },
  paymentOptions: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  paymentOption: {
    flex: 1,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginHorizontal: spacing.xs,
  },
  selectedPayment: {
    borderColor: colors.lightAqua,
    backgroundColor: colors.aquaWhite,
  },
  paymentOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.darkGrey,
  },
  partialPayment: {
    marginTop: spacing.sm,
  },
  remainingText: {
    fontSize: 14,
    color: colors.warning,
    marginTop: spacing.xs,
  },
  footer: {
    backgroundColor: colors.white,
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.success,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});