import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useGlobalContext } from '../globalcontext/globalcontext';

const CashIn = () => {
  const router = useRouter();
  const { account, setAccount } = useGlobalContext();

  const [amount, setAmount] = useState('');

  const addBalance = () => {
    const cashInAmount = Number(amount);

    if (isNaN(cashInAmount) || cashInAmount <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    setAccount({
      ...account,
      balance: account.balance + cashInAmount,
    });

    setAmount('');
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ fontSize: 24, marginBottom: 20 }}>Cash In</Text>

      <View>
        <Text>Current Balance: {account.balance}</Text>

        <TextInput
          placeholder="Enter amount"
          keyboardType="numeric"
          value={amount}
          onChangeText={setAmount}
          style={{
            borderWidth: 1,
            borderColor: 'gray',
            padding: 10,
            marginVertical: 10,
            borderRadius: 5,
          }}
        />

        <TouchableOpacity
          onPress={addBalance}
          style={{
            backgroundColor: '#2196F3',
            padding: 12,
            borderRadius: 5,
            alignItems: 'center',
          }}
        >
          <Text style={{ color: 'white', fontWeight: 'bold' }}>
            Cash In
          </Text>
        </TouchableOpacity>
      </View>

      <View style={{ marginTop: 20 }}>
        <TouchableOpacity
          onPress={() =>
            router.push('/palace/account/transactions')
          }
        >
          <Text style={{ color: 'blue' }}>
            View Transaction History
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default CashIn;