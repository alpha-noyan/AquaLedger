import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, FlatList } from 'react-native';
import { useState, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { getDatabase } from '../../database';
import { colors, spacing, borderRadius } from '../../styles/colors';

export default function NewOrderScreen() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState('');
  const [readyItems, setReadyItems] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cart, setCart] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [quantity, setQuantity] = useState('1');
  const [paymentStatus, setPaymentStatus] = useState('pending');
  const [amountReceived, setAmountReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [deliveryRequired, setDeliveryRequired] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [commission, setCommission] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const db = getDatabase();
    try {
      const items = await db.getAllAsync(
        'SELECT * FROM ready_items WHERE stock_quantity > 0 ORDER BY name'
      );
      setReadyItems(items);

      const emp = await db.getAllAsync(
        'SELECT * FROM employees WHERE is_active = 1 ORDER BY name'
      );
      setEmployees(emp);
    } catch (error) {
      console.error('Error loading data:', error);
      Alert.alert('Error', 'Failed to load data');
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

  const calculateTotal = () => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  };

  const generateOrderNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    return `ORD-${year}${month}${day}-${random}`;
  };

  const handleSubmit = async () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Please add items to the order');
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

    if (deliveryRequired && !selectedEmployee) {
      Alert.alert('Error', 'Please select a delivery employee');
      return;
    }

    if (deliveryRequired && commission && parseFloat(commission) < 0) {
      Alert.alert('Error', 'Please enter valid commission');
      return;
    }

    setLoading(true);
    const db = getDatabase();
    const orderNumber = generateOrderNumber();

    try {
      await db.execAsync('BEGIN TRANSACTION');

      // Create order
      const result = await db.runAsync(
        `INSERT INTO orders (
          order_number, customer_name, order_date, delivery_date, status,
          total_amount, paid_amount, payment_status, delivery_employee_id,
          delivery_commission, delivery_notes
        ) VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          orderNumber,
          customerName.trim(),
          deliveryDate || null,
          'pending',
          total,
          paidAmount,
          paymentStatus,
          deliveryRequired ? selectedEmployee : null,
          deliveryRequired ? parseFloat(commission) || 0 : 0,
          notes.trim() || ''
        ]
      );

      const orderId = result.lastInsertRowId;

      // Add order items
      for (const item of cart) {
        await db.runAsync(
          `INSERT INTO order_items (order_id, ready_item_id, quantity, unit_price, total_price)
           VALUES (?, ?, ?, ?, ?)`,
          [orderId, item.id, item.quantity, item.price, item.total]
        );
      }

      // Add payment transaction
      if (paidAmount > 0) {
        await db.runAsync(
          `INSERT INTO order_transactions (order_id, amount, payment_date, notes)
           VALUES (?, ?, CURRENT_TIMESTAMP, ?)`,
          [orderId, paidAmount, 'Initial payment']
        );

        await db.runAsync(
          'UPDATE plant_settings SET balance = balance + ?',
          [paidAmount]
        );
      }

      // Create loan if partial payment
      if (paymentStatus === 'partial' && paidAmount < total) {
        await db.runAsync(
          `INSERT INTO loans (customer_name, reference_type, reference_id, total_amount, paid_amount, status, due_date)
           VALUES (?, 'order', ?, ?, ?, 'active', datetime('now', '+30 days'))`,
          [customerName.trim(), orderId, total, paidAmount]
        );
      }

      // Add commission transaction for employee
      if (deliveryRequired && commission && parseFloat(commission) > 0) {
        await db.runAsync(
          `INSERT INTO employee_payments (employee_id, amount, payment_date, payment_type, notes)
           VALUES (?, ?, CURRENT_TIMESTAMP, 'commission', ?)`,
          [selectedEmployee, parseFloat(commission), `Commission for order ${orderNumber}`]
        );
      }

      await db.execAsync('COMMIT');
      
      Alert.alert(
        'Success',
        `Order ${orderNumber} created successfully!\nTotal: PKR ${total.toLocaleString()}`,
        [
          { 
            text: 'OK', 
            onPress: () => router.replace('/orders') 
          }
        ]
      );

    } catch (error) {
      await db.execAsync('ROLLBACK');
      console.error('Error creating order:', error);
      Alert.alert('Error', 'Failed to create order');
    } finally {
      setLoading(false);
    }
  };

  const total = calculateTotal();

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Customer Information</Text>
          <TextInput
            style={styles.input}
            value={customerName}
            onChangeText={setCustomerName}
            placeholder="Customer Name *"
            placeholderTextColor={colors.textLight}
          />
          <TextInput
            style={[styles.input, styles.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Order Notes (Optional)"
            placeholderTextColor={colors.textLight}
            multiline
            numberOfLines={2}
          />
        </View>

        {/* Delivery Options */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Delivery Options</Text>
          <TouchableOpacity 
            style={[styles.toggleButton, deliveryRequired && styles.toggleActive]}
            onPress={() => setDeliveryRequired(!deliveryRequired)}
          >
            <Text style={[styles.toggleText, deliveryRequired && styles.toggleActiveText]}>
              {deliveryRequired ? '✅ Delivery Required' : '⬜ Self Pickup'}
            </Text>
          </TouchableOpacity>

          {deliveryRequired && (
            <>
              <TextInput
                style={styles.input}
                value={deliveryDate}
                onChangeText={setDeliveryDate}
                placeholder="Delivery Date (YYYY-MM-DD)"
                placeholderTextColor={colors.textLight}
              />
              
              <View style={styles.employeeSelect}>
                <Text style={styles.inputLabel}>Delivery Employee</Text>
                {employees.map(emp => (
                  <TouchableOpacity
                    key={emp.id}
                    style={[
                      styles.employeeOption,
                      selectedEmployee === emp.id && styles.selectedEmployee
                    ]}
                    onPress={() => setSelectedEmployee(emp.id)}
                  >
                    <Text style={styles.employeeName}>{emp.name}</Text>
                    <Text style={styles.employeePosition}>{emp.position}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={styles.input}
                keyboardType="numeric"
                value={commission}
                onChangeText={setCommission}
                placeholder="Commission Amount (PKR)"
                placeholderTextColor={colors.textLight}
              />
            </>
          )}
        </View>

        {/* Item Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Items</Text>
          <FlatList
            data={readyItems}
            renderItem={({ item }) => (
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
            )}
            keyExtractor={item => item.id.toString()}
            scrollEnabled={false}
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
              <Text style={styles.addButtonText}>Add to Order</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Cart */}
        {cart.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Order Summary</Text>
            {cart.map((item) => (
              <View key={item.id} style={styles.cartItem}>
                <View style={styles.cartItemLeft}>
                  <Text style={styles.cartItemName}>{item.name}</Text>
                  <Text style={styles.cartItemPrice}>PKR {item.price} × {item.quantity}</Text>
                </View>
                <View style={styles.cartItemRight}>
                  <Text style={styles.cartItemTotal}>PKR {item.total}</Text>
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
                  paymentStatus === 'pending' && styles.selectedPayment
                ]}
                onPress={() => {
                  setPaymentStatus('pending');
                  setAmountReceived('');
                }}
              >
                <Text style={styles.paymentOptionText}>Pending</Text>
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
              {loading ? 'Creating...' : 'Create Order'}
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
  toggleButton: {
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  toggleActive: {
    backgroundColor: colors.aquaWhite,
    borderColor: colors.lightAqua,
  },
  toggleText: {
    fontSize: 14,
    color: colors.textLight,
  },
  toggleActiveText: {
    color: colors.darkGrey,
    fontWeight: '600',
  },
  inputLabel: {
    fontSize: 14,
    color: colors.darkGrey,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  employeeSelect: {
    marginBottom: spacing.sm,
  },
  employeeOption: {
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  selectedEmployee: {
    borderColor: colors.lightAqua,
    backgroundColor: colors.aquaWhite,
  },
  employeeName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.darkGrey,
  },
  employeePosition: {
    fontSize: 12,
    color: colors.textLight,
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
  cartItemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.darkGrey,
    marginRight: spacing.sm,
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